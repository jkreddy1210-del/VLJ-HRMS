import { PrismaClient } from "@/generated/prisma";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { parseDatabaseUrl } from "@/lib/database-url";
import { employeeProfilePhotoExtension } from "@/lib/employee-photo-db";

const globalForPrisma = globalThis;

/** Bump when schema adds models so stale Next.js HMR clients are discarded. */
const PRISMA_CLIENT_VERSION = 5;

function createPrismaClient() {
  const adapter = new PrismaMariaDb(parseDatabaseUrl(process.env.DATABASE_URL));
  const base = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
  return base.$extends(employeeProfilePhotoExtension(base));
}

function isClientStale(client) {
  if (!client) return true;
  if (globalForPrisma.prismaClientVersion !== PRISMA_CLIENT_VERSION) return true;
  // New models after generate — discard HMR-cached client without them
  if (typeof client.bank?.findMany !== "function") return true;
  if (typeof client.attendanceMonthlySummary?.findMany !== "function") return true;
  return false;
}

function getPrismaClient() {
  if (isClientStale(globalForPrisma.prisma)) {
    try {
      globalForPrisma.prisma = createPrismaClient();
      globalForPrisma.prismaClientVersion = PRISMA_CLIENT_VERSION;
    } catch (err) {
      if (String(err?.message || err).includes("did not initialize yet")) {
        throw new Error(
          'Prisma Client is not generated. Run: npx prisma generate  (or: npm run db:generate)'
        );
      }
      throw err;
    }
  }
  return globalForPrisma.prisma;
}

/** Lazy proxy — avoids DB connection during `next build` when env is not loaded yet. */
export const prisma = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getPrismaClient();
      const value = client[prop];
      return typeof value === "function" ? value.bind(client) : value;
    },
  }
);
