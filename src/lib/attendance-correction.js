import { toAttendanceDate, getAttendanceDayRange } from "@/lib/attendance-date";
import { markEmployeeAttendance } from "@/lib/attendance-mark";
import { createAuditLog } from "@/lib/audit";
import { formatEnumLabel } from "@/lib/lookups";
import {
  resolveMarkApiToDbEnum,
  resolveDbEnumToMarkApi,
} from "@/lib/attendance-status-server";

function formatStatusLabel(dbEnum) {
  if (!dbEnum) return "Not Marked";
  return formatEnumLabel(dbEnum);
}

export function mapCorrectionRecord(correction) {
  const emp = correction.employee;
  return {
    id: correction.id,
    employeeId: correction.employeeId,
    employeeCode: emp?.employeeCode,
    employeeName: emp?.fullName,
    attendanceId: correction.attendanceId,
    attendanceDate: correction.attendanceDate,
    currentStatus: formatStatusLabel(correction.currentStatus),
    requestedStatus: formatStatusLabel(correction.requestedStatus),
    requestedStatusValue: null,
    reason: correction.reason,
    status: correction.status,
    createdAt: correction.createdAt,
    creatorName: correction.creator?.fullName || null,
  };
}

export async function finalizeCorrectionRecord(correction, prisma) {
  const mapped = mapCorrectionRecord(correction);
  mapped.requestedStatusValue = correction.requestedStatus
    ? await resolveDbEnumToMarkApi(prisma, correction.requestedStatus)
    : null;
  return mapped;
}

export async function submitAttendanceCorrection(
  prisma,
  authUser,
  { date, employeeCode, requestedStatus, reason, attendanceId }
) {
  const trimmedReason = String(reason || "").trim();
  if (!trimmedReason) {
    throw new Error("Reason for attendance correction is required");
  }
  if (!date || !employeeCode || !requestedStatus) {
    throw new Error("Date, employee, and requested status are required");
  }

  const requestedDb = await resolveMarkApiToDbEnum(prisma, requestedStatus);
  if (!requestedDb) {
    throw new Error("Select a valid requested status");
  }

  const employee = await prisma.employee.findFirst({
    where: { employeeCode: String(employeeCode).trim(), status: "Active" },
  });
  if (!employee) {
    throw new Error("Employee not found");
  }

  const { start, end } = getAttendanceDayRange(date);
  let attendance = null;
  if (attendanceId) {
    attendance = await prisma.attendance.findFirst({
      where: { id: attendanceId, employeeId: employee.id },
    });
  }
  if (!attendance) {
    attendance = await prisma.attendance.findFirst({
      where: {
        employeeId: employee.id,
        attendanceDate: { gte: start, lt: end },
      },
    });
  }

  const oldStatusLabel = formatStatusLabel(attendance?.attendanceStatus);
  const newStatusLabel = formatStatusLabel(requestedDb);

  const record = await markEmployeeAttendance(prisma, authUser, {
    date,
    employeeCode: employee.employeeCode,
    statusApi: requestedStatus,
  });

  const correction = await prisma.attendanceCorrection.create({
    data: {
      employeeId: employee.id,
      attendanceId: typeof record.id === "number" ? record.id : attendance?.id || null,
      attendanceDate: toAttendanceDate(date),
      currentStatus: attendance?.attendanceStatus || null,
      requestedStatus: requestedDb,
      reason: trimmedReason,
      status: "Approved",
      approvedBy: authUser.id,
      createdBy: authUser.id,
      updatedBy: authUser.id,
    },
    include: {
      employee: true,
      creator: { select: { fullName: true } },
    },
  });

  await createAuditLog({
    employeeId: authUser.id,
    moduleName: "Attendance",
    actionType: "CORRECTION_APPROVED",
    oldValue: {
      status: oldStatusLabel,
      employeeCode: employee.employeeCode,
      attendanceDate: date,
    },
    newValue: {
      status: newStatusLabel,
      reason: trimmedReason,
      updatedBy: authUser.fullName || authUser.email,
      updatedAt: new Date().toISOString(),
      employeeCode: employee.employeeCode,
      attendanceDate: date,
    },
  });

  const mapped = await finalizeCorrectionRecord(correction, prisma);
  return { correction: mapped, record };
}

export async function approveAttendanceCorrection(prisma, authUser, correctionId) {
  const correction = await prisma.attendanceCorrection.findUnique({
    where: { id: correctionId },
    include: { employee: true },
  });
  if (!correction) throw new Error("Correction request not found");
  if (correction.status !== "Pending") {
    throw new Error("This correction has already been processed");
  }

  const dateStr = correction.attendanceDate.toISOString().split("T")[0];
  const requestedStatus = await resolveDbEnumToMarkApi(prisma, correction.requestedStatus);
  const record = await markEmployeeAttendance(prisma, authUser, {
    date: dateStr,
    employeeCode: correction.employee.employeeCode,
    statusApi: requestedStatus,
  });

  const updated = await prisma.attendanceCorrection.update({
    where: { id: correctionId },
    data: {
      status: "Approved",
      approvedBy: authUser.id,
      updatedBy: authUser.id,
      attendanceId: typeof record.id === "number" ? record.id : correction.attendanceId,
    },
    include: { employee: true, creator: { select: { fullName: true } } },
  });

  return {
    correction: await finalizeCorrectionRecord(updated, prisma),
    record,
  };
}

export async function rejectAttendanceCorrection(prisma, authUser, correctionId, rejectReason) {
  const correction = await prisma.attendanceCorrection.findUnique({ where: { id: correctionId } });
  if (!correction) throw new Error("Correction request not found");
  if (correction.status !== "Pending") {
    throw new Error("This correction has already been processed");
  }

  await prisma.attendanceCorrection.update({
    where: { id: correctionId },
    data: {
      status: "Rejected",
      reason: rejectReason
        ? `${correction.reason} (Rejected: ${String(rejectReason).trim()})`
        : correction.reason,
      approvedBy: authUser.id,
      updatedBy: authUser.id,
    },
  });
}
