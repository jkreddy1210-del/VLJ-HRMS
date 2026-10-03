import jwt from "jsonwebtoken";

import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

import { getEmployeePermissions } from "@/lib/permissions-server";
import { getLocalDateString } from "@/lib/utils";
import { resolveEmployeePhoto } from "@/lib/profile-photo";



const JWT_SECRET = process.env.JWT_SECRET || "vlj-hrms-dev-secret-change-in-production";

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";



export async function hashPassword(password) {

  return bcrypt.hash(password, 12);

}



export async function verifyPassword(password, hash) {

  return bcrypt.compare(password, hash);

}



export function signToken(payload) {

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

}



export function verifyToken(token) {

  try {

    return jwt.verify(token, JWT_SECRET);

  } catch {

    return null;

  }

}



export async function getAuthUser(request) {

  const authHeader = request.headers.get("authorization");

  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) return null;



  const decoded = verifyToken(token);

  const employeeId = decoded?.employeeId ?? decoded?.userId;

  if (!employeeId) return null;



  const employee = await prisma.employee.findUnique({

    where: { id: employeeId, status: "Active" },

    include: {

      role: true,

      department: true,

      designation: true,

    },

  });



  if (!employee) return null;



  const permissions = await getEmployeePermissions(employee.id, employee.roleId);



  return {

    id: employee.id,

    employeeId: employee.id,

    email: employee.email,

    role: employee.role.roleName,

    roleId: employee.roleId,

    employeeCode: employee.employeeCode,

    name: employee.fullName,

    avatar: resolveEmployeePhoto(employee),

    department: employee.department?.departmentName || null,

    designation: employee.designation?.designationName || null,

    permissions,

  };

}



export function unauthorizedResponse() {

  return Response.json({ error: "Unauthorized" }, { status: 401 });

}



export function forbiddenResponse() {

  return Response.json({ error: "Forbidden" }, { status: 403 });

}



export function canManageRoles(user) {

  return user?.role === "admin" || user?.role === "super_admin";

}



export function canManageOrgSettings(user) {

  if (!user?.permissions) return false;

  if (hasFullAccess(user)) return true;

  return user.permissions.includes("Department Management") || user.permissions.includes("Employee Management");

}



export async function requireOrgManagement(request) {

  const { user, error } = await requireAuth(request);

  if (error) return { user: null, error };

  if (!canManageOrgSettings(user)) return { user: null, error: forbiddenResponse() };

  return { user, error: null };

}



export function hasFullAccess(user) {

  return (

    user?.permissions?.includes("Full System Access") ||

    user?.permissions?.includes("All Permissions")

  );

}



export function canManageEmployees(user) {

  if (!user) return false;

  return hasFullAccess(user) || user.permissions?.includes("Employee Management");

}



export function canManageShifts(user) {
  if (!user) return false;
  return (
    hasFullAccess(user) ||
    user.permissions?.includes("Shift Management") ||
    user.permissions?.includes("Department Management")
  );
}

export async function requireShiftManagement(request) {
  const { user, error } = await requireAuth(request);
  if (error) return { user: null, error };
  if (!canManageShifts(user)) return { user: null, error: forbiddenResponse() };
  return { user, error: null };
}



export function canViewOrgDashboard(user) {

  if (!user) return false;

  if (hasFullAccess(user)) return true;

  return [

    "Employee Management",

    "User Management",

    "Attendance Monitoring",

    "Generate Reports",

  ].some((p) => user.permissions?.includes(p));

}



export function canMarkAttendance(user) {

  if (!user) return false;

  return (

    hasFullAccess(user) ||

    user.role === "security" ||

    user.permissions?.includes("Mark Attendance")

  );

}



export function canViewAttendance(user) {

  if (!user) return false;

  return (

    canMarkAttendance(user) ||

    user.permissions?.includes("View Attendance") ||

    user.permissions?.includes("Attendance Monitoring") ||

    user.permissions?.includes("View Team Attendance")

  );

}



export function canApproveAttendanceCorrection(user) {
  if (!user) return false;
  return user.role === "super_admin" || hasFullAccess(user);
}

export function canRequestAttendanceCorrection(user) {
  if (!user) return false;
  return (
    canApproveAttendanceCorrection(user) ||
    user.permissions?.includes("Attendance Corrections") ||
    canMarkAttendance(user) ||
    user.permissions?.includes("Attendance Monitoring")
  );
}

export function canEditAttendanceForDate(user, dateStr) {
  if (!canMarkAttendance(user)) return false;
  return dateStr === getLocalDateString();
}

/** Past/previous attendance Excel import (HR / admin / monitoring). */
export function canBulkImportAttendance(user) {
  if (!user) return false;
  return (
    hasFullAccess(user) ||
    user.permissions?.includes("Attendance Monitoring") ||
    user.permissions?.includes("Attendance Corrections") ||
    user.permissions?.includes("Mark Attendance") ||
    user.role === "security" ||
    user.role === "hr" ||
    user.role === "admin" ||
    user.role === "super_admin"
  );
}

export async function requireAuth(request) {

  const user = await getAuthUser(request);

  if (!user) return { user: null, error: unauthorizedResponse() };

  return { user, error: null };

}



export async function requirePermission(request, permissionName) {

  const { user, error } = await requireAuth(request);

  if (error) return { user: null, error };



  const hasFullAccess =

    user.permissions.includes("Full System Access") ||

    user.permissions.includes("All Permissions");



  if (hasFullAccess || user.permissions.includes(permissionName)) {

    return { user, error: null };

  }



  return { user: null, error: forbiddenResponse() };

}

