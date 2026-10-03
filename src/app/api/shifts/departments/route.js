import { prisma } from "@/lib/prisma";
import { requireShiftManagement } from "@/lib/auth-server";

/** Departments from master table for shift form dropdowns. */
export async function GET(request) {
  const { error } = await requireShiftManagement(request);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const excludeShiftId = searchParams.get("excludeShiftId");
  const parsedExcludeId = excludeShiftId ? parseInt(excludeShiftId, 10) : null;

  const [departments, activeShiftRows] = await Promise.all([
    prisma.department.findMany({
      orderBy: { departmentName: "asc" },
      select: {
        id: true,
        departmentName: true,
        departmentCode: true,
        _count: { select: { employees: { where: { status: "Active" } } } },
      },
    }),
    prisma.departmentShift.findMany({
      where: { status: "Active" },
      select: { id: true, departmentId: true },
    }),
  ]);

  const activeByDepartment = new Map(activeShiftRows.map((row) => [row.departmentId, row.id]));

  const options = departments.map((dept) => {
    const activeShiftId = activeByDepartment.get(dept.id) || null;
    const blockedByActiveShift =
      activeShiftId != null &&
      (!parsedExcludeId || activeShiftId !== parsedExcludeId);

    return {
      id: dept.id,
      value: String(dept.id),
      label: dept.departmentName,
      departmentName: dept.departmentName,
      departmentCode: dept.departmentCode,
      activeEmployeeCount: dept._count.employees,
      hasActiveShift: Boolean(activeShiftId),
      disabled: blockedByActiveShift,
    };
  });

  return Response.json({ departments: options });
}
