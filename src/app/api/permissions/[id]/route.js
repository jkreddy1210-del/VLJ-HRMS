import { prisma } from "@/lib/prisma";
import { requireAuth, canManageRoles, forbiddenResponse } from "@/lib/auth-server";
import { createAuditLog } from "@/lib/audit";

export async function PATCH(request, { params }) {
  const { user, error } = await requireAuth(request);
  if (error) return error;
  if (!canManageRoles(user)) return forbiddenResponse();

  const id = parseInt(params.id, 10);
  const body = await request.json();
  const existing = await prisma.permission.findUnique({ where: { id } });

  const permission = await prisma.permission.update({
    where: { id },
    data: {
      permissionName: body.permissionName ?? existing.permissionName,
      moduleName: body.moduleName ?? existing.moduleName,
      updatedBy: user.id,
    },
  });

  await createAuditLog({
    userId: user.id,
    moduleName: "Roles & Permissions",
    actionType: "UPDATE",
    oldValue: existing,
    newValue: permission,
  });

  return Response.json({ permission });
}

export async function DELETE(request, { params }) {
  const { user, error } = await requireAuth(request);
  if (error) return error;
  if (!canManageRoles(user)) return forbiddenResponse();

  const id = parseInt(params.id, 10);
  const existing = await prisma.permission.findUnique({ where: { id } });
  await prisma.permission.delete({ where: { id } });

  await createAuditLog({
    userId: user.id,
    moduleName: "Roles & Permissions",
    actionType: "DELETE",
    oldValue: existing,
  });

  return Response.json({ success: true });
}
