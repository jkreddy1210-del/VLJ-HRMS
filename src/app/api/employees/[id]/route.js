import { prisma } from "@/lib/prisma";
import { requireAuth, requirePermission, hashPassword, canManageEmployees, hasFullAccess, forbiddenResponse } from "@/lib/auth-server";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { mapEmployee } from "@/lib/employee-mapper";
import { validateEmployeeCategory, buildCategoryData } from "@/lib/employee-category";
import {
  assignEmployeeCode,
  releaseEmployeeCode,
  validateDesignationForDepartment,
} from "@/lib/employee-id";
import {
  getEmployeeIdsOnLeaveToday,
  parseStatusInput,
  isValidDbStatus,
} from "@/lib/employee-status";
import {
  validateEmployeeForm,
  checkEmployeeDuplicates,
  mapPrismaDuplicateError,
  validationErrorResponse,
  normalizeEmployeeInput,
  validateMobile,
  mapCategoryErrorsToFields,
} from "@/lib/employee-validation";
import { mapEmployeeDocument, mapDocumentsByType } from "@/lib/document-mapper";
import { findReportingManagers } from "@/lib/reporting-managers";
import { ensureBankExists, listBanks } from "@/lib/banks";
import { MARITAL_STATUSES } from "@/lib/lookups";

function canEditEmployee(user, employeeId) {
  const isOwn = user.id === employeeId || user.employeeId === employeeId;
  return (
    canManageEmployees(user) ||
    hasFullAccess(user) ||
    (isOwn && user.permissions.includes("Edit Profile"))
  );
}

function getEditScope(user, employeeId) {
  if (canManageEmployees(user) || hasFullAccess(user)) return "full";
  if (canEditEmployee(user, employeeId)) return "self";
  return null;
}

const SELF_EDIT_FIELDS = new Set([
  "firstName",
  "lastName",
  "mobile",
  "alternateMobile",
  "email",
  "address",
  "temporaryAddress",
  "emergencyContact",
  "dob",
  "gender",
  "bloodGroup",
  "motherName",
  "fatherName",
  "maritalStatus",
  "spouseName",
  "religion",
  "nationality",
  "bankName",
  "accountNumber",
  "ifscCode",
  "profilePhoto",
  "skills",
]);

async function loadDocumentsSafe(employeeId) {
  try {
    return await prisma.employeeDocument.findMany({ where: { employeeId } });
  } catch (err) {
    console.error("employee detail documents failed:", err?.message || err);
    return [];
  }
}

