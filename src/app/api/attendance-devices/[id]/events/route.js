import { prisma } from "@/lib/prisma";
import { requireAuth, canViewAttendance, forbiddenResponse } from "@/lib/auth-server";

export async function GET(request, { params }) {
  const { user, error } = await requireAuth(request);
  if (error) return error;
  if (!canViewAttendance(user)) return forbiddenResponse();

  const attendanceDeviceId = Number(params.id);
  if (!Number.isInteger(attendanceDeviceId) || attendanceDeviceId <= 0) {
    return Response.json({ error: "Invalid device ID" }, { status: 400 });
  }
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const limitRaw = Number(searchParams.get("limit") || 100);
  const take = Number.isInteger(limitRaw) ? Math.max(1, Math.min(limitRaw, 200)) : 100;
  const events = await prisma.deviceAttendanceEvent.findMany({
    where: { attendanceDeviceId, ...(status ? { processingStatus: status } : {}) },
    orderBy: { occurredAt: "desc" },
    take,
    select: {
      id: true, attendanceDeviceId: true, deviceEmployeeId: true, externalEventId: true,
      occurredAt: true, eventType: true, processingStatus: true, errorMessage: true,
      processedAt: true, createdAt: true,
    },
  });
  return Response.json({ events });
}
