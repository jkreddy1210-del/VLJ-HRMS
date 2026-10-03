import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  canApproveAttendanceCorrection,
  forbiddenResponse,
} from "@/lib/auth-server";
import {
  approveAttendanceCorrection,
  rejectAttendanceCorrection,
} from "@/lib/attendance-correction";

export async function PATCH(request, { params }) {
  const { user, error } = await requireAuth(request);
  if (error) return error;
  if (!canApproveAttendanceCorrection(user)) {
    return Response.json(
      { error: "Only Super Admin can approve attendance corrections" },
      { status: 403 }
    );
  }

  try {
    const id = parseInt(params.id, 10);
    if (!id) return Response.json({ error: "Invalid correction id" }, { status: 400 });

    const body = await request.json();
    const { action, rejectReason } = body;

    if (action === "approve") {
      const result = await approveAttendanceCorrection(prisma, user, id);
      return Response.json({ success: true, ...result });
    }

    if (action === "reject") {
      await rejectAttendanceCorrection(prisma, user, id, rejectReason);
      return Response.json({ success: true });
    }

    return Response.json({ error: "Invalid action. Use approve or reject." }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err.message || "Failed to process correction" }, { status: 400 });
  }
}
