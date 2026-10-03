import { prisma } from "@/lib/prisma";
import { requireAuth, canManageEmployees } from "@/lib/auth-server";
import { previewNextEmployeeCode } from "@/lib/employee-id";

export async function GET(request) {
  const { user, error } = await requireAuth(request);
  if (error) return error;
  if (!canManageEmployees(user)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const designationId = parseInt(searchParams.get("designationId"), 10);
  const departmentId = parseInt(searchParams.get("departmentId"), 10);

  if (Number.isNaN(designationId)) {
    return Response.json({ error: "designationId is required" }, { status: 400 });
  }

  const designation = await prisma.designation.findUnique({
    where: { id: designationId },
    include: { department: true },
  });
  if (!designation) {
    return Response.json({ error: "Designation not found" }, { status: 404 });
  }

  if (!Number.isNaN(departmentId) && designation.departmentId !== departmentId) {
    return Response.json(
      { error: "Designation does not belong to the selected department" },
      { status: 400 }
    );
  }

  const employeeCode = await previewNextEmployeeCode(prisma, designationId);

  return Response.json({
    employeeCode,
    designationCode: designation.designationCode,
    departmentName: designation.department.departmentName,
    designationName: designation.designationName,
  });
}
