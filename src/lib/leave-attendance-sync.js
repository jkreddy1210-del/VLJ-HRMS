import { syncLeaveBalances } from "@/lib/leave-balance-server";
import { createNotification } from "@/lib/notifications";
import { getAttendanceDayRange, toAttendanceDate } from "@/lib/attendance-date";

function dateKey(value) {
  return value.toISOString().split("T")[0];
}

/**
 * When attendance is marked Present/Half_Day on a day with approved leave,
 * cancel single-day leave or reduce multi-day leave by 1 and restore balance.
 */
export async function adjustLeaveForWorkAttendance(prisma, employeeId, dateStr, updatedBy) {
  const attendanceDate = toAttendanceDate(dateStr);
  const dayKey = dateKey(attendanceDate);
  const year = attendanceDate.getUTCFullYear();

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      employeeId,
      finalStatus: "Approved",
      fromDate: { lte: attendanceDate },
      toDate: { gte: attendanceDate },
    },
    include: { leaveType: true },
  });

  if (!leaves.length) return;

  let adjusted = false;

  for (const leave of leaves) {
    const fromKey = dateKey(leave.fromDate);
    const toKey = dateKey(leave.toDate);
    const totalDays = Number(leave.totalDays);
    const note = `Attendance marked present on ${dayKey}`;

    if (fromKey === toKey && fromKey === dayKey) {
      await prisma.leaveRequest.update({
        where: { id: leave.id },
        data: {
          finalStatus: "Rejected",
          managerStatus: "Rejected",
          hrStatus: "Rejected",
          updatedBy,
          reason: leave.reason ? `${leave.reason} | ${note} — leave cancelled` : `${note} — leave cancelled`,
        },
      });
      adjusted = true;
      continue;
    }

    if (totalDays <= 1) {
      await prisma.leaveRequest.update({
        where: { id: leave.id },
        data: {
          finalStatus: "Rejected",
          managerStatus: "Rejected",
          hrStatus: "Rejected",
          updatedBy,
          reason: leave.reason ? `${leave.reason} | ${note} — leave cancelled` : `${note} — leave cancelled`,
        },
      });
      adjusted = true;
      continue;
    }

    await prisma.leaveRequest.update({
      where: { id: leave.id },
      data: {
        totalDays: totalDays - 1,
        updatedBy,
        reason: leave.reason
          ? `${leave.reason} | ${note} — 1 day deducted from leave`
          : `${note} — 1 day deducted from leave`,
      },
    });
    adjusted = true;
  }

  if (adjusted) {
    await syncLeaveBalances(prisma, employeeId, year);
    await createNotification({
      employeeId,
      title: "Leave Updated",
      message: `Your approved leave for ${dayKey} was updated because you were marked present in attendance.`,
      module: "Leave Management",
    });
  }
}

/**
 * Employee IDs that should display as On Leave today (approved leave minus present attendance).
 */
export async function getEmployeeIdsOnLeaveToday(prisma, dateStr) {
  const { start, end } = getAttendanceDayRange(dateStr || new Date());

  const requests = await prisma.leaveRequest.findMany({
    where: {
      finalStatus: "Approved",
      fromDate: { lte: start },
      toDate: { gte: start },
    },
    select: { employeeId: true },
  });

  const leaveIds = new Set(requests.map((r) => r.employeeId));
  if (!leaveIds.size) return new Set();

  const workedToday = await prisma.attendance.findMany({
    where: {
      employeeId: { in: [...leaveIds] },
      attendanceDate: { gte: start, lt: end },
      attendanceStatus: { in: ["Present", "Half_Day"] },
    },
    select: { employeeId: true },
  });

  const workedIds = new Set(workedToday.map((a) => a.employeeId));
  return new Set([...leaveIds].filter((id) => !workedIds.has(id)));
}
