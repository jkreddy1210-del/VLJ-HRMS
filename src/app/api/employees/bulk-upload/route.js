import { prisma } from "@/lib/prisma";
import { requirePermission, hashPassword } from "@/lib/auth-server";
import { createAuditLog } from "@/lib/audit";
import { assignEmployeeCode } from "@/lib/employee-id";
import { parseEmployeeWorkbook, validateEmployeeRow } from "@/lib/employee-bulk-upload";
import { findReportingManagers } from "@/lib/reporting-managers";
import { ensureBankExists } from "@/lib/banks";

export async function POST(request) {
  const { user, error } = await requirePermission(request, "Employee Management");
  if (error) return error;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file.arrayBuffer !== "function") {
      return Response.json({ error: "Excel file is required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = parseEmployeeWorkbook(buffer);

    const [departments, designations, roles, managers, existingEmployees, leaveTypes, defaultRole] =
      await Promise.all([
        prisma.department.findMany(),
        prisma.designation.findMany(),
        prisma.role.findMany(),
        findReportingManagers(prisma),
        prisma.employee.findMany({ select: { employeeCode: true, email: true } }),
        prisma.leaveType.findMany(),
        prisma.role.findUnique({ where: { roleName: "employee" } }),
      ]);

    if (!defaultRole) {
      return Response.json({ error: "Default employee role not found" }, { status: 400 });
    }

    const departmentByName = new Map(
      departments.map((d) => [d.departmentName.toLowerCase(), d])
    );
    const designationByDeptAndName = new Map(
      designations.map((d) => [`${d.departmentId}:${d.designationName.toLowerCase()}`, d])
    );
    const roleByName = new Map(roles.map((r) => [r.roleName.toLowerCase(), r]));
    const managerByCode = new Map(
      managers.map((m) => [m.employeeCode.toLowerCase(), m])
    );
    const existingCodes = new Set(existingEmployees.map((e) => e.employeeCode.toLowerCase()));
    const existingEmails = new Set(existingEmployees.map((e) => e.email.toLowerCase()));
    const seenCodes = new Set();
    const seenEmails = new Set();

    const failures = [];
    const successes = [];
    const year = new Date().getFullYear();

    for (const row of rows) {
      const codeKey = row.employeeCode?.trim().toLowerCase();
      const emailKey = row.email?.trim().toLowerCase();

      const validation = validateEmployeeRow(row, {
        existingCodes,
        existingEmails,
        seenCodes,
        seenEmails,
        departmentByName,
        designationByDeptAndName,
        roleByName,
        managerByCode,
      });

      if (!validation.valid) {
        failures.push({
          row: row.rowNumber,
          employeeCode: row.employeeCode || "",
          name: `${row.firstName || ""} ${row.lastName || ""}`.trim(),
          errors: validation.errors,
        });
        continue;
      }

      const data = validation.data;
      let employeeCode = data.employeeCode;

      try {
        const passwordHash = await hashPassword(data.password);

        const employee = await prisma.$transaction(async (tx) => {
          if (!employeeCode) {
            employeeCode = await assignEmployeeCode(prisma, data.designationId, { tx });
          }

          return tx.employee.create({
            data: {
              employeeCode,
              camAttendanceId: employeeCode,
              firstName: data.firstName,
              lastName: data.lastName || "",
              fullName: data.fullName,
              dob: data.dob,
              gender: data.gender,
              bloodGroup: data.bloodGroup,
              mobile: data.mobile,
              alternateMobile: data.alternateMobile,
              email: data.email,
              passwordHash,
              roleId: data.roleId || defaultRole.id,
              address: data.address,
              departmentId: data.departmentId,
              designationId: data.designationId,
              reportingManagerId: data.reportingManagerId,
              joiningDate: data.joiningDate,
              employmentType: data.employmentType,
              status: data.status,
              emergencyContact: data.emergencyContact,
              bankName: data.bankName,
              accountNumber: data.accountNumber,
              pan: data.pan,
              aadhaar: data.aadhaar,
              createdBy: user.id,
            },
          });
        });

        if (employee.bankName) {
          await ensureBankExists(prisma, employee.bankName);
        }

        if (leaveTypes.length) {
          await prisma.leaveBalance.createMany({
            data: leaveTypes.map((lt) => ({
              employeeId: employee.id,
              leaveTypeId: lt.id,
              totalLeave: lt.yearlyLimit,
              usedLeave: 0,
              remainingLeave: lt.yearlyLimit,
              year,
            })),
          });
        }

        existingCodes.add(employeeCode.toLowerCase());
        existingEmails.add(data.email.toLowerCase());
        if (employeeCode) seenCodes.add(employeeCode.toLowerCase());
        if (emailKey) seenEmails.add(emailKey);
        managerByCode.set(employeeCode.toLowerCase(), {
          id: employee.id,
          employeeCode: employee.employeeCode,
        });

        successes.push({
          row: row.rowNumber,
          employeeCode: employee.employeeCode,
          name: employee.fullName,
        });
      } catch (err) {
        failures.push({
          row: row.rowNumber,
          employeeCode: data.employeeCode,
          name: data.fullName,
          errors: [err.code === "P2002" ? "Duplicate record in database" : err.message || "Failed to save"],
        });
      }
    }

    if (successes.length) {
      try {
        await createAuditLog({
          userId: user.id,
          moduleName: "Employee Management",
          actionType: "CREATE",
          newValue: {
            bulkUpload: true,
            uploaded: successes.length,
            failed: failures.length,
            employees: successes.map((s) => s.employeeCode),
          },
        });
      } catch (auditErr) {
        console.error("Bulk upload audit log failed:", auditErr);
      }
    }

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
    console.error("Bulk upload error:", err);
    return Response.json({ error: err.message || "Bulk upload failed" }, { status: 400 });
  }
}
