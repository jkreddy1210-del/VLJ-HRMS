import { prisma } from "@/lib/prisma";
import { requireAuth, canBulkImportAttendance, forbiddenResponse } from "@/lib/auth-server";
import { createAuditLog } from "@/lib/audit";
import {
  parseMonthlyAttendanceWorkbook,
  validateMonthlyAttendanceRow,
} from "@/lib/attendance-monthly-bulk-upload";

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
      rows = parseMonthlyAttendanceWorkbook(buffer);
    } catch (parseErr) {
      return Response.json({ error: parseErr.message || "Invalid Excel file" }, { status: 400 });
    }

    const employees = await prisma.employee.findMany({
      select: { id: true, employeeCode: true, fullName: true, status: true },
    });
    const employeeByCode = new Map(employees.map((e) => [e.employeeCode.toLowerCase(), e]));

    const successes = [];
    const failures = [];

    for (const row of rows) {
      const validation = validateMonthlyAttendanceRow(row, { employeeByCode });
      if (!validation.valid) {
        failures.push({
          row: row.rowNumber,
          employeeCode: String(row.employeeCode || "").trim(),
          month: String(row.month || "").trim(),
          year: String(row.year || "").trim(),
          errors: validation.errors,
        });
        continue;
      }

      const { data } = validation;
      try {
        await prisma.attendanceMonthlySummary.upsert({
          where: {
            employeeId_year_month: {
              employeeId: data.employeeId,
              year: data.year,
              month: data.month,
            },
          },
          create: {
            employeeId: data.employeeId,
            employeeCode: data.employeeCode,
            year: data.year,
            month: data.month,
            monthName: data.monthName,
            lateDays: data.lateDays,
            fullDays: data.fullDays,
            halfDays: data.halfDays,
            sundays: data.sundays,
            totalPresentDays: data.totalPresentDays,
            absentDays: data.absentDays,
            createdBy: user.id,
            updatedBy: user.id,
          },
          update: {
            employeeCode: data.employeeCode,
            monthName: data.monthName,
            lateDays: data.lateDays,
            fullDays: data.fullDays,
            halfDays: data.halfDays,
            sundays: data.sundays,
            totalPresentDays: data.totalPresentDays,
            absentDays: data.absentDays,
            updatedBy: user.id,
          },
        });

        successes.push({
          row: row.rowNumber,
          employeeCode: data.employeeCode,
          employeeName: data.employeeName,
          month: data.monthName,
          year: data.year,
        });
      } catch (err) {
        failures.push({
          row: row.rowNumber,
          employeeCode: data.employeeCode,
          month: data.monthName,
          year: String(data.year),
          errors: [err.message || "Failed to save monthly attendance"],
        });
      }
    }

    await createAuditLog({
      employeeId: user.id,
      moduleName: "Attendance Report",
      actionType: "CREATE",
      newValue: {
        type: "monthly_bulk_upload",
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
    console.error("Attendance monthly bulk upload error:", err);
    return Response.json({ error: err.message || "Failed to upload attendance report" }, { status: 500 });
  }
}
