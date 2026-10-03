import { combineDateAndTime } from "@/lib/attendance-date";

export function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const [hours, minutes] = String(timeStr).split(":").map(Number);
  if ([hours, minutes].some((n) => Number.isNaN(n))) return null;
  return hours * 60 + minutes;
}

export function formatShiftTime12h(timeStr) {
  if (!timeStr) return "—";
  const minutes = parseTimeToMinutes(timeStr);
  if (minutes == null) return "—";
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${String(hours12).padStart(2, "0")}:${String(mins).padStart(2, "0")} ${period}`;
}

export function formatShiftTimeShort(timeStr) {
  if (!timeStr) return "—";
  const [hours, minutes] = timeStr.split(":");
  if (!hours || minutes == null) return "—";
  return `${hours}:${minutes}`;
}

export function mapShiftRecord(shift) {
  if (!shift) return null;
  return {
    id: shift.id,
    departmentId: shift.departmentId,
    departmentName: shift.department?.departmentName || null,
    shiftName: shift.shiftName,
    startTime: shift.startTime,
    endTime: shift.endTime,
    startTimeDisplay: formatShiftTime12h(shift.startTime),
    endTimeDisplay: formatShiftTime12h(shift.endTime),
    graceMinutes: shift.graceMinutes,
    graceDisplay: `${shift.graceMinutes} Min`,
    status: shift.status,
    statusLabel: shift.status === "Active" ? "Active" : "Inactive",
  };
}

export async function getActiveShiftForDepartment(prisma, departmentId) {
  if (!departmentId) return null;
  return prisma.departmentShift.findFirst({
    where: { departmentId, status: "Active" },
    include: { department: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getActiveShiftsByDepartmentIds(prisma, departmentIds) {
  const ids = [...new Set((departmentIds || []).filter(Boolean))];
  if (!ids.length) return new Map();

  const shifts = await prisma.departmentShift.findMany({
    where: { departmentId: { in: ids }, status: "Active" },
    include: { department: true },
    orderBy: { updatedAt: "desc" },
  });

  const map = new Map();
  for (const shift of shifts) {
    if (!map.has(shift.departmentId)) {
      map.set(shift.departmentId, shift);
    }
  }
  return map;
}

export async function assertSingleActiveShift(prisma, departmentId, excludeId = null) {
  const existing = await prisma.departmentShift.findFirst({
    where: {
      departmentId,
      status: "Active",
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
  if (existing) {
    throw new Error("This department already has an active shift");
  }
}

export function validateShiftPayload(body, { partial = false } = {}) {
  const errors = [];
  const departmentId = body.departmentId != null ? Number(body.departmentId) : undefined;
  const shiftName = body.shiftName?.trim();
  const startTime = body.startTime?.trim();
  const endTime = body.endTime?.trim();
  const graceMinutes =
    body.graceMinutes != null && body.graceMinutes !== "" ? Number(body.graceMinutes) : undefined;
  const status = body.status;

  if (!partial || body.departmentId != null) {
    if (!departmentId || Number.isNaN(departmentId)) {
      errors.push("Department is required");
    }
  }
  if (!partial || body.shiftName != null) {
    if (!shiftName) errors.push("Shift name is required");
  }
  if (!partial || body.startTime != null) {
    if (!startTime || parseTimeToMinutes(startTime) == null) {
      errors.push("Valid start time is required");
    }
  }
  if (!partial || body.endTime != null) {
    if (!endTime || parseTimeToMinutes(endTime) == null) {
      errors.push("Valid end time is required");
    }
  }
  if (!partial || body.graceMinutes != null) {
    if (graceMinutes == null || Number.isNaN(graceMinutes) || graceMinutes < 0) {
      errors.push("Grace time must be zero or greater");
    }
  }
  if (status != null && status !== "Active" && status !== "Inactive") {
    errors.push("Status must be Active or Inactive");
  }

  if (startTime && endTime && parseTimeToMinutes(startTime) != null && parseTimeToMinutes(endTime) != null) {
    if (parseTimeToMinutes(endTime) <= parseTimeToMinutes(startTime)) {
      errors.push("End time must be after start time");
    }
  }

  return {
    errors,
    data: {
      departmentId,
      shiftName,
      startTime,
      endTime,
      graceMinutes: graceMinutes ?? 0,
      status: status === "Inactive" ? "Inactive" : "Active",
    },
  };
}

export function getInTimeMinutes(inTimeDate) {
  if (!inTimeDate) return null;
  const d = inTimeDate instanceof Date ? inTimeDate : new Date(inTimeDate);
  if (Number.isNaN(d.getTime())) return null;
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Compare in-time against department shift start + grace.
 * Status remains Present; lateness is stored in lateMinutes + remark.
 */
export function calculateShiftLateMetrics(shift, inTimeDate) {
  if (!shift || !inTimeDate) {
    return {
      lateMinutes: null,
      remark: null,
      shiftTime: shift ? formatShiftTimeShort(shift.startTime) : "—",
    };
  }

  const startMinutes = parseTimeToMinutes(shift.startTime);
  const inMinutes = getInTimeMinutes(inTimeDate);
  if (startMinutes == null || inMinutes == null) {
    return {
      lateMinutes: null,
      remark: null,
      shiftTime: formatShiftTimeShort(shift.startTime),
    };
  }

  const allowedMinutes = startMinutes + (shift.graceMinutes || 0);
  const lateMinutes = inMinutes > allowedMinutes ? inMinutes - allowedMinutes : 0;

  return {
    lateMinutes,
    remark: lateMinutes > 0 ? "Late Coming" : "On Time",
    shiftTime: formatShiftTimeShort(shift.startTime),
  };
}

export function resolveAttendanceShiftDisplay(shift, attendance) {
  const shiftTime = shift ? formatShiftTimeShort(shift.startTime) : "—";

  if (!attendance?.inTime) {
    return { shiftTime, lateMinutes: null, remark: null };
  }

  const statusesWithInTime = ["Present", "Late", "Half_Day"];
  if (!statusesWithInTime.includes(attendance.attendanceStatus)) {
    return { shiftTime, lateMinutes: null, remark: null };
  }

  if (attendance.lateMinutes != null && attendance.attendanceRemark) {
    return {
      shiftTime,
      lateMinutes: attendance.lateMinutes,
      remark: attendance.attendanceRemark,
    };
  }

  return calculateShiftLateMetrics(shift, attendance.inTime);
}

export function buildLateMetricsForSave(shift, inTimeDate, attendanceStatus) {
  const statusesWithInTime = ["Present", "Late", "Half_Day"];
  if (!statusesWithInTime.includes(attendanceStatus) || !inTimeDate) {
    return { lateMinutes: null, attendanceRemark: null };
  }
  const metrics = calculateShiftLateMetrics(shift, inTimeDate);
  return {
    lateMinutes: metrics.lateMinutes,
    attendanceRemark: metrics.remark,
  };
}

export function getMonthDateRange(year, month) {
  const y = Number(year);
  const m = Number(month);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  return { start, end };
}
