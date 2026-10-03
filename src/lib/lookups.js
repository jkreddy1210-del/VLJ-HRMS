/** Server-side source of truth for dropdown / filter options across the app. */

export function formatEnumLabel(value) {
  if (!value) return "";
  return String(value).replace(/_/g, " ");
}

export const GENDERS = [
  { value: "Male", label: "Male" },
  { value: "Female", label: "Female" },
  { value: "Other", label: "Other" },
];

export const BLOOD_GROUPS = [
  "A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-",
].map((value) => ({ value, label: value }));

export const MARITAL_STATUSES = [
  { value: "Single", label: "Single" },
  { value: "Married", label: "Married" },
  { value: "Divorced", label: "Divorced" },
  { value: "Widowed", label: "Widowed" },
];

export const RELIGIONS = [
  { value: "Hindu", label: "Hindu" },
  { value: "Muslim", label: "Muslim" },
  { value: "Christian", label: "Christian" },
  { value: "Sikh", label: "Sikh" },
  { value: "Buddhist", label: "Buddhist" },
  { value: "Jain", label: "Jain" },
  { value: "Other", label: "Other" },
];

export const NATIONALITIES = [
  { value: "Indian", label: "Indian" },
  { value: "Other", label: "Other" },
];

export const EMPLOYMENT_TYPES = [
  { value: "Full_Time", label: "Full Time" },
  { value: "Part_Time", label: "Part Time" },
  { value: "Contract", label: "Contract" },
  { value: "Intern", label: "Intern" },
];

export const EMPLOYEE_STATUSES = [
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive" },
  { value: "On_Hold", label: "On Hold" },
  { value: "Terminated", label: "Terminated" },
];

export const EMPLOYEE_LIST_STATUS_FILTERS = [
  { value: "all", label: "All Status" },
  ...EMPLOYEE_STATUSES,
  { value: "On Leave", label: "On Leave" },
];

export const EMPLOYEE_CATEGORIES = [
  { value: "Fresher", label: "Fresher" },
  { value: "Experienced", label: "Experienced" },
];

export const EMPLOYEE_CATEGORY_FILTERS = [
  { value: "all", label: "All Categories" },
  ...EMPLOYEE_CATEGORIES,
];

