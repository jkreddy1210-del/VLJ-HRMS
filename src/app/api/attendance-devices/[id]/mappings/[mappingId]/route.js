import { prisma } from "@/lib/prisma";
import { requireOrgManagement } from "@/lib/auth-server";
import { createAuditLog } from "@/lib/audit";

export async function PATCH(request, { params }) {
  const { user, error } = await requireOrgManagement(request);
  if (error) return error;
  const attendanceDeviceId = Number(params.id);
  const mappingId = Number(params.mappingId);
  if (!Number.isInteger(attendanceDeviceId) || attendanceDeviceId <= 0 || !Number.isInteger(mappingId) || mappingId <= 0) {
    return Response.json({ error: "Invalid device or mapping ID" }, { status: 400 });
  }

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body.isActive !== "boolean") return Response.json({ error: "isActive must be a boolean" }, { status: 400 });

  try {
    const existing = await prisma.employeeDeviceMapping.findFirst({
      where: { id: mappingId, attendanceDeviceId },
      select: { id: true },
    });
    if (!existing) return Response.json({ error: "Mapping not found for this device" }, { status: 404 });
    const mapping = await prisma.employeeDeviceMapping.update({
      where: { id: mappingId },
      data: { isActive: body.isActive },
      include: { employee: { select: { id: true, employeeCode: true, fullName: true } } },
    });
    try {
      await createAuditLog({
        userId: user.id,
        moduleName: "Attendance Device Integration",
        actionType: "UPDATE",
        newValue: { mappingId, attendanceDeviceId, employeeId: mapping.employeeId, deviceEmployeeId: mapping.deviceEmployeeId, isActive: body.isActive },
      });
    } catch (auditError) { console.error("Employee device mapping audit log failed:", auditError); }
    return Response.json({ mapping });
  } catch (err) {
    if (err?.code === "P2025") return Response.json({ error: "Mapping not found" }, { status: 404 });
    console.error("Update employee device mapping failed:", err);
    return Response.json({ error: "Failed to update employee device mapping" }, { status: 500 });
  }
}
