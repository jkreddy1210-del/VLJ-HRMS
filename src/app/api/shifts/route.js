import { prisma } from "@/lib/prisma";
import { requireShiftManagement } from "@/lib/auth-server";
import { createAuditLog } from "@/lib/audit";
import { parsePagination, buildListPagination } from "@/lib/pagination";
import { mapShiftRecord, validateShiftPayload, assertSingleActiveShift } from "@/lib/shift-server";

export async function GET(request) {
  const { error } = await requireShiftManagement(request);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const departmentId = searchParams.get("departmentId");
  const status = searchParams.get("status");

  const where = {
    ...(departmentId && departmentId !== "all"
      ? { departmentId: Number(departmentId) }
      : {}),
    ...(status === "Active" || status === "Inactive" ? { status } : {}),
  };

  const [shifts, total] = await Promise.all([
    prisma.departmentShift.findMany({
      where,
      include: { department: true },
      orderBy: [{ status: "asc" }, { department: { departmentName: "asc" } }],
      skip,
      take: limit,
    }),
    prisma.departmentShift.count({ where }),
  ]);

  return Response.json({
    shifts: shifts.map(mapShiftRecord),
    pagination: buildListPagination({ page, limit, total }),
  });
}

export async function POST(request) {
  const { user, error } = await requireShiftManagement(request);
  if (error) return error;

  const body = await request.json();
  const departmentIds = Array.isArray(body.departmentIds)
    ? body.departmentIds.map((id) => Number(id)).filter(Boolean)
    : body.departmentId
      ? [Number(body.departmentId)]
      : [];

  if (!departmentIds.length) {
    return Response.json({ error: "Select at least one department" }, { status: 400 });
  }

  const { errors, data } = validateShiftPayload({ ...body, departmentId: departmentIds[0] });
  if (errors.length) {
    return Response.json({ error: errors[0] }, { status: 400 });
  }

  const created = [];
  const skipped = [];

  for (const departmentId of departmentIds) {
    const department = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) {
      skipped.push(`Department ${departmentId} not found`);
      continue;
    }

    if (data.status === "Active") {
      try {
        await assertSingleActiveShift(prisma, departmentId);
      } catch (err) {
        skipped.push(`${department.departmentName}: ${err.message}`);
        continue;
      }
    }

    try {
      const shift = await prisma.departmentShift.create({
        data: {
          departmentId,
          shiftName: data.shiftName,
          startTime: data.startTime,
          endTime: data.endTime,
          graceMinutes: data.graceMinutes,
          status: data.status,
          createdBy: user.id,
        },
        include: { department: true },
      });
      created.push(shift);
    } catch (err) {
      skipped.push(`${department.departmentName}: failed to create`);
      console.error("Create shift failed:", err);
    }
  }

  if (!created.length) {
    return Response.json({ error: skipped[0] || "Failed to create shifts" }, { status: 400 });
  }

  for (const shift of created) {
    try {
      await createAuditLog({
        employeeId: user.id,
        moduleName: "Shift Management",
        actionType: "CREATE",
        newValue: mapShiftRecord(shift),
      });
    } catch (auditErr) {
      console.error("Shift audit log failed:", auditErr);
    }
  }

  return Response.json({
    shifts: created.map(mapShiftRecord),
    skipped,
  }, { status: 201 });
}
