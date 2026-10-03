/** Audit action strings — mirrors prisma `AuditActionType` without importing @prisma/client at build time. */
export const AUDIT_ACTION = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
  APPROVE: "APPROVE",
  REJECT: "REJECT",
  EXPORT: "EXPORT",
  SYNC: "SYNC",
  CORRECTION_REQUEST: "CORRECTION_REQUEST",
  CORRECTION_APPROVED: "CORRECTION_APPROVED",
  CORRECTION_REJECTED: "CORRECTION_REJECTED",
};

export const AUDIT_ACTION_VALUES = Object.values(AUDIT_ACTION);
