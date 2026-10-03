ALTER TABLE `audit_logs`
  MODIFY `action_type` ENUM(
    'CREATE',
    'UPDATE',
    'DELETE',
    'LOGIN',
    'LOGOUT',
    'APPROVE',
    'REJECT',
    'EXPORT',
    'SYNC',
    'CORRECTION_REQUEST',
    'CORRECTION_APPROVED',
    'CORRECTION_REJECTED'
  ) NOT NULL;
