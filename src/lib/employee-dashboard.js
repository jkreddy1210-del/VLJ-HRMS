import { getAttendanceDayRange, getLocalDateString } from "@/lib/attendance-date";
import { getEmployeeLeaveBalanceSummary } from "@/lib/leave-balance-server";
import { getActiveShiftForDepartment, formatShiftTime12h } from "@/lib/shift-server";

function statusLabel(status) {
  if (!status) return "Not Marked";
  return String(status).replace(/_/g, " ");
}

function toHhMm(value) {
  if (!value) return "—";
  return value.toISOString().slice(11, 16);
}

export async function buildEmployeeSelfDashboard(prisma, employeeId) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { department: true, designation: true },
  });

  if (!employee) return null;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthStart = new Date(Date.UTC(year, month, 1));
  const monthEnd = new Date(Date.UTC(year, month + 1, 1));
  const todayStr = getLocalDateString();
  const { start: todayStart, end: todayEnd } = getAttendanceDayRange(todayStr);

  const [todayRow, monthRows, recentRows, pendingLeaves, leaveSummary, shift] =
    await Promise.all([
      prisma.attendance.findFirst({
        where: {
          employeeId,
          attendanceDate: { gte: todayStart, lt: todayEnd },
        },
      }),
      prisma.attendance.findMany({
        where: {
          employeeId,
          attendanceDate: { gte: monthStart, lt: monthEnd },
        },
        select: { attendanceStatus: true },
      }),
      prisma.attendance.findMany({
        where: { employeeId },
        orderBy: { attendanceDate: "desc" },
        take: 10,
      }),
      prisma.leaveRequest.findMany({
        where: { employeeId, finalStatus: "Pending" },
        include: { leaveType: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      getEmployeeLeaveBalanceSummary(prisma, employeeId, year),
      getActiveShiftForDepartment(prisma, employee.departmentId),
    ]);

  const monthStats = {
    present: 0,
    late: 0,
    absent: 0,
    leave: 0,
    halfDay: 0,
  };
  for (const row of monthRows) {
    if (row.attendanceStatus === "Present") monthStats.present += 1;
    else if (row.attendanceStatus === "Late") monthStats.late += 1;
    else if (row.attendanceStatus === "Absent") monthStats.absent += 1;
    else if (row.attendanceStatus === "Leave") monthStats.leave += 1;
    else if (row.attendanceStatus === "Half_Day") monthStats.halfDay += 1;
  }

  const leaveBalances = Object.entries(leaveSummary.leaveTypeBalances || {}).map(
    ([name, bal]) => ({
      name,
      total: bal.total,
      used: bal.used,
      remaining: bal.remaining,
      pending: bal.pending,
      available: bal.available,
    })
  );

  return {
    profile: {
      id: employee.id,
      name: employee.fullName,
      employeeCode: employee.employeeCode,
      department: employee.department?.departmentName || "—",
      designation: employee.designation?.designationName || "—",
    },
    todayStatus: statusLabel(todayRow?.attendanceStatus),
    todayInTime: toHhMm(todayRow?.inTime),
    todayOutTime: toHhMm(todayRow?.outTime),
    shift: shift
      ? {
          name: shift.shiftName,
          startTime: formatShiftTime12h(shift.startTime),
          endTime: formatShiftTime12h(shift.endTime),
        }
      : null,
    monthStats,
    leaveBalances,
    pendingLeaves: pendingLeaves.map((l) => ({
      id: l.id,
      type: l.leaveType?.leaveName || "—",
      from: l.fromDate.toISOString().split("T")[0],
      to: l.toDate.toISOString().split("T")[0],
      days: Number(l.totalDays),
      status: l.finalStatus,
    })),
    recentAttendance: recentRows.map((a) => ({
      date: a.attendanceDate.toISOString().split("T")[0],
      status: statusLabel(a.attendanceStatus),
      inTime: toHhMm(a.inTime),
      outTime: toHhMm(a.outTime),
    })),
  };
}
