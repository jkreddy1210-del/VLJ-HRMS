/**
 * Delete all employees except superadmin and clear org master data.
 * Run: node prisma/reset-employees-keep-superadmin.js
 * Then: npx prisma db push && npm run db:seed
 */
const { createPrismaClient } = require("./db");

const prisma = createPrismaClient();

async function main() {
  console.log("Resetting employees (keeping superadmin only)...\n");

  const superadmin = await prisma.employee.findFirst({
    where: { email: "superadmin@vlj.com" },
    select: { id: true, employeeCode: true },
  });
  if (superadmin) {
    console.log(`  Found existing superadmin (${superadmin.employeeCode}) — will be recreated on seed`);
  }

  await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0");

  const tables = [
    "attendance_corrections",
    "attendance_monthly_summaries",
    "attendance",
    "attendance_exceptions",
    "leave_requests",
    "leave_balances",
    "employee_documents",
    "employee_permissions",
    "password_reset_tokens",
    "notifications",
  ];

  for (const table of tables) {
    await prisma.$executeRawUnsafe(`DELETE FROM \`${table}\``);
  }

  await prisma.$executeRawUnsafe("DELETE FROM employees");
  console.log("  All employees removed (superadmin will be recreated on seed)");

  await prisma.$executeRawUnsafe("DELETE FROM department_shifts");
  await prisma.$executeRawUnsafe("DELETE FROM designations");
  await prisma.$executeRawUnsafe("DELETE FROM departments");

  await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1");

  console.log("\nDone. Run: npx prisma db push && npm run db:seed\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
