import { prisma } from "@/lib/prisma";
import { requireAuth, canViewAttendance, forbiddenResponse, canManageEmployees } from "@/lib/auth-server";
import {
  computeMonthlyAttendanceStats,
  formatAttendanceReportHeader,
  getMonthIndexFromName,
  countSundaysInMonth,
} from "@/lib/attendance-monthly-report";

function buildEmployeeWhere(department, search, { requireActive = true } = {}) {
  const q = (search || "").trim();
  return {
    ...(requireActive ? { status: "Active" } : {}),
    ...(department && department !== "all"
      ? { department: { departmentName: department } }
      : {}),
    ...(q
      ? {
          OR: [
            { employeeCode: { contains: q } },
            { fullName: { contains: q } },
            { department: { departmentName: { contains: q } } },
          ],
        }
      : {}),
  };
}

function canAccessReport(user) {
  return (
    canViewAttendance(user) ||
    canManageEmployees(user) ||
    user.permissions?.includes("Generate Reports") ||
    user.permissions?.includes("View Team Reports") ||
    user.permissions?.includes("Full System Access") ||
    user.permissions?.includes("All Permissions")
  );
}

function mapSummaryRow(summary, sno) {
  return {
    sno,
    employeeId: summary.employeeId,
    employeeCode: summary.employeeCode || summary.employee?.employeeCode || "",
    employeeName: summary.employee?.fullName || summary.employeeCode,
    department: summary.employee?.department?.departmentName || "—",
    lateDays: summary.lateDays,
    fullDays: summary.fullDays,
    halfDays: summary.halfDays,
    sundays: summary.sundays,
    sundaysInMonth: countSundaysInMonth(summary.year, summary.month),
    totalPresentDays: summary.totalPresentDays,
    absentDays: summary.absentDays,
    source: "uploaded",
  };
}

export async function GET(request) {
  const { user, error } = await requireAuth(request);
  if (error) return error;
  if (!canAccessReport(user)) return forbiddenResponse();

  const { searchParams } = new URL(request.url);
  const monthName = searchParams.get("month");
  const year = Number(searchParams.get("year") || new Date().getFullYear());
  const department = searchParams.get("department") || "all";
  const search = searchParams.get("search") || "";

  const monthIndex = getMonthIndexFromName(monthName);
  if (!monthName || !monthIndex) {
    return Response.json({ error: "Valid month is required" }, { status: 400 });
  }
  if (Number.isNaN(year)) {
    return Response.json({ error: "Valid year is required" }, { status: 400 });
  }

  const rangeStart = new Date(year, monthIndex - 1, 1);
  const rangeEnd = new Date(year, monthIndex, 1);
  const employeeWhereActive = buildEmployeeWhere(department, search, { requireActive: true });
  const employeeWhereAny = buildEmployeeWhere(department, search, { requireActive: false });

  const [employees, attendanceRows, summaryRows, departmentRows] = await Promise.all([
    prisma.employee.findMany({
      where: employeeWhereActive,
      include: { department: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.attendance.findMany({
      where: {
        attendanceDate: { gte: rangeStart, lt: rangeEnd },
        employee: employeeWhereActive,
      },
      select: {
        employeeId: true,
        attendanceDate: true,
        attendanceStatus: true,
        lateMinutes: true,
        inTime: true,
      },
    }),
    prisma.attendanceMonthlySummary.findMany({
      where: {
        year,
        month: monthIndex,
        employee: employeeWhereAny,
      },
      include: {
        employee: { include: { department: true } },
      },
    }),
    prisma.department.findMany({ orderBy: { departmentName: "asc" } }),
  ]);

  const attendanceByEmployee = new Map();
  for (const row of attendanceRows) {
    if (!attendanceByEmployee.has(row.employeeId)) {
      attendanceByEmployee.set(row.employeeId, []);
    }
    attendanceByEmployee.get(row.employeeId).push(row);
  }

  const summaryByEmployee = new Map(summaryRows.map((row) => [row.employeeId, row]));
  const rowByEmployee = new Map();

  for (const summary of summaryRows) {
    rowByEmployee.set(summary.employeeId, mapSummaryRow(summary, 0));
  }

  for (const emp of employees) {
    if (rowByEmployee.has(emp.id)) continue;

    const records = attendanceByEmployee.get(emp.id) || [];
    const stats = computeMonthlyAttendanceStats(records, year, monthIndex);
    rowByEmployee.set(emp.id, {
      sno: 0,
      employeeId: emp.id,
      employeeCode: emp.employeeCode,
      employeeName: emp.fullName,
      department: emp.department?.departmentName || "—",
      ...stats,
      source: "computed",
    });
  }

  const rows = Array.from(rowByEmployee.values())
    .sort((a, b) => String(a.employeeName).localeCompare(String(b.employeeName)))
    .map((row, index) => ({ ...row, sno: index + 1 }));

  return Response.json({
    month: monthName,
    year,
    headerTitle: formatAttendanceReportHeader(monthName, year),
    department,
    search,
    rows,
    sources: {
      uploaded: rows.filter((r) => r.source === "uploaded").length,
      computed: rows.filter((r) => r.source === "computed").length,
    },
    departmentFilters: departmentRows.map((d) => ({
      value: d.departmentName,
      label: d.departmentName,
    })),
  });
}
