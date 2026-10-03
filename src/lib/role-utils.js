export const ROLE_COLORS = {
  employee: "from-champagne to-gold",
  manager: "from-emerald-500 to-emerald-600",
  security: "from-cyan-500 to-cyan-600",
  hr: "from-purple-500 to-purple-600",
  admin: "from-amber-500 to-amber-600",
  super_admin: "from-red-500 to-red-600",
};

const CUSTOM_ROLE_COLORS = [
  "from-blue-500 to-blue-600",
  "from-indigo-500 to-indigo-600",
  "from-teal-500 to-teal-600",
  "from-rose-500 to-rose-600",
  "from-orange-500 to-orange-600",
  "from-violet-500 to-violet-600",
];

export const PROTECTED_ROLE_NAMES = ["super_admin"];

export function formatRoleDisplayName(roleName) {
  if (!roleName) return "";
  return roleName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function slugifyRoleName(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export function getRoleColor(roleName, roleId = 0) {
  return ROLE_COLORS[roleName] || CUSTOM_ROLE_COLORS[roleId % CUSTOM_ROLE_COLORS.length];
}

export function mapRoleResponse(role) {
  return {
    id: role.id,
    roleName: role.roleName,
    name: formatRoleDisplayName(role.roleName),
    color: getRoleColor(role.roleName, role.id),
    permissionCount: role.rolePermissions?.length ?? 0,
    permissions: (role.rolePermissions || []).map((rp) => rp.permission.permissionName),
    permissionDetails: (role.rolePermissions || []).map((rp) => ({
      id: rp.permission.id,
      name: rp.permission.permissionName,
      module: rp.permission.moduleName,
    })),
    userCount: role._count?.employees ?? 0,
    lastUpdated: role.updatedAt.toISOString(),
    isProtected: PROTECTED_ROLE_NAMES.includes(role.roleName),
  };
}
