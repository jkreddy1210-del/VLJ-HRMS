/** Roles allowed in Reporting Manager dropdown. */
export const REPORTING_MANAGER_ROLES = ["manager", "hr", "admin", "super_admin"];

export function reportingManagerWhere(extra = {}) {
  return {
    status: "Active",
    role: { roleName: { in: REPORTING_MANAGER_ROLES } },
    ...extra,
  };
}

export async function findReportingManagers(prisma, { excludeId } = {}) {
  const where = reportingManagerWhere(
    excludeId != null ? { id: { not: excludeId } } : {}
  );
  return prisma.employee.findMany({
    where,
    select: { id: true, fullName: true, employeeCode: true },
    orderBy: { fullName: "asc" },
  });
}