export const LEAVE_REQUEST_STATUS_FILTERS = [
  { value: "all", label: "All Status" },
  { value: "Pending", label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
];

export function buildDepartmentFilterOptions(departments, allLabel = "All Departments") {
  return [
    { value: "all", label: allLabel },
    ...departments.map((d) => ({
      id: d.id,
      value: d.departmentName || d.value,
      label: d.departmentName || d.label,
    })),
  ];
}

export function buildDesignationFilterOptions(designations, allLabel = "All Designations") {
  return [
    { value: "all", label: allLabel },
    ...designations.map((d) => ({
      id: d.id,
      value: d.designationName || d.value,
      label: d.designationName || d.label,
      departmentId: d.departmentId,
    })),
  ];
}

export function buildReportDepartmentOptions(departments, allLabel = "All Departments") {
  return [
    { value: "All Departments", label: allLabel },
    ...departments.map((d) => ({
      id: d.id,
      value: d.departmentName || d.value,
      label: d.departmentName || d.label,
    })),
  ];
}

export const ATTENDANCE_STATUS_REGISTRY = [
  { apiValue: "present", label: "Present", dbEnum: "Present", markable: true, filterable: true, requiresInTime: true },
  { apiValue: "absent", label: "Absent", dbEnum: "Absent", markable: true, filterable: true, requiresInTime: false },
  { apiValue: "halfDay", label: "Half Day", dbEnum: "Half_Day", markable: true, filterable: true, requiresInTime: true },
  { apiValue: "leave", label: "Leave", dbEnum: "Leave", markable: true, filterable: true, requiresInTime: false },
  { apiValue: "late", label: "Late", dbEnum: "Late", markable: false, filterable: true, requiresInTime: true },
];

export function getAttendanceMarkStatuses() {
  return ATTENDANCE_STATUS_REGISTRY.filter((s) => s.markable).map(
    ({ apiValue, label, dbEnum, requiresInTime }) => ({
      value: apiValue,
      label,
      dbEnum,
      requiresInTime,
    })
  );
}

export function getAttendanceListFilters() {
  return [
    { value: "all", label: "All Employees" },
    ...ATTENDANCE_STATUS_REGISTRY.filter((s) => s.markable).map((s) => ({
      value: s.label,
      label: s.label,
    })),
  ];
}

export function resolveMarkStatusToDb(apiValue) {
  const entry = ATTENDANCE_STATUS_REGISTRY.find((s) => s.apiValue === apiValue && s.markable);
  return entry?.dbEnum || null;
}

export function resolveDisplayStatusToMarkApi(displayStatus) {
  if (!displayStatus) return null;
  const normalized = String(displayStatus).trim();
  const entry = ATTENDANCE_STATUS_REGISTRY.find(
    (s) => formatEnumLabel(s.dbEnum) === normalized || s.label === normalized
  );
  return entry?.markable ? entry.apiValue : null;
}

export function markStatusRequiresInTime(apiValue) {
  const entry = ATTENDANCE_STATUS_REGISTRY.find((s) => s.apiValue === apiValue);
  return Boolean(entry?.requiresInTime);
}

export function dbStatusRequiresInTime(dbEnum) {
  const entry = ATTENDANCE_STATUS_REGISTRY.find((s) => s.dbEnum === dbEnum);
  return Boolean(entry?.requiresInTime);
}

export function resolveFilterStatusToDb(filterValue) {
  if (!filterValue || filterValue === "all" || filterValue === "Absent") return null;
  const entry = ATTENDANCE_STATUS_REGISTRY.find(
    (s) => formatEnumLabel(s.dbEnum) === filterValue || s.label === filterValue
  );
  return entry?.dbEnum || filterValue;
}

export const ATTENDANCE_MARK_STATUSES = getAttendanceMarkStatuses();

export const ATTENDANCE_LIST_FILTERS = getAttendanceListFilters();

export const MONTHS = [
  { value: "January", label: "January" },
  { value: "February", label: "February" },
  { value: "March", label: "March" },
  { value: "April", label: "April" },
  { value: "May", label: "May" },
  { value: "June", label: "June" },
  { value: "July", label: "July" },
  { value: "August", label: "August" },
  { value: "September", label: "September" },
  { value: "October", label: "October" },
  { value: "November", label: "November" },
  { value: "December", label: "December" },
];

export function buildReportYears(centerYear = new Date().getFullYear(), span = 5) {
  const start = centerYear - Math.floor(span / 2);
  return Array.from({ length: span }, (_, i) => {
    const year = String(start + i);
    return { value: year, label: year };
  });
}

export function leaveNameToKey(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "";
  return parts
    .map((part, index) => {
      const lower = part.toLowerCase();
      return index === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
}

const LEAVE_CARD_STYLES = [
  { color: "text-emerald-500", bg: "bg-emerald-500/10", icon: "Palmtree" },
  { color: "text-red-500", bg: "bg-red-500/10", icon: "Heart" },
  { color: "text-amber-500", bg: "bg-amber-500/10", icon: "Star" },
  { color: "text-purple-500", bg: "bg-purple-500/10", icon: "Gift" },
  { color: "text-champagne", bg: "bg-champagne/10", icon: "RefreshCw" },
  { color: "text-cyan-500", bg: "bg-cyan-500/10", icon: "CalendarDays" },
  { color: "text-rose-500", bg: "bg-rose-500/10", icon: "Clock" },
];

export function buildLeaveTypeMeta(leaveTypes = []) {
  return leaveTypes.map((type, index) => {
    const style = LEAVE_CARD_STYLES[index % LEAVE_CARD_STYLES.length];
    const leaveName = type.leaveName || type;
    const key = leaveNameToKey(leaveName);
    return {
      id: type.id ?? null,
      leaveName,
      key,
      label: leaveName,
      yearlyLimit: type.yearlyLimit ?? null,
      ...style,
    };
  });
}

export function mapRoleOption(role) {
  return {
    id: role.id,
    roleName: role.roleName,
    label: formatEnumLabel(role.roleName).replace(/\b\w/g, (c) => c.toUpperCase()),
  };
}
