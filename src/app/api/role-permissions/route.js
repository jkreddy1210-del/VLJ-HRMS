import { prisma } from "@/lib/prisma";
import { requireAuth, canManageRoles, forbiddenResponse } from "@/lib/auth-server";
import { createAuditLog } from "@/lib/audit";

export async function POST(request) {
  const { user, error } = await requireAuth(request);
  if (error) return error;
  if (!canManageRoles(user)) return forbiddenResponse();

  const { roleId, permissionId } = await request.json();

  const rp = await prisma.rolePermission.upsert({
    where: { roleId_permissionId: { roleId, permissionId } },
    create: { roleId, permissionId, createdBy: user.id },
    update: { updatedBy: user.id },
    include: { role: true, permission: true },
  });

  await createAuditLog({
    userId: user.id,
    moduleName: "Roles & Permissions",
    actionType: "CREATE",
    newValue: { role: rp.role.roleName, permission: rp.permission.permissionName },
  });

  return Response.json({ rolePermission: rp });
}

export async function DELETE(request) {
  const { user, error } = await requireAuth(request);
  if (error) return error;
  if (!canManageRoles(user)) return forbiddenResponse();

  const { roleId, permissionId } = await request.json();

  const existing = await prisma.rolePermission.findUnique({
    where: { roleId_permissionId: { roleId, permissionId } },
    include: { role: true, permission: true },
  });

  await prisma.rolePermission.delete({
    where: { roleId_permissionId: { roleId, permissionId } },
  });

  await createAuditLog({
    userId: user.id,
    moduleName: "Roles & Permissions",
    actionType: "DELETE",
    oldValue: existing ? { role: existing.role.roleName, permission: existing.permission.permissionName } : null,
  });

  return Response.json({ success: true });
}
