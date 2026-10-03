import { prisma } from "@/lib/prisma";
import { requireAuth, requireOrgManagement } from "@/lib/auth-server";
import { createAuditLog } from "@/lib/audit";

function validId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(request, { params }) {
  const { user, error } = await requireAuth(request);
  if (error) return error;
  if (!user.permissions?.includes("Full System Access") &&
      !user.permissions?.includes("All Permissions") &&
      !user.permissions?.includes("Employee Management") &&
      !user.permissions?.includes("Attendance Monitoring")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const attendanceDeviceId = validId(params.id);
  if (!attendanceDeviceId) return Response.json({ error: "Invalid device ID" }, { status: 400 });
  const mappings = await prisma.employeeDeviceMapping.findMany({
    where: { attendanceDeviceId },
    include: { employee: { select: { id: true, employeeCode: true, fullName: true, status: true, department: { select: { departmentName: true } } } } },
    orderBy: [{ isActive: "desc" }, { employee: { fullName: "asc" } }],
  });
  return Response.json({ mappings });
}

export async function POST(request, { params }) {
  const { user, error } = await requireOrgManagement(request);
  if (error) return error;
  const attendanceDeviceId = validId(params.id);
  if (!attendanceDeviceId) return Response.json({ error: "Invalid device ID" }, { status: 400 });

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const employeeId = validId(body.employeeId);
  const deviceEmployeeId = String(body.deviceEmployeeId ?? "").trim();
  if (!employeeId) return Response.json({ error: "Valid employeeId is required" }, { status: 400 });
  if (!deviceEmployeeId || deviceEmployeeId.length > 191) return Response.json({ error: "Device employee ID is required (max 191 characters)" }, { status: 400 });

  try {
    const [device, employee] = await Promise.all([
      prisma.attendanceDevice.findUnique({ where: { id: attendanceDeviceId } }),
      prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, employeeCode: true, fullName: true, status: true } }),
    ]);
    if (!device) return Response.json({ error: "Attendance device not found" }, { status: 404 });
    if (!device.isActive) return Response.json({ error: "Cannot map employees to an inactive device" }, { status: 409 });
    if (!employee) return Response.json({ error: "Employee not found" }, { status: 404 });

    const mapping = await prisma.employeeDeviceMapping.create({
      data: { attendanceDeviceId, employeeId, deviceEmployeeId },
      include: { employee: { select: { id: true, employeeCode: true, fullName: true, status: true } } },
    });
    try {
      await createAuditLog({
        userId: user.id,
        moduleName: "Attendance Device Integration",
        actionType: "CREATE",
        newValue: { attendanceDeviceId, employeeId, employeeCode: employee.employeeCode, deviceEmployeeId },
      });
    } catch (auditError) { console.error("Employee device mapping audit log failed:", auditError); }
    return Response.json({ mapping }, { status: 201 });
  } catch (err) {
    if (err?.code === "P2002") return Response.json({ error: "This device employee ID or employee is already mapped on this device" }, { status: 409 });
    console.error("Create employee device mapping failed:", err);
    return Response.json({ error: "Failed to create employee device mapping" }, { status: 500 });
  }
}
