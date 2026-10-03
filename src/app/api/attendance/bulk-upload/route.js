import { prisma } from "@/lib/prisma";
import { requireAuth, canBulkImportAttendance, forbiddenResponse } from "@/lib/auth-server";
import { createAuditLog } from "@/lib/audit";
import { markEmployeeAttendance } from "@/lib/attendance-mark";
import { getLocalDateString } from "@/lib/utils";
import {
  parseAttendanceWorkbook,
  validateAttendanceRow,
} from "@/lib/attendance-bulk-upload";

export async function POST(request) {
  const { user, error } = await requireAuth(request);
  if (error) return error;
  if (!canBulkImportAttendance(user)) return forbiddenResponse();

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file.arrayBuffer !== "function") {
      return Response.json({ error: "Excel file is required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let rows;
    try {
      rows = parseAttendanceWorkbook(buffer);
    } catch (parseErr) {
      return Response.json({ error: parseErr.message || "Invalid Excel file" }, { status: 400 });
    }

    const employees = await prisma.employee.findMany({
      select: { id: true, employeeCode: true, status: true },
    });
    const employeeByCode = new Map(
      employees.map((e) => [e.employeeCode.toLowerCase(), e])
    );

    const todayYmd = getLocalDateString();
    const successes = [];
    const failures = [];

    for (const row of rows) {
      const validation = validateAttendanceRow(row, { todayYmd, employeeByCode });
      if (!validation.valid) {
        failures.push({
          row: row.rowNumber,
          employeeCode: row.employeeCode || "",
          date: row.date || "",
          errors: validation.errors,
        });
        continue;
      }

      const { data } = validation;
      try {
        await markEmployeeAttendance(prisma, user, {
          date: data.date,
          employeeCode: data.employeeCode,
          statusApi: data.status,
          inTime: data.inTime ?? undefined,
          outTime: data.outTime ?? undefined,
          allowInactive: true,
        });
        successes.push({
          row: row.rowNumber,
          employeeCode: data.employeeCode,
          date: data.date,
          status: data.status,
        });
      } catch (err) {
        failures.push({
          row: row.rowNumber,
          employeeCode: data.employeeCode,
          date: data.date,
          errors: [err.message || "Failed to save attendance"],
        });
      }
    }

    await createAuditLog({
      employeeId: user.id,
      moduleName: "Attendance",
      actionType: "CREATE",
      newValue: {
        type: "bulk_upload",
        total: rows.length,
        success: successes.length,
        failed: failures.length,
      },
    });

    return Response.json({
      summary: {
        total: rows.length,
        success: successes.length,
        failed: failures.length,
      },
      successes,
      failures,
    });
  } catch (err) {
    console.error("Attendance bulk upload error:", err);
    return Response.json({ error: err.message || "Failed to upload attendance" }, { status: 500 });
  }
}
