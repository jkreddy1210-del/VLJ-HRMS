import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  canViewAttendance,
  canRequestAttendanceCorrection,
  forbiddenResponse,
} from "@/lib/auth-server";
import { isDateBeforeToday, getLocalDateString } from "@/lib/utils";
import {
  submitAttendanceCorrection,
  finalizeCorrectionRecord,
} from "@/lib/attendance-correction";
import { toAttendanceDate } from "@/lib/attendance-date";

export async function GET(request) {
  const { user, error } = await requireAuth(request);
  if (error) return error;
  if (!canViewAttendance(user)) return forbiddenResponse();

  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get("date");
  const status = searchParams.get("status") || "all";

  const where = {
    ...(dateStr ? { attendanceDate: toAttendanceDate(dateStr) } : {}),
    ...(status !== "all" ? { status } : {}),
  };

  const rows = await prisma.attendanceCorrection.findMany({
    where,
    include: {
      employee: true,
      creator: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const corrections = await Promise.all(rows.map((row) => finalizeCorrectionRecord(row, prisma)));

  return Response.json({ corrections });
}

export async function POST(request) {
  const { user, error } = await requireAuth(request);
  if (error) return error;
  if (!canRequestAttendanceCorrection(user)) return forbiddenResponse();

  try {
    const body = await request.json();
    const { date, employeeCode, requestedStatus, reason, attendanceId } = body;

    if (!isDateBeforeToday(date)) {
      return Response.json(
        { error: "Correction requests are only for previous dates. Edit today's attendance directly." },
        { status: 400 }
      );
    }

    if (date >= getLocalDateString()) {
      return Response.json({ error: "Correction requests are only for past dates" }, { status: 400 });
    }

    const result = await submitAttendanceCorrection(prisma, user, {
      date,
      employeeCode,
      requestedStatus,
      reason,
      attendanceId,
    });

    return Response.json({ success: true, ...result });
  } catch (err) {
    return Response.json({ error: err.message || "Failed to submit correction" }, { status: 400 });
  }
}
