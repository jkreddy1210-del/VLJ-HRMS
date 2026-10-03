import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  canManageEmployees,
  canViewAttendance,
} from "@/lib/auth-server";
import {
  getAttendanceMarkStatuses,
  getAttendanceListFilters,
} from "@/lib/attendance-status-server";
import {
  GENDERS,
  BLOOD_GROUPS,
  MARITAL_STATUSES,
  RELIGIONS,
  NATIONALITIES,
  EMPLOYMENT_TYPES,
  EMPLOYEE_STATUSES,
  EMPLOYEE_LIST_STATUS_FILTERS,
  EMPLOYEE_CATEGORIES,
  EMPLOYEE_CATEGORY_FILTERS,
  MONTHS,
  buildReportYears,
  buildLeaveTypeMeta,
  mapRoleOption,
  buildDepartmentFilterOptions,
  buildDesignationFilterOptions,
  buildReportDepartmentOptions,
  LEAVE_REQUEST_STATUS_FILTERS,
} from "@/lib/lookups";
import { getPaginationConfig } from "@/lib/pagination";
import { findReportingManagers } from "@/lib/reporting-managers";
import { listBanks } from "@/lib/banks";

export async function GET(request) {
  const { user, error } = await requireAuth(request);
  if (error) return error;

  const canManage = canManageEmployees(user);
  const canAttendance = canViewAttendance(user);

  const [departments, designations, leaveTypes, roles, managers, banks, attendanceMarkStatuses, attendanceStatusFilters] =
    await Promise.all([
    canManage || canAttendance
      ? prisma.department.findMany({ orderBy: { departmentName: "asc" } })
      : Promise.resolve([]),
    canManage
      ? prisma.designation.findMany({
          orderBy: [{ department: { departmentName: "asc" } }, { designationName: "asc" }],
          include: { department: true },
        })
      : Promise.resolve([]),
    prisma.leaveType.findMany({ orderBy: { leaveName: "asc" } }),
    canManage
      ? prisma.role.findMany({ orderBy: { roleName: "asc" } })
      : Promise.resolve([]),
    canManage ? findReportingManagers(prisma) : Promise.resolve([]),
    canManage ? listBanks(prisma) : Promise.resolve([]),
    canAttendance ? getAttendanceMarkStatuses(prisma) : Promise.resolve([]),
    canAttendance ? getAttendanceListFilters(prisma) : Promise.resolve([]),
  ]);

  const departmentOptions = departments.map((d) => ({
    id: d.id,
    value: d.departmentName,
    label: d.departmentName,
    departmentName: d.departmentName,
    departmentCode: d.departmentCode,
  }));

  const designationOptions = designations.map((d) => ({
    id: d.id,
    value: d.designationName,
    label: d.designationName,
    designationName: d.designationName,
    designationCode: d.designationCode,
    departmentId: d.departmentId,
    sequenceStart: d.sequenceStart,
  }));

  return Response.json({
    departments: departmentOptions,
    designations: designationOptions,
    departmentFilters: buildDepartmentFilterOptions(departmentOptions),
    designationFilters: buildDesignationFilterOptions(designationOptions),
    reportDepartmentOptions: buildReportDepartmentOptions(departmentOptions),
    genders: GENDERS,
    bloodGroups: BLOOD_GROUPS,
    maritalStatuses: MARITAL_STATUSES,
    religions: RELIGIONS,
    nationalities: NATIONALITIES,
    employmentTypes: EMPLOYMENT_TYPES,
    employeeStatuses: EMPLOYEE_STATUSES,
    employeeStatusFilters: canManage ? EMPLOYEE_LIST_STATUS_FILTERS : [],
    employeeCategories: EMPLOYEE_CATEGORIES,
    employeeCategoryFilters: canManage ? EMPLOYEE_CATEGORY_FILTERS : [],
    attendanceMarkStatuses,
    attendanceStatusFilters,
    attendanceDepartmentFilters: canAttendance ? buildDepartmentFilterOptions(departmentOptions) : [],
    leaveRequestStatusFilters: LEAVE_REQUEST_STATUS_FILTERS,
    months: canManage || canAttendance ? MONTHS : [],
    reportYears: canManage || canAttendance ? buildReportYears() : [],
    leaveTypes: leaveTypes.map((t) => ({
      id: t.id,
      leaveName: t.leaveName,
      yearlyLimit: t.yearlyLimit,
      key: buildLeaveTypeMeta([t])[0]?.key,
    })),
    leaveTypeMeta: buildLeaveTypeMeta(leaveTypes),
    roles: roles.map(mapRoleOption),
    managers,
    banks,
    pagination: getPaginationConfig(),
  });
}
