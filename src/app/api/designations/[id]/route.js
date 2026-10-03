import { prisma } from "@/lib/prisma";
import { requireOrgManagement } from "@/lib/auth-server";
import { createAuditLog } from "@/lib/audit";
import { formatEmployeeId } from "@/lib/employee-id";

export async function PATCH(request, { params }) {
  const { user, error } = await requireOrgManagement(request);
  if (error) return error;

  const id = parseInt(params.id, 10);
  if (Number.isNaN(id)) {
    return Response.json({ error: "Invalid designation id" }, { status: 400 });
  }

  const existing = await prisma.designation.findUnique({
    where: { id },
    include: { _count: { select: { employees: true } } },
  });
  if (!existing) {
    return Response.json({ error: "Designation not found" }, { status: 404 });
  }

  const body = await request.json();
  const designationName = body.designationName?.trim();
  const designationCode = body.designationCode?.trim().toUpperCase();
  const departmentId = body.departmentId ? parseInt(body.departmentId, 10) : existing.departmentId;
  const sequenceStart = body.sequenceStart ? parseInt(body.sequenceStart, 10) : existing.sequenceStart;

  if (!designationName) {
    return Response.json({ error: "Designation name is required" }, { status: 400 });
  }
  if (!designationCode || !/^[A-Z0-9]{1,10}$/.test(designationCode)) {
    return Response.json({ error: "Valid designation code is required (e.g. AC, IT)" }, { status: 400 });
  }
  if (Number.isNaN(departmentId)) {
    return Response.json({ error: "Department is required" }, { status: 400 });
  }
  if (Number.isNaN(sequenceStart) || sequenceStart < 1) {
    return Response.json({ error: "Sequence start must be a positive number" }, { status: 400 });
  }

  if (existing._count.employees > 0 && designationCode !== existing.designationCode) {
    return Response.json(
      { error: "Cannot change designation code while employees are assigned" },
      { status: 400 }
    );
  }

  try {
    const designation = await prisma.designation.update({
      where: { id },
      data: {
        designationName,
        designationCode,
        departmentId,
        sequenceStart,
        updatedBy: user.id,
      },
      include: { department: true, _count: { select: { employees: true } } },
    });

    try {
      await createAuditLog({
        userId: user.id,
        moduleName: "Department Management",
        actionType: "UPDATE",
        oldValue: existing,
        newValue: designation,
      });
    } catch (auditErr) {
      console.error("Designation audit log failed:", auditErr);
    }

    return Response.json({
      designation: {
        ...designation,
        idFormatPreview: formatEmployeeId(designation.designationCode, sequenceStart, sequenceStart),
      },
    });
  } catch (err) {
    if (err.code === "P2002") {
      return Response.json({ error: "Designation code or name already exists" }, { status: 400 });
    }
    throw err;
  }
}

export async function DELETE(request, { params }) {
  const { user, error } = await requireOrgManagement(request);
  if (error) return error;

  const id = parseInt(params.id, 10);
  if (Number.isNaN(id)) {
    return Response.json({ error: "Invalid designation id" }, { status: 400 });
  }

  const existing = await prisma.designation.findUnique({
    where: { id },
    include: { _count: { select: { employees: true } } },
  });
  if (!existing) {
    return Response.json({ error: "Designation not found" }, { status: 404 });
  }

  if (existing._count.employees > 0) {
    return Response.json(
      { error: `Cannot delete designation assigned to ${existing._count.employees} employee(s).` },
      { status: 400 }
    );
  }

  await prisma.designation.delete({ where: { id } });

  try {
    await createAuditLog({
      userId: user.id,
      moduleName: "Department Management",
      actionType: "DELETE",
      oldValue: existing,
    });
  } catch (auditErr) {
    console.error("Designation audit log failed:", auditErr);
  }

  return Response.json({ success: true });
}
