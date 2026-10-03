import { prisma } from "@/lib/prisma";
import { requireShiftManagement } from "@/lib/auth-server";
import { createAuditLog } from "@/lib/audit";
import { mapShiftRecord, validateShiftPayload, assertSingleActiveShift } from "@/lib/shift-server";

export async function PATCH(request, { params }) {
  const { user, error } = await requireShiftManagement(request);
  if (error) return error;

  const id = parseInt(params.id, 10);
  if (Number.isNaN(id)) {
    return Response.json({ error: "Invalid shift id" }, { status: 400 });
  }

  const existing = await prisma.departmentShift.findUnique({
    where: { id },
    include: { department: true },
  });
  if (!existing) {
    return Response.json({ error: "Shift not found" }, { status: 404 });
  }

  const body = await request.json();
  const { errors, data } = validateShiftPayload(body, { partial: true });
  if (errors.length) {
    return Response.json({ error: errors[0] }, { status: 400 });
  }

  const nextDepartmentId = data.departmentId ?? existing.departmentId;
  const nextStatus = data.status ?? existing.status;

  if (nextDepartmentId !== existing.departmentId) {
    const department = await prisma.department.findUnique({ where: { id: nextDepartmentId } });
    if (!department) {
      return Response.json({ error: "Department not found" }, { status: 404 });
    }
  }

  if (nextStatus === "Active") {
    try {
      await assertSingleActiveShift(prisma, nextDepartmentId, id);
    } catch (err) {
      return Response.json({ error: err.message }, { status: 400 });
    }
  }

  try {
    const shift = await prisma.departmentShift.update({
      where: { id },
      data: {
        ...(data.departmentId != null ? { departmentId: data.departmentId } : {}),
        ...(data.shiftName ? { shiftName: data.shiftName } : {}),
        ...(data.startTime ? { startTime: data.startTime } : {}),
        ...(data.endTime ? { endTime: data.endTime } : {}),
        ...(data.graceMinutes != null ? { graceMinutes: data.graceMinutes } : {}),
        ...(data.status ? { status: data.status } : {}),
        updatedBy: user.id,
      },
      include: { department: true },
    });

    try {
      await createAuditLog({
        employeeId: user.id,
        moduleName: "Shift Management",
        actionType: "UPDATE",
        oldValue: mapShiftRecord(existing),
        newValue: mapShiftRecord(shift),
      });
    } catch (auditErr) {
      console.error("Shift audit log failed:", auditErr);
    }

    return Response.json({ shift: mapShiftRecord(shift) });
  } catch (err) {
    console.error("Update shift failed:", err);
    throw err;
  }
}

export async function DELETE(request, { params }) {
  const { user, error } = await requireShiftManagement(request);
  if (error) return error;

  const id = parseInt(params.id, 10);
  if (Number.isNaN(id)) {
    return Response.json({ error: "Invalid shift id" }, { status: 400 });
  }

  const existing = await prisma.departmentShift.findUnique({
    where: { id },
    include: { department: true },
  });
  if (!existing) {
    return Response.json({ error: "Shift not found" }, { status: 404 });
  }

  await prisma.departmentShift.delete({ where: { id } });

  try {
    await createAuditLog({
      employeeId: user.id,
      moduleName: "Shift Management",
      actionType: "DELETE",
      oldValue: mapShiftRecord(existing),
    });
  } catch (auditErr) {
    console.error("Shift audit log failed:", auditErr);
  }

  return Response.json({ success: true });
}
