import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  requirePermission,
  hashPassword,
  canManageEmployees,
} from "@/lib/auth-server";
import { createAuditLog } from "@/lib/audit";
import { createNotification, getUsersByRole, notifyUsers } from "@/lib/notifications";
import { mapEmployee } from "@/lib/employee-mapper";
import { validateEmployeeCategory, buildCategoryData } from "@/lib/employee-category";
import {
  assignEmployeeCode,
  validateDesignationForDepartment,
} from "@/lib/employee-id";
import {
  getEmployeeIdsOnLeaveToday,
  applyStatusFilter,
  parseStatusInput,
  isValidDbStatus,
} from "@/lib/employee-status";
import {
  validateEmployeeForm,
  checkEmployeeDuplicates,
  mapPrismaDuplicateError,
  validationErrorResponse,
  mapCategoryErrorsToFields,
} from "@/lib/employee-validation";
import {
  EMPLOYEE_LIST_STATUS_FILTERS,
  EMPLOYEE_CATEGORY_FILTERS,
  buildDepartmentFilterOptions,
  buildDesignationFilterOptions,
} from "@/lib/lookups";
import { parsePagination, buildListPagination } from "@/lib/pagination";
import { ensureBankExists } from "@/lib/banks";

export async function GET(request) {
  const { user, error } = await requireAuth(request);
  if (error) return error;

  try {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const department = searchParams.get("department");
  const designation = searchParams.get("designation");
  const status = searchParams.get("status");
  const employeeCategory = searchParams.get("employeeCategory");

  const onLeaveIds = await getEmployeeIdsOnLeaveToday(prisma);

  const where = { AND: [] };

  if (!canManageEmployees(user)) {
    where.AND.push({ id: user.id });
  }

  if (search) {
    where.AND.push({
      OR: [
        { employeeCode: { contains: search } },
        { fullName: { contains: search } },
        { mobile: { contains: search } },
        { department: { departmentName: { contains: search } } },
      ],
    });
  }
  if (department && department !== "all") {
    where.AND.push({ department: { departmentName: department } });
  }
  if (designation && designation !== "all") {
    where.AND.push({ designation: { designationName: designation } });
  }
  if (status && status !== "all") {
    applyStatusFilter(where, status, onLeaveIds);
  }
  if (employeeCategory && employeeCategory !== "all") {
    if (["Fresher", "Experienced"].includes(employeeCategory)) {
      where.AND.push({ employeeCategory });
    }
  }

  const isPrintExport = searchParams.get("export") === "print";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const maxLimit = isPrintExport ? 5000 : 100;
  const defaultLimit = isPrintExport ? 5000 : 25;
  const limit = Math.min(
    maxLimit,
    Math.max(1, parseInt(searchParams.get("limit") || String(defaultLimit), 10))
  );
  const skip = isPrintExport ? 0 : (page - 1) * limit;
  const whereClause = where.AND.length ? where : undefined;

  const [employees, total, departmentRows, designationRows] = await Promise.all([
    prisma.employee.findMany({
      where: whereClause,
      include: {
        department: true,
        designation: true,
        reportingManager: true,
      },
      orderBy: { employeeCode: "asc" },
      skip,
      take: limit,
    }),
    prisma.employee.count({ where: whereClause }),
    prisma.department.findMany({ orderBy: { departmentName: "asc" } }),
    prisma.designation.findMany({ orderBy: { designationName: "asc" } }),
  ]);

  const departmentOptions = departmentRows.map((d) => ({
    id: d.id,
    value: d.departmentName,
    label: d.departmentName,
    departmentName: d.departmentName,
  }));
  const designationOptions = designationRows.map((d) => ({
    id: d.id,
    value: d.designationName,
    label: d.designationName,
    designationName: d.designationName,
    departmentId: d.departmentId,
  }));

  return Response.json({
    employees: employees.map((emp) => mapEmployee(emp, onLeaveIds)),
    pagination: buildListPagination({ page, limit, total }),
    filters: canManageEmployees(user)
      ? {
          departmentFilters: buildDepartmentFilterOptions(departmentOptions),
          designationFilters: buildDesignationFilterOptions(designationOptions),
          employeeStatusFilters: EMPLOYEE_LIST_STATUS_FILTERS,
          employeeCategoryFilters: EMPLOYEE_CATEGORY_FILTERS,
        }
      : null,
  });
  } catch (err) {
    console.error("List employees error:", err);
    return Response.json(
      { error: err.message || "Failed to load employees" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const { user, error } = await requirePermission(request, "Employee Management");
  if (error) return error;

  try {
    const body = await request.json();
    const validation = validateEmployeeForm(body, {
      isEdit: false,
      checkConfirmPassword: false,
      autoEmployeeCode: true,
    });
    if (!validation.valid) {
      return validationErrorResponse(validation.fieldErrors, validation.summary);
    }

    const normalized = validation.normalized;

    const designationCheck = await validateDesignationForDepartment(
      prisma,
      parseInt(normalized.designationId, 10),
      parseInt(normalized.departmentId, 10)
    );
    if (!designationCheck.valid) {
      return Response.json({ error: designationCheck.message }, { status: 400 });
    }

    const categoryValidation = validateEmployeeCategory(normalized);
    if (!categoryValidation.valid) {
      const fieldErrors = mapCategoryErrorsToFields(categoryValidation.errors);
      return validationErrorResponse(fieldErrors, categoryValidation.errors[0]);
    }

    const duplicateCheck = await checkEmployeeDuplicates(prisma, normalized);
    if (!duplicateCheck.valid) {
      return validationErrorResponse(duplicateCheck.fieldErrors, duplicateCheck.summary);
    }

    const employeeCode = await assignEmployeeCode(prisma, parseInt(normalized.designationId, 10));
    normalized.employeeCode = employeeCode;

    const employeeRole = await prisma.role.findUnique({ where: { roleName: "employee" } });
    if (!employeeRole) {
      return Response.json({ error: "Default employee role not found" }, { status: 400 });
    }

    const fullName = `${normalized.firstName} ${normalized.lastName}`.trim();
    const passwordHash = await hashPassword(body.password.trim());
    const categoryData = buildCategoryData(normalized);

    const statusInput = parseStatusInput(normalized.status) || "Active";
    if (!isValidDbStatus(statusInput)) {
      return Response.json({ error: "Invalid employee status" }, { status: 400 });
    }

    const employee = await prisma.employee.create({
      data: {
        employeeCode: normalized.employeeCode,
        camAttendanceId: normalized.employeeCode,
        firstName: normalized.firstName,
        lastName: normalized.lastName,
        fullName,
        dob: normalized.dob ? new Date(normalized.dob) : null,
        gender: normalized.gender || null,
        bloodGroup: normalized.bloodGroup || null,
        motherName: normalized.motherName || null,
        fatherName: normalized.fatherName || null,
        maritalStatus: normalized.maritalStatus || null,
        spouseName: normalized.spouseName || null,
        religion: normalized.religion || null,
        nationality: normalized.nationality || null,
        mobile: normalized.mobile,
        alternateMobile: normalized.alternateMobile || null,
        email: normalized.email,
        passwordHash,
        roleId: normalized.roleId ? parseInt(normalized.roleId, 10) : employeeRole.id,
        address: normalized.address || null,
        temporaryAddress: normalized.temporaryAddress || null,
        departmentId: parseInt(normalized.departmentId, 10),
        designationId: parseInt(normalized.designationId, 10),
        reportingManagerId: normalized.reportingManagerId
          ? parseInt(normalized.reportingManagerId, 10)
          : null,
        joiningDate: new Date(normalized.joiningDate),
        employmentType: normalized.employmentType || "Full_Time",
        status: statusInput,
        emergencyContact: normalized.emergencyContact || null,
        bankName: normalized.bankName || null,
        accountNumber: normalized.accountNumber || null,
        ifscCode: normalized.ifscCode || null,
        pan: normalized.pan || null,
        aadhaar: normalized.aadhaar || null,
        ...categoryData,
        createdBy: user.id,
      },
      include: { department: true, designation: true },
    });

    if (employee.bankName) {
      await ensureBankExists(prisma, employee.bankName);
    }

    const year = new Date().getFullYear();
    const leaveTypes = await prisma.leaveType.findMany();
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

    await createAuditLog({
      userId: user.id,
      moduleName: "Employee Management",
      actionType: "CREATE",
      newValue: { employeeCode: employee.employeeCode, name: employee.fullName },
    });

    const hrUsers = await getUsersByRole("hr");
    const adminUsers = await getUsersByRole("admin");
    const superAdminUsers = await getUsersByRole("super_admin");
    await notifyUsers([...hrUsers, ...adminUsers, ...superAdminUsers], {
      title: "Employee Added",
      message: `New employee ${employee.fullName} (${employee.employeeCode}) has been added.`,
      module: "Employee Management",
    });

    return Response.json({ employee: mapEmployee(employee, new Set()) }, { status: 201 });
  } catch (err) {
    console.error("Create employee error:", err);
    const dup = mapPrismaDuplicateError(err);
    if (dup) {
      return Response.json(
        { error: dup.message, field: dup.field, fields: dup.fields },
        { status: 400 }
      );
    }
    return Response.json({ error: err.message || "Failed to create employee" }, { status: 400 });
  }
}
