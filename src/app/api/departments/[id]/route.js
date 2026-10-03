import { prisma } from "@/lib/prisma";
import { requireOrgManagement } from "@/lib/auth-server";
import { createAuditLog } from "@/lib/audit";

export async function PATCH(request, { params }) {
  const { user, error } = await requireOrgManagement(request);
  if (error) return error;

  const id = parseInt(params.id, 10);
  if (Number.isNaN(id)) {
    return Response.json({ error: "Invalid department id" }, { status: 400 });
  }

  const existing = await prisma.department.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: "Department not found" }, { status: 404 });
  }

  const body = await request.json();
  const departmentName = body.departmentName?.trim();
  const departmentCode = body.departmentCode?.trim().toUpperCase();

  if (!departmentName) {
    return Response.json({ error: "Department name is required" }, { status: 400 });
  }
  if (!departmentCode) {
    return Response.json({ error: "Department code is required" }, { status: 400 });
  }

  try {
    const department = await prisma.department.update({
      where: { id },
      data: {
        departmentName,
        departmentCode,
        updatedBy: user.id,
      },
    });

    try {
      await createAuditLog({
        userId: user.id,
        moduleName: "Department Management",
        actionType: "UPDATE",
        oldValue: existing,
        newValue: department,
      });
    } catch (auditErr) {
      console.error("Department audit log failed:", auditErr);
    }

    return Response.json({ department });
  } catch (err) {
    if (err.code === "P2002") {
      return Response.json({ error: "Department code already exists" }, { status: 400 });
    }
    throw err;
  }
}

export async function DELETE(request, { params }) {
  const { user, error } = await requireOrgManagement(request);
  if (error) return error;

  const id = parseInt(params.id, 10);
  if (Number.isNaN(id)) {
    return Response.json({ error: "Invalid department id" }, { status: 400 });
  }

  const existing = await prisma.department.findUnique({
    where: { id },
    include: {
      _count: { select: { employees: true, designations: true, shifts: true } },
    },
  });
  if (!existing) {
    return Response.json({ error: "Department not found" }, { status: 404 });
  }

  if (existing._count.employees > 0) {
    return Response.json(
      { error: `Cannot delete department with ${existing._count.employees} assigned employee(s).` },
      { status: 400 }
    );
  }
  if (existing._count.designations > 0) {
    return Response.json(
      { error: `Delete all ${existing._count.designations} designation(s) under this department first.` },
      { status: 400 }
    );
  }
  if (existing._count.shifts > 0) {
    return Response.json(
      { error: `Remove ${existing._count.shifts} shift(s) for this department before deleting.` },
      { status: 400 }
    );
  }

  await prisma.department.delete({ where: { id } });

  try {
    await createAuditLog({
      userId: user.id,
      moduleName: "Department Management",
      actionType: "DELETE",
      oldValue: existing,
    });
  } catch (auditErr) {
    console.error("Department audit log failed:", auditErr);
  }

  return Response.json({ success: true });
}
