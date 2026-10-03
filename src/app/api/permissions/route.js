import { prisma } from "@/lib/prisma";
import { requireAuth, canManageRoles, forbiddenResponse } from "@/lib/auth-server";
import { createAuditLog } from "@/lib/audit";

export async function GET(request) {
  const { user, error } = await requireAuth(request);
  if (error) return error;
  if (!canManageRoles(user)) return forbiddenResponse();

  const permissions = await prisma.permission.findMany({
    orderBy: [{ moduleName: "asc" }, { permissionName: "asc" }],
  });

  return Response.json({ permissions });
}

export async function POST(request) {
  const { user, error } = await requireAuth(request);
  if (error) return error;
  if (!canManageRoles(user)) return forbiddenResponse();

  const body = await request.json();
  const permission = await prisma.permission.create({
    data: {
      permissionName: body.permissionName,
      moduleName: body.moduleName,
      createdBy: user.id,
    },
  });

  await createAuditLog({
    userId: user.id,
    moduleName: "Roles & Permissions",
    actionType: "CREATE",
    newValue: permission,
  });

  return Response.json({ permission }, { status: 201 });
}