export async function GET(request, { params }) {
  try {
    const { user, error } = await requireAuth(request);
    if (error) return error;

    const id = parseInt(params.id, 10);
    if (!Number.isFinite(id)) {
      return Response.json({ error: "Invalid employee id" }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { department: true, designation: true, reportingManager: true, role: true },
    });

    if (!employee) return Response.json({ error: "Not found" }, { status: 404 });

    if (!canManageEmployees(user) && user.id !== id) {
      return forbiddenResponse();
    }

    const canEdit = canEditEmployee(user, id);
    let lookups = null;
    if (canEdit) {
      const [departments, designations, roles, managers, banks] = await Promise.all([
        prisma.department.findMany({ orderBy: { departmentName: "asc" } }),
        prisma.designation.findMany({ orderBy: { designationName: "asc" } }),
        prisma.role.findMany({ orderBy: { roleName: "asc" } }),
        findReportingManagers(prisma, { excludeId: id }),
        listBanks(prisma),
      ]);
      lookups = {
        departments,
        designations,
        roles: roles.map((r) => ({
          id: r.id,
          roleName: r.roleName,
          label: r.roleName.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        })),
        managers,
        banks,
        maritalStatuses: MARITAL_STATUSES,
      };
    }

    const [attendance, leaves, documents] = await Promise.all([
      prisma.attendance.findMany({
        where: { employeeId: id },
        orderBy: { attendanceDate: "desc" },
        take: 10,
      }),
      prisma.leaveRequest.findMany({
        where: { employeeId: id },
        include: { leaveType: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      loadDocumentsSafe(id),
    ]);

    const onLeaveIds = await getEmployeeIdsOnLeaveToday(prisma);
    const mappedEmployee = mapEmployee(employee, onLeaveIds);
    const byType = mapDocumentsByType(documents);
    if (byType.Experience_Letter?.url) mappedEmployee.experienceLetterUrl = byType.Experience_Letter.url;
    if (byType.Relieving_Letter?.url) mappedEmployee.relievingLetterUrl = byType.Relieving_Letter.url;
    if (byType.Payslip?.length) {
      mappedEmployee.payslipUrls = byType.Payslip.map((p) => p.url).filter(Boolean);
    }

    return Response.json({
      employee: mappedEmployee,
      canEdit: Boolean(getEditScope(user, id)),
      editScope: getEditScope(user, id),
      lookups,
      attendance: attendance.map((a) => ({
        date: a.attendanceDate.toISOString().split("T")[0],
        status: a.attendanceStatus.replace("_", " "),
        inTime: a.inTime ? a.inTime.toISOString().slice(11, 16) : "-",
        outTime: a.outTime ? a.outTime.toISOString().slice(11, 16) : "-",
      })),
      leaves: leaves.map((l) => ({
        type: l.leaveType?.leaveName || "—",
        from: l.fromDate.toISOString().split("T")[0],
        to: l.toDate.toISOString().split("T")[0],
        days: Number(l.totalDays),
        status: l.finalStatus,
      })),
      documents: documents.map((d) => mapEmployeeDocument(d)),
    });
  } catch (err) {
    console.error("GET /api/employees/[id] failed:", err);
    return Response.json(
      {
        error: "Failed to load employee",
        detail: process.env.NODE_ENV === "development" ? String(err?.message || err) : undefined,
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  const { user, error } = await requireAuth(request);
  if (error) return error;

  const id = parseInt(params.id, 10);
  const editScope = getEditScope(user, id);

  if (!editScope) {
    return forbiddenResponse();
  }

  const existing = await prisma.employee.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const isSelfOnly = editScope === "self";
  let normalizedInput = null;

  if (!isSelfOnly) {
    const merged = {
      ...existing,
      ...body,
      employeeCode: body.employeeCode ?? existing.employeeCode,
      firstName: body.firstName ?? existing.firstName,
      lastName: body.lastName ?? existing.lastName,
      mobile: body.mobile ?? existing.mobile,
      email: body.email ?? existing.email,
      pan: body.pan ?? existing.pan,
      aadhaar: body.aadhaar ?? existing.aadhaar,
      departmentId: body.departmentId ?? existing.departmentId,
      designationId: body.designationId ?? existing.designationId,
      joiningDate: body.joiningDate
        ? body.joiningDate
        : existing.joiningDate?.toISOString().split("T")[0],
      employeeCategory: body.employeeCategory ?? existing.employeeCategory,
    };

    const validation = validateEmployeeForm(merged, { isEdit: true, checkConfirmPassword: false });
    if (!validation.valid) {
      return validationErrorResponse(validation.fieldErrors, validation.summary);
    }

    const duplicateCheck = await checkEmployeeDuplicates(prisma, validation.normalized, id);
    if (!duplicateCheck.valid) {
      return validationErrorResponse(duplicateCheck.fieldErrors, duplicateCheck.summary);
    }
    normalizedInput = validation.normalized;
  } else {
    normalizedInput = normalizeEmployeeInput({
      mobile: body.mobile ?? existing.mobile,
      alternateMobile: body.alternateMobile ?? existing.alternateMobile,
      email: body.email ?? existing.email,
    });
    const fieldErrors = {};
    const mobileCheck = validateMobile(normalizedInput.mobile);
    if (!mobileCheck.valid) fieldErrors.mobile = mobileCheck.message;
    if (normalizedInput.alternateMobile) {
      const altCheck = validateMobile(normalizedInput.alternateMobile, {
        required: false,
        field: "alternateMobile",
      });
      if (!altCheck.valid) fieldErrors.alternateMobile = altCheck.message;
    }
    if (!normalizedInput.email?.trim()) fieldErrors.email = "Email is required.";
    if (Object.keys(fieldErrors).length) {
      return validationErrorResponse(fieldErrors);
    }
    const duplicateCheck = await checkEmployeeDuplicates(prisma, normalizedInput, id);
    if (!duplicateCheck.valid) {
      return validationErrorResponse(duplicateCheck.fieldErrors, duplicateCheck.summary);
    }
  }

  if (!isSelfOnly && body.employeeCategory) {
    const categoryValidation = validateEmployeeCategory(body);
    if (!categoryValidation.valid) {
      const fieldErrors = mapCategoryErrorsToFields(categoryValidation.errors);
      return validationErrorResponse(fieldErrors, categoryValidation.errors[0]);
    }
  }

  const updateData = {};

  const fields = [
    "firstName", "lastName", "gender", "bloodGroup", "motherName", "fatherName", "maritalStatus",
    "spouseName", "religion", "nationality",
    "mobile", "alternateMobile",
    "email", "address", "temporaryAddress", "emergencyContact", "bankName", "accountNumber", "ifscCode", "pan", "aadhaar",
  ];
  fields.forEach((f) => {
    if (body[f] !== undefined) {
      if (!isSelfOnly || SELF_EDIT_FIELDS.has(f)) {
        if (f === "mobile" && normalizedInput?.mobile) updateData.mobile = normalizedInput.mobile;
        else if (f === "alternateMobile" && normalizedInput) {
          updateData.alternateMobile = normalizedInput.alternateMobile || null;
        } else if (f === "email" && normalizedInput?.email) updateData.email = normalizedInput.email;
        else if (f === "pan" && normalizedInput?.pan !== undefined) updateData.pan = normalizedInput.pan || null;
        else if (f === "aadhaar" && normalizedInput?.aadhaar !== undefined) {
          updateData.aadhaar = normalizedInput.aadhaar || null;
        } else if (f === "bankName" && normalizedInput?.bankName !== undefined) {
          updateData.bankName = normalizedInput.bankName || null;
        } else if (f === "accountNumber" && normalizedInput?.accountNumber !== undefined) {
          updateData.accountNumber = normalizedInput.accountNumber || null;
        } else if (f === "ifscCode" && normalizedInput?.ifscCode !== undefined) {
          updateData.ifscCode = normalizedInput.ifscCode || null;
        } else if (
          f === "motherName" ||
          f === "fatherName" ||
          f === "maritalStatus" ||
          f === "spouseName" ||
          f === "religion" ||
          f === "nationality" ||
          f === "address" ||
          f === "temporaryAddress"
        ) {
          const raw = normalizedInput?.[f] !== undefined ? normalizedInput[f] : body[f];
          updateData[f] = String(raw || "").trim() || null;
        } else {
          updateData[f] = body[f];
        }
      }
    }
  });
  if (body.profilePhoto === null && (!isSelfOnly || SELF_EDIT_FIELDS.has("profilePhoto"))) {
    updateData.profilePhoto = null;
  }
  if (body.dob && (!isSelfOnly || SELF_EDIT_FIELDS.has("dob"))) updateData.dob = new Date(body.dob);

  if (!isSelfOnly) {
    if (body.departmentId) updateData.departmentId = parseInt(body.departmentId, 10);
    if (body.designationId) updateData.designationId = parseInt(body.designationId, 10);

    const nextDepartmentId = updateData.departmentId ?? existing.departmentId;
    const nextDesignationId = updateData.designationId ?? existing.designationId;

    if (body.departmentId || body.designationId) {
      const designationCheck = await validateDesignationForDepartment(
        prisma,
        nextDesignationId,
        nextDepartmentId
      );
      if (!designationCheck.valid) {
        return Response.json({ error: designationCheck.message }, { status: 400 });
      }
    }

    if (
      body.designationId &&
      parseInt(body.designationId, 10) !== existing.designationId
    ) {
      const newCode = await prisma.$transaction(async (tx) => {
        await releaseEmployeeCode(prisma, existing.employeeCode, existing.designationId, { tx });
        return assignEmployeeCode(prisma, parseInt(body.designationId, 10), { tx });
      });
      updateData.employeeCode = newCode;
      updateData.camAttendanceId = newCode;
    }

    if (body.roleId) updateData.roleId = parseInt(body.roleId, 10);
    if (body.joiningDate) updateData.joiningDate = new Date(body.joiningDate);
    if (body.employmentType) {
      updateData.employmentType = String(body.employmentType).replace(/ /g, "_");
    }
    if (body.status) {
      const parsedStatus = parseStatusInput(body.status);
      if (!parsedStatus || !isValidDbStatus(parsedStatus)) {
        return Response.json({ error: "Invalid employee status" }, { status: 400 });
      }
      updateData.status = parsedStatus;
    }
    if (body.reportingManagerId === null || body.reportingManagerId === "") {
      updateData.reportingManagerId = null;
    } else if (body.reportingManagerId !== undefined) {
      updateData.reportingManagerId = parseInt(body.reportingManagerId, 10);
    }
    if (body.employeeCategory) {
      Object.assign(updateData, buildCategoryData(body));
    } else if (body.qualification !== undefined || body.skills !== undefined) {
      if (body.qualification !== undefined) updateData.qualification = body.qualification?.trim() || null;
      if (body.specialization !== undefined) updateData.specialization = body.specialization?.trim() || null;
      if (body.skills !== undefined) updateData.skills = body.skills?.trim() || null;
    }
  } else if (body.skills !== undefined && SELF_EDIT_FIELDS.has("skills")) {
    updateData.skills = body.skills?.trim() || null;
  }
  if (body.firstName !== undefined || body.lastName !== undefined) {
    updateData.firstName = body.firstName ?? existing.firstName;
    updateData.lastName = body.lastName ?? existing.lastName;
    updateData.fullName = `${updateData.firstName} ${updateData.lastName}`.trim();
  }
  if (body.password?.trim() && !isSelfOnly) {
    if (body.password.length < 6) {
      return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }
    updateData.passwordHash = await hashPassword(body.password);
  }

  updateData.updatedBy = user.id;

  try {
  const employee = await prisma.employee.update({
    where: { id },
    data: updateData,
    include: { department: true, designation: true, reportingManager: true, role: true },
  });

  if (employee.bankName) {
    await ensureBankExists(prisma, employee.bankName);
  }

  await createAuditLog({
    userId: user.id,
    moduleName: "Employee Management",
    actionType: "UPDATE",
    oldValue: { employeeCode: existing.employeeCode, ...existing },
    newValue: updateData,
  });

  await createNotification({
    employeeId: id,
    title: "Profile Updated",
    message: "Your employee profile has been updated.",
    module: "Employee Self-Service",
  });

  return Response.json({ employee: mapEmployee(employee, await getEmployeeIdsOnLeaveToday(prisma)) });
  } catch (err) {
    console.error("Update employee error:", err);
    const dup = mapPrismaDuplicateError(err);
    if (dup) {
      return Response.json(
        { error: dup.message, field: dup.field, fields: dup.fields },
        { status: 400 }
      );
    }
    return Response.json({ error: err.message || "Failed to update employee" }, { status: 400 });
  }
}

export async function DELETE(request, { params }) {
  const { user, error } = await requirePermission(request, "Employee Management");
  if (error) return error;

  const id = parseInt(params.id, 10);
  if (Number.isNaN(id)) {
    return Response.json({ error: "Invalid employee id" }, { status: 400 });
  }

  if (id === user.id) {
    return Response.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  const existing = await prisma.employee.findUnique({
    where: { id },
    include: { role: true },
  });
  if (!existing) {
    return Response.json({ error: "Employee not found" }, { status: 404 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.attendanceCorrection.deleteMany({ where: { employeeId: id } });
      await tx.attendance.deleteMany({ where: { employeeId: id } });
      await tx.leaveRequest.deleteMany({ where: { employeeId: id } });
      await tx.reportDownloadLog.deleteMany({ where: { generatedBy: id } });
      await tx.employee.updateMany({
        where: { reportingManagerId: id },
        data: { reportingManagerId: null },
      });
      await tx.employee.delete({ where: { id } });
    });

    try {
      await createAuditLog({
        userId: user.id,
        moduleName: "Employee Management",
        actionType: "DELETE",
        oldValue: {
          employeeCode: existing.employeeCode,
          name: existing.fullName,
          email: existing.email,
        },
      });
    } catch (auditErr) {
      console.error("Employee delete audit log failed:", auditErr);
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("Delete employee error:", err);
    return Response.json(
      { error: err.message || "Failed to delete employee. Remove related records and try again." },
      { status: 400 }
    );
  }
}
