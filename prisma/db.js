/**
 * Shared Prisma client factory (CommonJS) for seed/scripts.
 * Uses driver adapter — no Rust query engine binary (Synology/NAS compatible).
 */
const { PrismaClient } = require("../src/generated/prisma");
const { PrismaPg } = require("@prisma/adapter-pg");

function createPrismaClient(options = {}) {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: options.log || (process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]),
  });
}

module.exports = { createPrismaClient, parseDatabaseUrl };
