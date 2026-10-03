import { prisma } from "@/lib/prisma";
import { AUDIT_ACTION, AUDIT_ACTION_VALUES } from "@/lib/audit-action-types";

const CORRECTION_ACTION_FALLBACK = {
  CORRECTION_REQUEST: AUDIT_ACTION.CREATE,
  CORRECTION_APPROVED: AUDIT_ACTION.APPROVE,
  CORRECTION_REJECTED: AUDIT_ACTION.REJECT,
};

function resolveAuditActionType(actionType) {
  const allowed = new Set(AUDIT_ACTION_VALUES);
  if (allowed.has(actionType)) {
    return { actionType, auditAction: null };
  }
  const fallback = CORRECTION_ACTION_FALLBACK[actionType];
  if (fallback) {
    return { actionType: fallback, auditAction: actionType };
  }
  return { actionType, auditAction: null };
}

export async function createAuditLog({
  employeeId,
  userId,
  moduleName,
  actionType,
  oldValue = null,
  newValue = null,
}) {
  const resolved = resolveAuditActionType(actionType);
  const payload = newValue ? JSON.parse(JSON.stringify(newValue)) : null;
  if (resolved.auditAction && payload) {
    payload.auditAction = resolved.auditAction;
  }

  return prisma.auditLog.create({
    data: {
      employeeId: employeeId ?? userId,
      moduleName,
      actionType: resolved.actionType,
      oldValue: oldValue ? JSON.parse(JSON.stringify(oldValue)) : null,
      newValue: payload,
    },
  });
}
