import { requireAuth, canMarkAttendance, forbiddenResponse } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { getAttendanceMarkStatuses } from "@/lib/attendance-status-server";

export async function GET(request) {
  const { user, error } = await requireAuth(request);
  if (error) return error;
  if (!canMarkAttendance(user)) return forbiddenResponse();

  const statuses = await getAttendanceMarkStatuses(prisma);
  return Response.json({ statuses });
}
