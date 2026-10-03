const { createPrismaClient } = require("./db");
const prisma = createPrismaClient();

async function main() {
  const role = await prisma.role.findUnique({ where: { roleName: "super_admin" } });
  const perm = await prisma.permission.findFirst({ where: { permissionName: "Apply Leave" } });
  if (!role || !perm) return;

  await prisma.rolePermission.deleteMany({
    where: { roleId: role.id, permissionId: perm.id },
  });
  console.log("Removed Apply Leave from Super Admin role");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
