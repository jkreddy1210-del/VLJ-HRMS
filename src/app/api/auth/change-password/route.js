import { prisma } from "@/lib/prisma";
import { requireAuth, hashPassword, verifyPassword } from "@/lib/auth-server";
import { createAuditLog } from "@/lib/audit";

export async function POST(request) {
  const { user, error } = await requireAuth(request);
  if (error) return error;

  try {
    const { currentPassword, newPassword, confirmPassword } = await request.json();

    if (!currentPassword?.trim()) {
      return Response.json({ error: "Current password is required", field: "currentPassword" }, { status: 400 });
    }
    if (!newPassword?.trim() || newPassword.length < 6) {
      return Response.json(
        { error: "New password must be at least 6 characters", field: "newPassword" },
        { status: 400 }
      );
    }
    if (newPassword !== confirmPassword) {
      return Response.json({ error: "New passwords do not match", field: "confirmPassword" }, { status: 400 });
    }
    if (currentPassword === newPassword) {
      return Response.json(
        { error: "New password must be different from current password", field: "newPassword" },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.findUnique({
      where: { id: user.id },
      select: { id: true, passwordHash: true },
    });

    if (!employee) {
      return Response.json({ error: "Account not found" }, { status: 404 });
    }

    const valid = await verifyPassword(currentPassword, employee.passwordHash);
    if (!valid) {
      return Response.json({ error: "Current password is incorrect", field: "currentPassword" }, { status: 400 });
    }

    const passwordHash = await hashPassword(newPassword);

    await prisma.employee.update({
      where: { id: employee.id },
      data: { passwordHash },
    });

    await createAuditLog({
      userId: user.id,
      moduleName: "Authentication",
      actionType: "UPDATE",
      newValue: { action: "Password Changed" },
    });

    return Response.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("Change password error:", err);
    return Response.json({ error: "Failed to change password" }, { status: 500 });
  }
}
