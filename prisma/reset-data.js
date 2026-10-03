/**
 * Clear transactional data — keeps employees + required master data
 * (roles, permissions, departments, designations, leave types).
 */

const { createPrismaClient } = require("./db");

const prisma = createPrismaClient();

async function main() {
  console.log("🧹 Resetting transactional data (keeping employees)...\n");

  const deleted = await prisma.$transaction([
    prisma.attendanceCorrection.deleteMany(),
    prisma.attendanceMonthlySummary.deleteMany(),
    prisma.attendance.deleteMany(),
    prisma.attendanceException.deleteMany(),
    prisma.attendanceSyncLog.deleteMany(),
    prisma.leaveRequest.deleteMany(),
    prisma.leaveBalance.deleteMany(),
    prisma.reportDownloadLog.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.passwordResetToken.deleteMany(),
    prisma.employeeDocument.deleteMany(),
    prisma.employeePermission.deleteMany(),
    prisma.holiday.deleteMany(),
  ]);

  const labels = [
    "attendance corrections",
    "attendance monthly summaries",
    "attendance records",
    "attendance exceptions",
    "attendance sync logs",
    "leave requests",
    "leave balances",
    "report download logs",
    "audit logs",
    "notifications",
    "password reset tokens",
    "employee documents",
    "employee permission overrides",
    "holidays",
  ];

  deleted.forEach((result, i) => {
    console.log(`  ✓ ${labels[i]}: ${result.count} removed`);
  });

  const employees = await prisma.employee.count();
  console.log(`\n✅ Done. ${employees} employee(s) kept.`);
  console.log("   Master data kept: roles, permissions, departments, designations, leave types.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
