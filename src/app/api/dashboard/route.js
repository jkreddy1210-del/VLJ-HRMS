import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-server";
import { buildEmployeeSelfDashboard } from "@/lib/employee-dashboard";

const IST = "Asia/Kolkata";

function getISTDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
  };
}

function istDayRange(offsetDays = 0) {
  const { year, month, day } = getISTDateParts();
  const d = new Date(Date.UTC(year, month - 1, day + offsetDays));
  const start = d;
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function istWeekdayLabel(dateUtc) {
  return dateUtc.toLocaleDateString("en-IN", { weekday: "short", timeZone: IST });
}

function istMonthLabel(year, monthIndex) {
  const d = new Date(Date.UTC(year, monthIndex, 1));
  return d.toLocaleDateString("en-IN", { month: "short", timeZone: IST });
}

function canViewOrgDashboard(user) {
  const perms = user?.permissions || [];
  return [
    "Employee Management",
    "User Management",
    "Attendance Monitoring",
    "Generate Reports",
    "Full System Access",
    "All Permissions",
  ].some((p) => perms.includes(p));
}

function canReviewLeavesOnDashboard(user) {
  const perms = user?.permissions || [];
  return [
    "Full System Access",
    "All Permissions",
    "Approve Any Leave",
    "Leave Approval",
    "Final Leave Approval",
    "View Leave Requests",
    "View Team Leave Requests",
  ].some((p) => perms.includes(p));
}

function canApproveLeavesOnDashboard(user) {
  const perms = user?.permissions || [];
  return [
    "Full System Access",
    "All Permissions",
    "Approve Any Leave",
    "Leave Approval",
    "Final Leave Approval",
    "View Team Leave Requests",
  ].some((p) => perms.includes(p));
}

async function getPendingLeavesForDashboard(user, limit = 10) {
  if (!canReviewLeavesOnDashboard(user)) {
    return { pendingLeaves: [], pendingLeaveTotal: 0, canApproveLeaves: false };
  }

  const include = {
    employee: { include: { department: true } },
    leaveType: true,
  };

  let where = { finalStatus: "Pending" };

  const perms = user.permissions || [];
  const seesAll =
    perms.includes("Full System Access") ||
    perms.includes("All Permissions") ||
    perms.includes("Approve Any Leave") ||
    perms.includes("View Leave Requests") ||
    perms.includes("Final Leave Approval") ||
    user.role === "hr" ||
    user.role === "admin" ||
    user.role === "super_admin";

  if (!seesAll && perms.includes("View Team Leave Requests") && user.employeeId) {
    const team = await prisma.employee.findMany({
      where: { reportingManagerId: user.employeeId },
      select: { id: true },
    });
    where = { ...where, employeeId: { in: team.map((t) => t.id) } };
  } else if (!seesAll) {
    return { pendingLeaves: [], pendingLeaveTotal: 0, canApproveLeaves: false };
  }

  const [rows, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      include,
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.leaveRequest.count({ where }),
  ]);

  return {
    pendingLeaves: rows.map((r) => ({
      id: r.id,
      employeeCode: r.employee.employeeCode,
      employeeName: r.employee.fullName,
      department: r.employee.department?.departmentName || "—",
      leaveType: r.leaveType.leaveName,
      from: r.fromDate.toISOString().split("T")[0],
      to: r.toDate.toISOString().split("T")[0],
      days: Number(r.totalDays),
      reason: r.reason || "",
      status: r.finalStatus,
      managerStatus: r.managerStatus,
      hrStatus: r.hrStatus,
      createdAt: r.createdAt.toISOString(),
    })),
    pendingLeaveTotal: total,
    canApproveLeaves: canApproveLeavesOnDashboard(user),
  };
}

