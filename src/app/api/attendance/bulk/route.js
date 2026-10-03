import { prisma } from "@/lib/prisma";
import { requireAuth, canMarkAttendance, forbiddenResponse, canEditAttendanceForDate } from "@/lib/auth-server";
import { isDateBeforeToday } from "@/lib/utils";
import { markEmployeeAttendance } from "@/lib/attendance-mark";

export async function POST(request) {
  const { user: authUser, error } = await requireAuth(request);
  if (error) return error;
  if (!canMarkAttendance(authUser)) return forbiddenResponse();

  try {
    const body = await request.json();
    const { date, entries } = body;

    if (!date) {
      return Response.json({ error: "Date is required" }, { status: 400 });
    }
    if (!Array.isArray(entries) || !entries.length) {
      return Response.json({ error: "Select at least one employee attendance to save" }, { status: 400 });
    }

    if (isDateBeforeToday(date) && !canEditAttendanceForDate(authUser, date)) {
      return Response.json(
        { error: "Previous date attendance is locked. Submit a correction request for approval." },
        { status: 403 }
      );
    }

    const results = [];
    const errors = [];

    for (const entry of entries) {
      if (!entry?.employeeCode || !entry?.status) continue;
      try {
        const record = await markEmployeeAttendance(prisma, authUser, {
          date,
          employeeCode: entry.employeeCode,
          statusApi: entry.status,
          inTime: entry.inTime,
          outTime: entry.outTime,
        });
        results.push(record);
      } catch (err) {
        errors.push({
          employeeCode: entry.employeeCode,
          error: err.message || "Failed to save",
        });
      }
    }

    if (!results.length && errors.length) {
      return Response.json(
        { error: errors[0]?.error || "Failed to save attendance", errors },
        { status: 400 }
      );
    }

    return Response.json({
      success: true,
      saved: results.length,
      failed: errors.length,
      records: results,
      errors,
    });
  } catch (err) {
    console.error("Bulk mark attendance error:", err);
    return Response.json({ error: err.message || "Failed to save attendance" }, { status: 500 });
  }
}
