import { prisma } from "@/lib/prisma";
import { requireAuth, canManageRoles, forbiddenResponse } from "@/lib/auth-server";
import { createAuditLog } from "@/lib/audit";
import { mapRoleResponse, slugifyRoleName } from "@/lib/role-utils";

const roleInclude = {
  rolePermissions: { include: { permission: true } },
  _count: { select: { employees: true } },
};

export async function GET(request) {
  const { user, error } = await requireAuth(request);
  if (error) return error;
  if (!canManageRoles(user)) return forbiddenResponse();

  const roles = await prisma.role.findMany({
    include: roleInclude,
    orderBy: { id: "asc" },
  });

  return Response.json({
    roles: roles.map(mapRoleResponse),
    canManage: canManageRoles(user),
  });
}

export async function POST(request) {
  const { user, error } = await requireAuth(request);
  if (error) return error;
  if (!canManageRoles(user)) return forbiddenResponse();

  const body = await request.json();
  const roleName = slugifyRoleName(body.roleName || body.displayName);

  if (!roleName || roleName.length < 2) {
    return Response.json({ error: "Role name must be at least 2 characters." }, { status: 400 });
  }

  const permissionIds = Array.isArray(body.permissionIds)
    ? [...new Set(body.permissionIds.map((pid) => parseInt(pid, 10)).filter((pid) => !Number.isNaN(pid)))]
    : [];

  if (permissionIds.length) {
    const validCount = await prisma.permission.count({
      where: { id: { in: permissionIds } },
    });
    if (validCount !== permissionIds.length) {
      return Response.json({ error: "One or more permissions are invalid." }, { status: 400 });
    }
  }

  try {
    const role = await prisma.$transaction(async (tx) => {
      const created = await tx.role.create({
        data: {
          roleName,
          createdBy: user.id,
        },
      });

      if (permissionIds.length) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            roleId: created.id,
            permissionId,
            createdBy: user.id,
          })),
        });
      }

      return tx.role.findUnique({
        where: { id: created.id },
        include: roleInclude,
      });
    });

    await createAuditLog({
      userId: user.id,
      moduleName: "Roles & Permissions",
      actionType: "CREATE",
      newValue: {
        roleName: role.roleName,
        permissions: role.rolePermissions.map((rp) => rp.permission.permissionName),
      },
    });

    return Response.json({ role: mapRoleResponse(role) }, { status: 201 });
  } catch (err) {
    if (err.code === "P2002") {
      return Response.json({ error: "A role with this name already exists." }, { status: 400 });
    }
    throw err;
  }
}