async function buildOrgDashboard(user) {
  const { start: today, end: tomorrow } = istDayRange(0);

  const [totalEmployees, todayAttendance, recentAudits, leavePanel] = await Promise.all([
    prisma.employee.count({ where: { status: "Active" } }),
    prisma.attendance.findMany({
      where: { attendanceDate: { gte: today, lt: tomorrow } },
    }),
    prisma.auditLog.findMany({
      orderBy: { actionDate: "desc" },
      take: 5,
      include: { employee: true },
    }),
    getPendingLeavesForDashboard(user, 10),
  ]);

  const presentToday = todayAttendance.filter((a) =>
    ["Present", "Late", "Half_Day"].includes(a.attendanceStatus)
  ).length;
  const onLeave = todayAttendance.filter((a) => a.attendanceStatus === "Leave").length;
  const markedAbsent = todayAttendance.filter((a) => a.attendanceStatus === "Absent").length;
  const notMarked = Math.max(0, totalEmployees - todayAttendance.length);
  const absentToday = markedAbsent + notMarked;

  const weeklyAttendance = [];
  for (let i = 5; i >= 0; i--) {
    const { start, end } = istDayRange(-i);
    const dayRecords = await prisma.attendance.findMany({
      where: { attendanceDate: { gte: start, lt: end } },
    });
    const activeCount = await prisma.employee.count({ where: { status: "Active" } });
    const present = dayRecords.filter((r) =>
      ["Present", "Late", "Half_Day"].includes(r.attendanceStatus)
    ).length;
    const leave = dayRecords.filter((r) => r.attendanceStatus === "Leave").length;
    const absentMarked = dayRecords.filter((r) => r.attendanceStatus === "Absent").length;
    const notMarkedDay = Math.max(0, activeCount - dayRecords.length);

    weeklyAttendance.push({
      day: istWeekdayLabel(start),
      present,
      absent: absentMarked + notMarkedDay,
      leave,
    });
  }

  const departments = await prisma.department.findMany({ orderBy: { departmentName: "asc" } });
  const departmentAttendance = await Promise.all(
    departments.map(async (dept) => {
      const empCount = await prisma.employee.count({
        where: { departmentId: dept.id, status: "Active" },
      });
      const present = await prisma.attendance.count({
        where: {
          attendanceDate: { gte: today, lt: tomorrow },
          attendanceStatus: { in: ["Present", "Late", "Half_Day"] },
          employee: { departmentId: dept.id },
        },
      });
      return {
        department: dept.departmentName,
        present,
        total: empCount,
        percentage: empCount ? Math.round((present / empCount) * 100) : 0,
      };
    })
  );

  const { year, month } = getISTDateParts();
  const monthlyTrend = [];
  for (let i = 5; i >= 0; i--) {
    const monthIndex = month - 1 - i;
    const monthStart = new Date(Date.UTC(year, monthIndex, 1));
    const monthEnd = new Date(Date.UTC(year, monthIndex + 1, 1));
    const [activeInMonth, present] = await Promise.all([
      prisma.employee.count({
        where: {
          status: "Active",
          joiningDate: { lt: monthEnd },
        },
      }),
      prisma.attendance.count({
        where: {
          attendanceDate: { gte: monthStart, lt: monthEnd },
          attendanceStatus: { in: ["Present", "Late", "Half_Day"] },
        },
      }),
    ]);
    const workingDays = await prisma.attendance.groupBy({
      by: ["attendanceDate"],
      where: { attendanceDate: { gte: monthStart, lt: monthEnd } },
    });
    const expectedSlots = activeInMonth * Math.max(workingDays.length, 1);
    monthlyTrend.push({
      month: istMonthLabel(year, monthIndex),
      attendance: expectedSlots ? Math.round((present / expectedSlots) * 100) : 0,
      present,
      expected: expectedSlots,
    });
  }

  const recentActivities = recentAudits.map((log) => ({
    id: log.id,
    type: log.actionType.toLowerCase(),
    message: `${log.moduleName}: ${log.actionType}`,
    time: log.actionDate.toISOString(),
    icon: log.actionType === "CREATE" ? "user-plus" : log.actionType === "APPROVE" ? "check" : "edit",
  }));

  return {
    stats: { totalEmployees, presentToday, absentToday, onLeave, notMarked },
    weeklyAttendance,
    departmentAttendance,
    monthlyTrend,
    recentActivities,
    pendingLeaves: leavePanel.pendingLeaves,
    pendingLeaveTotal: leavePanel.pendingLeaveTotal,
    canApproveLeaves: leavePanel.canApproveLeaves,
  };
}

export async function GET(request) {
  const { user, error } = await requireAuth(request);
  if (error) return error;

  const showOrg = canViewOrgDashboard(user);
  const self = await buildEmployeeSelfDashboard(prisma, user.id);

  if (!showOrg) {
    return Response.json({
      mode: "self",
      self,
      user: { name: user.name },
    });
  }

  const org = await buildOrgDashboard(user);
  return Response.json({
    mode: "org",
    ...org,
    self,
    user: { name: user.name },
  });
}
