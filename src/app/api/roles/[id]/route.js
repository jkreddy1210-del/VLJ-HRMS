import { prisma } from "@/lib/prisma";
import { requireAuth, canManageRoles, forbiddenResponse } from "@/lib/auth-server";
import { createAuditLog } from "@/lib/audit";
import {
  mapRoleResponse,
  PROTECTED_ROLE_NAMES,
  slugifyRoleName,
} from "@/lib/role-utils";

const roleInclude = {
  rolePermissions: { include: { permission: true } },
  _count: { select: { employees: true } },
};

export async function PATCH(request, { params }) {
  const { user, error } = await requireAuth(request);
  if (error) return error;
  if (!canManageRoles(user)) return forbiddenResponse();

  const id = parseInt(params.id, 10);
  if (Number.isNaN(id)) {
    return Response.json({ error: "Invalid role id" }, { status: 400 });
  }

  const existing = await prisma.role.findUnique({
    where: { id },
    include: roleInclude,
  });
  if (!existing) {
    return Response.json({ error: "Role not found" }, { status: 404 });
  }

  const body = await request.json();
  const nextRoleName = body.roleName
    ? slugifyRoleName(body.roleName)
    : body.displayName
      ? slugifyRoleName(body.displayName)
      : null;

  if (nextRoleName && nextRoleName.length < 2) {
    return Response.json({ error: "Role name must be at least 2 characters." }, { status: 400 });
  }

  if (nextRoleName && nextRoleName !== existing.roleName) {
    const duplicate = await prisma.role.findUnique({ where: { roleName: nextRoleName } });
    if (duplicate) {
      return Response.json({ error: "A role with this name already exists." }, { status: 400 });
    }
  }

  const permissionIds = Array.isArray(body.permissionIds)
    ? [...new Set(body.permissionIds.map((pid) => parseInt(pid, 10)).filter((pid) => !Number.isNaN(pid)))]
    : null;

  if (permissionIds) {
    const validCount = await prisma.permission.count({
      where: { id: { in: permissionIds } },
    });
    if (validCount !== permissionIds.length) {
      return Response.json({ error: "One or more permissions are invalid." }, { status: 400 });
    }
  }

  try {
    const role = await prisma.$transaction(async (tx) => {
      if (nextRoleName && nextRoleName !== existing.roleName) {
        await tx.role.update({
          where: { id },
          data: { roleName: nextRoleName, updatedBy: user.id },
        });
      } else if (permissionIds) {
        await tx.role.update({
          where: { id },
          data: { updatedBy: user.id },
        });
      }

      if (permissionIds) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        if (permissionIds.length) {
          await tx.rolePermission.createMany({
            data: permissionIds.map((permissionId) => ({
              roleId: id,
              permissionId,
              createdBy: user.id,
            })),
          });
        }
      }

      return tx.role.findUnique({
        where: { id },
        include: roleInclude,
      });
    });

    await createAuditLog({
      userId: user.id,
      moduleName: "Roles & Permissions",
      actionType: "UPDATE",
      oldValue: {
        roleName: existing.roleName,
        permissions: existing.rolePermissions.map((rp) => rp.permission.permissionName),
      },
      newValue: {
        roleName: role.roleName,
        permissions: role.rolePermissions.map((rp) => rp.permission.permissionName),
      },
    });

    return Response.json({ role: mapRoleResponse(role) });
  } catch (err) {
    if (err.code === "P2002") {
      return Response.json({ error: "A role with this name already exists." }, { status: 400 });
    }
    throw err;
  }
}

export async function DELETE(request, { params }) {
  const { user, error } = await requireAuth(request);
  if (error) return error;
  if (!canManageRoles(user)) return forbiddenResponse();

  const id = parseInt(params.id, 10);
  if (Number.isNaN(id)) {
    return Response.json({ error: "Invalid role id" }, { status: 400 });
  }

  const existing = await prisma.role.findUnique({
    where: { id },
    include: { _count: { select: { employees: true } } },
  });
  if (!existing) {
    return Response.json({ error: "Role not found" }, { status: 404 });
  }

  if (PROTECTED_ROLE_NAMES.includes(existing.roleName)) {
    return Response.json({ error: "This system role cannot be deleted." }, { status: 400 });
  }

  if (existing._count.employees > 0) {
    return Response.json(
      { error: `Cannot delete role assigned to ${existing._count.employees} employee(s).` },
      { status: 400 }
    );
  }

  await prisma.rolePermission.deleteMany({ where: { roleId: id } });
  await prisma.role.delete({ where: { id } });

  await createAuditLog({
    userId: user.id,
    moduleName: "Roles & Permissions",
    actionType: "DELETE",
    oldValue: { roleName: existing.roleName },
  });

  return Response.json({ success: true });
}
