import { prisma } from "@/lib/prisma";



export async function getRolePermissions(roleId) {

  const rows = await prisma.rolePermission.findMany({

    where: { roleId },

    include: { permission: true },

  });

  return rows.map((r) => r.permission.permissionName);

}



export async function getEmployeePermissionOverrides(employeeId) {

  const rows = await prisma.employeePermission.findMany({

    where: { employeeId },

    include: { permission: true },

  });

  return rows.map((r) => r.permission.permissionName);

}



export async function getEmployeePermissions(employeeId, roleId) {

  const [rolePerms, employeePerms] = await Promise.all([

    getRolePermissions(roleId),

    getEmployeePermissionOverrides(employeeId),

  ]);

  return [...new Set([...rolePerms, ...employeePerms])];

}



/** @deprecated use getEmployeePermissions */

export const getUserPermissions = getEmployeePermissions;



export async function userHasPermission(user, permissionName) {

  if (

    user.permissions?.includes("Full System Access") ||

    user.permissions?.includes("All Permissions")

  ) {

    return true;

  }

  return user.permissions?.includes(permissionName) ?? false;

}

