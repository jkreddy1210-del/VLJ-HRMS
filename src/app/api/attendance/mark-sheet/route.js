import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  canMarkAttendance,
  canViewAttendance,
  forbiddenResponse,
  canEditAttendanceForDate,
  canRequestAttendanceCorrection,
} from "@/lib/auth-server";
import { getAttendanceDayRange, toTimeInputValue, toAttendanceDate } from "@/lib/attendance-date";
import { isDateBeforeToday } from "@/lib/utils";
import { finalizeCorrectionRecord } from "@/lib/attendance-correction";
import {
  getAttendanceMarkStatuses,
  getAttendanceListFilters,
  resolveFilterStatusToDb,
} from "@/lib/attendance-status-server";
import { buildDepartmentFilterOptions } from "@/lib/lookups";
import { parsePagination, buildListPagination } from "@/lib/pagination";
import { buildAbsentMarkRow, statusLabelFromDbEnum } from "@/lib/attendance-mark";
import { getActiveShiftsByDepartmentIds, resolveAttendanceShiftDisplay } from "@/lib/shift-server";

function mapMarkSheetRow(emp, attendanceByEmployeeId, statusByCode, latestCorrectionByEmployeeId, shiftMap) {
  const att = attendanceByEmployeeId.get(emp.id);
  const latestCorrection = latestCorrectionByEmployeeId.get(emp.id) || null;
  const shift = shiftMap.get(emp.departmentId) || null;

  if (!att) {
    return {
      ...buildAbsentMarkRow(emp, shift),
      attendanceId: null,
      markStatusValue: null,
      statusLabel: "Not Marked",
      badgeVariant: "outline",
      correctionReason: latestCorrection?.reason || null,
      correctionNote: latestCorrection
        ? `${latestCorrection.requestedStatus} — ${latestCorrection.reason}`
        : null,
    };
  }

  const markStatusValue = [...statusByCode.values()].find((s) => s.dbEnum === att.attendanceStatus)?.value || null;
  const statusMeta = markStatusValue ? statusByCode.get(markStatusValue) : null;
  const shiftDisplay = resolveAttendanceShiftDisplay(shift, att);

  return {
    id: att.id,
    attendanceId: att.id,
    employeeId: emp.id,
    employeeCode: emp.employeeCode,
    employeeName: emp.fullName,
    department: emp.department?.departmentName || "—",
    status: statusLabelFromDbEnum(att.attendanceStatus),
    statusLabel: statusMeta?.label || statusLabelFromDbEnum(att.attendanceStatus),
    markStatusValue,
    badgeVariant: statusMeta?.badgeVariant || "secondary",
    inTime: att.inTime
      ? new Date(att.inTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
      : null,
    inTimeInput: toTimeInputValue(att.inTime),
    outTime: att.outTime
      ? new Date(att.outTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
      : "—",
    outTimeInput: toTimeInputValue(att.outTime),
    shiftTime: shiftDisplay.shiftTime,
    lateMinutes: shiftDisplay.lateMinutes,
    attendanceRemark: shiftDisplay.remark,
    isAbsent: false,
    correctionReason: latestCorrection?.reason || null,
    correctionNote: latestCorrection
      ? `${latestCorrection.requestedStatus} — ${latestCorrection.reason}`
      : null,
  };
}

function buildEmployeeSearchWhere(search) {
  const q = (search || "").trim();
  if (!q) return {};
  return {
    OR: [
      { employeeCode: { contains: q } },
      { fullName: { contains: q } },
      { department: { departmentName: { contains: q } } },
    ],
  };
}

export async function GET(request) {
  const { user, error } = await requireAuth(request);
  if (error) return error;
  if (!canViewAttendance(user)) return forbiddenResponse();

  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0];
  const department = searchParams.get("department") || "all";
  const statusFilter = searchParams.get("status") || "all";
  const search = searchParams.get("search") || "";
  const { page, limit, skip } = parsePagination(searchParams);
  const { start, end } = getAttendanceDayRange(dateStr);

  const [departmentRows, markStatuses, statusFilters, markedDbEnums] = await Promise.all([
    prisma.department.findMany({ orderBy: { departmentName: "asc" } }),
    getAttendanceMarkStatuses(prisma),
    getAttendanceListFilters(prisma),
    prisma.attendanceStatusSetting
      .findMany({ where: { isActive: true }, select: { dbEnum: true } })
      .then((rows) => (rows.length ? rows.map((r) => r.dbEnum) : ["Present", "Absent", "Half_Day", "Leave", "Late"])),
  ]);

  const departmentOptions = departmentRows.map((d) => ({
    id: d.id,
    value: d.departmentName,
    label: d.departmentName,
    departmentName: d.departmentName,
  }));

  const employeeWhere = {
    status: "Active",
    ...(department && department !== "all"
      ? { department: { departmentName: department } }
      : {}),
    ...buildEmployeeSearchWhere(search),
  };

  const [attendanceRows, markedCount, dateCorrections] = await Promise.all([
    prisma.attendance.findMany({
      where: {
        attendanceDate: { gte: start, lt: end },
        attendanceStatus: { in: markedDbEnums },
      },
      include: { employee: { include: { department: true } } },
    }),
    prisma.attendance.count({
      where: {
        attendanceDate: { gte: start, lt: end },
        attendanceStatus: { in: markedDbEnums },
      },
    }),
    prisma.attendanceCorrection.findMany({
      where: {
        attendanceDate: toAttendanceDate(dateStr),
        status: "Approved",
      },
      include: {
        employee: true,
        creator: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const latestByEmployeeId = new Map();
  const correctionReasons = [];
  for (const correction of dateCorrections) {
    const mapped = await finalizeCorrectionRecord(correction, prisma);
    if (!latestByEmployeeId.has(correction.employeeId)) {
      latestByEmployeeId.set(correction.employeeId, mapped);
    }
    correctionReasons.push(mapped);
  }

  const attendanceByEmployeeId = new Map(attendanceRows.map((row) => [row.employeeId, row]));
  const statusByCode = new Map(markStatuses.map((s) => [s.value, s]));

  const filterDb = statusFilter !== "all" ? await resolveFilterStatusToDb(prisma, statusFilter) : null;
  const isAbsentFilter = statusFilter === "Absent";

  let employees = [];
  let totalEmployees = 0;

  if (isAbsentFilter) {
    const markedOtherIds = attendanceRows
      .filter((row) => row.attendanceStatus !== "Absent")
      .map((row) => row.employeeId);
    const absentWhere = {
      ...employeeWhere,
      ...(markedOtherIds.length ? { id: { notIn: markedOtherIds } } : {}),
    };
    [employees, totalEmployees] = await Promise.all([
      prisma.employee.findMany({
        where: absentWhere,
        include: { department: true },
        orderBy: { fullName: "asc" },
        skip,
        take: limit,
      }),
      prisma.employee.count({ where: absentWhere }),
    ]);
  } else if (filterDb) {
    const statusMeta = markStatuses.find((s) => s.dbEnum === filterDb);
    const matchedEmployeeIds = attendanceRows
      .filter((row) => row.attendanceStatus === filterDb)
      .map((row) => row.employeeId);
    const statusWhere = {
      ...employeeWhere,
      id: { in: matchedEmployeeIds.length ? matchedEmployeeIds : [-1] },
    };
    [employees, totalEmployees] = await Promise.all([
      prisma.employee.findMany({
        where: statusWhere,
        include: { department: true },
        orderBy: { fullName: "asc" },
        skip,
        take: limit,
      }),
      prisma.employee.count({ where: statusWhere }),
    ]);
  } else {
    [employees, totalEmployees] = await Promise.all([
      prisma.employee.findMany({
        where: employeeWhere,
        include: { department: true },
        orderBy: { fullName: "asc" },
        skip,
        take: limit,
      }),
      prisma.employee.count({ where: employeeWhere }),
    ]);
  }

  const shiftMap = await getActiveShiftsByDepartmentIds(
    prisma,
    employees.map((emp) => emp.departmentId)
  );

  const rows = employees.map((emp) =>
    mapMarkSheetRow(emp, attendanceByEmployeeId, statusByCode, latestByEmployeeId, shiftMap)
  );

  const isLocked = isDateBeforeToday(dateStr);
  const canEdit = canEditAttendanceForDate(user, dateStr);

  const activeCount = await prisma.employee.count({ where: { status: "Active" } });

  return Response.json({
    date: dateStr,
    rows,
    statuses: markStatuses,
    statusFilters,
    departmentFilters: buildDepartmentFilterOptions(departmentOptions),
    markedCount,
    absentCount: Math.max(0, activeCount - markedCount),
    canMark: canMarkAttendance(user),
    isLocked,
    canEdit,
    canRequestCorrection: canRequestAttendanceCorrection(user),
    correctionReasons,
    pagination: buildListPagination({ page, limit, total: totalEmployees }),
  });
}
