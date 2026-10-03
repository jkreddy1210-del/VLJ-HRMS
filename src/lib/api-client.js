const API_BASE = "/api";

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("emp_token");
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(data.error || "Request failed");
    error.field = data.field;
    error.fields = data.fields;
    throw error;
  }
  return data;
}

export const api = {
  login: (body) => apiFetch("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  forgotPassword: (body) => apiFetch("/auth/forgot-password", { method: "POST", body: JSON.stringify(body) }),
  resetPassword: (body) => apiFetch("/auth/reset-password", { method: "POST", body: JSON.stringify(body) }),
  changePassword: (body) => apiFetch("/auth/change-password", { method: "POST", body: JSON.stringify(body) }),
  me: () => apiFetch("/auth/me"),
  dashboard: () => apiFetch("/dashboard"),
  dashboardCalendar: (params) =>
    apiFetch(`/dashboard/calendar?${new URLSearchParams(params || {})}`),
  notifications: () => apiFetch("/notifications"),
  markNotificationRead: (id) => apiFetch(`/notifications/${id}`, { method: "PATCH", body: JSON.stringify({ isRead: true }) }),
  employees: (params) => apiFetch(`/employees?${new URLSearchParams(params || {})}`),
  employee: (id) => apiFetch(`/employees/${id}`),
  createEmployee: (body) => apiFetch("/employees", { method: "POST", body: JSON.stringify(body) }),
  updateEmployee: (id, body) => apiFetch(`/employees/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteEmployee: (id) => apiFetch(`/employees/${id}`, { method: "DELETE" }),
  uploadEmployeeDocument: async (employeeId, documentType, file) => {
    const token = getToken();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("documentType", documentType);
    const res = await fetch(`${API_BASE}/employees/${employeeId}/documents`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(data.error || "Upload failed");
      error.field = data.field;
      error.fields = data.fields;
      throw error;
    }
    return data;
  },
  uploadEmployeePhoto: async (employeeId, file) => {
    const token = getToken();
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/employees/${employeeId}/photo`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(data.error || "Photo upload failed");
      error.field = data.field;
      error.fields = data.fields;
      throw error;
    }
    return data;
  },
  deleteEmployeePhoto: (employeeId) =>
    apiFetch(`/employees/${employeeId}/photo`, { method: "DELETE" }),
  downloadEmployeeBulkTemplate: async () => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/employees/bulk-upload/template`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Download failed");
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "employee-bulk-upload-template.xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
  bulkUploadEmployees: async (file) => {
    const token = getToken();
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/employees/bulk-upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Upload failed");
    return data;
  },
  attendance: (params) => {
    const query = new URLSearchParams();
    if (typeof params === "string") {
      query.set("date", params);
    } else if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          query.set(key, String(value));
        }
      });
    }
    return apiFetch(`/attendance?${query}`);
  },
  markAttendance: (body) => apiFetch("/attendance", { method: "POST", body: JSON.stringify(body) }),
  attendanceMarkSheet: (params) => apiFetch(`/attendance/mark-sheet?${new URLSearchParams(params || {})}`),
  bulkMarkAttendance: (body) => apiFetch("/attendance/bulk", { method: "POST", body: JSON.stringify(body) }),
  attendanceMarkStatuses: () => apiFetch("/attendance/mark-statuses"),
  downloadAttendanceMonthlyBulkTemplate: async () => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/reports/attendance/bulk-upload/template`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Download failed");
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "attendance-monthly-report-template.xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
  bulkUploadAttendanceMonthly: async (file) => {
    const token = getToken();
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/reports/attendance/bulk-upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Upload failed");
    return data;
  },
  submitAttendanceCorrection: (body) =>
    apiFetch("/attendance/corrections", { method: "POST", body: JSON.stringify(body) }),
  processAttendanceCorrection: (id, body) =>
    apiFetch(`/attendance/corrections/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  leaves: (params) => apiFetch(`/leaves?${new URLSearchParams(params || {})}`),
  applyLeave: (body) => apiFetch("/leaves", { method: "POST", body: JSON.stringify(body) }),
  updateLeave: (id, body) => apiFetch(`/leaves/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  roles: () => apiFetch("/roles"),
  employeeNextCode: (params) =>
    apiFetch(`/employees/next-code?${new URLSearchParams(params)}`),
  createRole: (body) => apiFetch("/roles", { method: "POST", body: JSON.stringify(body) }),
  updateRole: (id, body) => apiFetch(`/roles/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteRole: (id) => apiFetch(`/roles/${id}`, { method: "DELETE" }),
  permissions: () => apiFetch("/permissions"),
  createPermission: (body) => apiFetch("/permissions", { method: "POST", body: JSON.stringify(body) }),
  updatePermission: (id, body) => apiFetch(`/permissions/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deletePermission: (id) => apiFetch(`/permissions/${id}`, { method: "DELETE" }),
  assignRolePermission: (body) => apiFetch("/role-permissions", { method: "POST", body: JSON.stringify(body) }),
  removeRolePermission: (body) => apiFetch("/role-permissions", { method: "DELETE", body: JSON.stringify(body) }),
  departments: (params) => apiFetch(`/departments?${new URLSearchParams(params || {})}`),
  createDepartment: (body) => apiFetch("/departments", { method: "POST", body: JSON.stringify(body) }),
  updateDepartment: (id, body) => apiFetch(`/departments/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteDepartment: (id) => apiFetch(`/departments/${id}`, { method: "DELETE" }),
  designations: (params) => apiFetch(`/designations?${new URLSearchParams(params || {})}`),
  createDesignation: (body) => apiFetch("/designations", { method: "POST", body: JSON.stringify(body) }),
  updateDesignation: (id, body) => apiFetch(`/designations/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteDesignation: (id) => apiFetch(`/designations/${id}`, { method: "DELETE" }),
  reportEmployees: (department) => apiFetch(`/reports/employees?department=${encodeURIComponent(department || "")}`),
  attendanceReport: (params) => apiFetch(`/reports/attendance?${new URLSearchParams(params || {})}`),
  shifts: (params) => apiFetch(`/shifts?${new URLSearchParams(params || {})}`),
  shiftDepartments: (params) => apiFetch(`/shifts/departments?${new URLSearchParams(params || {})}`),
  createShift: (body) => apiFetch("/shifts", { method: "POST", body: JSON.stringify(body) }),
  updateShift: (id, body) => apiFetch(`/shifts/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteShift: (id) => apiFetch(`/shifts/${id}`, { method: "DELETE" }),
  lookups: () => apiFetch("/lookups"),
  banks: () => apiFetch("/banks"),
  createBank: (body) => apiFetch("/banks", { method: "POST", body: JSON.stringify(body) }),
};
