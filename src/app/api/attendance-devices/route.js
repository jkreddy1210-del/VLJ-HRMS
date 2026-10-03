import { prisma } from "@/lib/prisma";
import { requireAuth, requireOrgManagement } from "@/lib/auth-server";
import { createAuditLog } from "@/lib/audit";

export async function GET(request) {
  const { user, error } = await requireAuth(request);
  if (error) return error;
  if (!user.permissions?.includes("Full System Access") &&
      !user.permissions?.includes("All Permissions") &&
      !user.permissions?.includes("Employee Management") &&
      !user.permissions?.includes("Attendance Monitoring")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get("includeInactive") === "true";
  const devices = await prisma.attendanceDevice.findMany({
    where: includeInactive ? {} : { isActive: true },
    include: {
      _count: { select: { employeeMappings: true, events: true } },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  return Response.json({ devices });
}

export async function POST(request) {
  const { user, error } = await requireOrgManagement(request);
  if (error) return error;

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = String(body.name || "").trim();
  const provider = String(body.provider || "").trim().toUpperCase();
  const externalDeviceId = body.externalDeviceId == null || body.externalDeviceId === ""
    ? null : String(body.externalDeviceId).trim();
  const location = body.location == null || body.location === "" ? null : String(body.location).trim();

  if (!name || name.length > 100) return Response.json({ error: "Device name is required (max 100 characters)" }, { status: 400 });
  if (!provider || provider.length > 50) return Response.json({ error: "Provider is required (max 50 characters)" }, { status: 400 });
  if (externalDeviceId && externalDeviceId.length > 191) return Response.json({ error: "External device ID is too long" }, { status: 400 });
  if (location && location.length > 150) return Response.json({ error: "Location is too long" }, { status: 400 });

  try {
    const device = await prisma.attendanceDevice.create({
      data: { name, provider, externalDeviceId, location },
    });
    try {
      await createAuditLog({
        userId: user.id,
        moduleName: "Attendance Device Integration",
        actionType: "CREATE",
        newValue: { deviceId: device.id, name: device.name, provider: device.provider, externalDeviceId: device.externalDeviceId },
      });
    } catch (auditError) { console.error("Attendance device audit log failed:", auditError); }
    return Response.json({ device }, { status: 201 });
  } catch (err) {
    if (err?.code === "P2002") return Response.json({ error: "A device with this external device ID already exists" }, { status: 409 });
    console.error("Create attendance device failed:", err);
    return Response.json({ error: "Failed to create attendance device" }, { status: 500 });
  }
}
