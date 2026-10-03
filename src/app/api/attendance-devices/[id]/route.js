import { prisma } from "@/lib/prisma";
import { requireOrgManagement } from "@/lib/auth-server";
import { createAuditLog } from "@/lib/audit";

export async function PATCH(request, { params }) {
  const { user, error } = await requireOrgManagement(request);
  if (error) return error;

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "Invalid device ID" }, { status: 400 });

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data = {};
  if (body.name !== undefined) {
    const name = String(body.name || "").trim();
    if (!name || name.length > 100) return Response.json({ error: "Device name is required (max 100 characters)" }, { status: 400 });
    data.name = name;
  }
  if (body.provider !== undefined) {
    const provider = String(body.provider || "").trim().toUpperCase();
    if (!provider || provider.length > 50) return Response.json({ error: "Provider is required (max 50 characters)" }, { status: 400 });
    data.provider = provider;
  }
  if (body.externalDeviceId !== undefined) {
    const value = body.externalDeviceId == null || body.externalDeviceId === "" ? null : String(body.externalDeviceId).trim();
    if (value && value.length > 191) return Response.json({ error: "External device ID is too long" }, { status: 400 });
    data.externalDeviceId = value;
  }
  if (body.location !== undefined) {
    const value = body.location == null || body.location === "" ? null : String(body.location).trim();
    if (value && value.length > 150) return Response.json({ error: "Location is too long" }, { status: 400 });
    data.location = value;
  }
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== "boolean") return Response.json({ error: "isActive must be a boolean" }, { status: 400 });
    data.isActive = body.isActive;
  }
  if (!Object.keys(data).length) return Response.json({ error: "No supported fields supplied" }, { status: 400 });

  try {
    const device = await prisma.attendanceDevice.update({ where: { id }, data });
    try {
      await createAuditLog({ userId: user.id, moduleName: "Attendance Device Integration", actionType: "UPDATE", newValue: { deviceId: id, ...data } });
    } catch (auditError) { console.error("Attendance device audit log failed:", auditError); }
    return Response.json({ device });
  } catch (err) {
    if (err?.code === "P2025") return Response.json({ error: "Attendance device not found" }, { status: 404 });
    if (err?.code === "P2002") return Response.json({ error: "A device with this external device ID already exists" }, { status: 409 });
    console.error("Update attendance device failed:", err);
    return Response.json({ error: "Failed to update attendance device" }, { status: 500 });
  }
}
