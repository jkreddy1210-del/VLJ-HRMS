/**
 * Ensures Prisma Client exists before dev/build/start.
 * Client is committed under src/generated/prisma for Synology NAS (no generate on server).
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const clientIndex = path.join(root, "src", "generated", "prisma", "index.js");
const clientDir = path.join(root, "src", "generated", "prisma");

function isClientGenerated() {
  try {
    const indexStat = fs.statSync(clientIndex);
    if (indexStat.size < 50000) return false;

    const files = fs.readdirSync(clientDir);
    return files.some((name) => name.includes("wasm") || name === "index.js");
  } catch {
    return false;
  }
}

function getPrismaCliPath() {
  const candidates = [
    path.join(root, "node_modules", "prisma", "build", "index.js"),
    path.join(root, "node_modules", "prisma", "cli", "build", "index.js"),
    path.join(root, "node_modules", ".bin", "prisma"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

function generateClient() {
  const prismaCli = getPrismaCliPath();
  if (!prismaCli) {
    throw new Error("Prisma CLI not found");
  }

  console.log("→ Regenerating Prisma Client...");
  if (prismaCli.endsWith(".js")) {
    execFileSync(process.execPath, [prismaCli, "generate"], {
      stdio: "inherit",
      cwd: root,
      env: process.env,
    });
    return;
  }

  execFileSync(prismaCli, ["generate"], {
    stdio: "inherit",
    cwd: root,
    env: process.env,
  });
}

function printNasHelp() {
  console.warn(`
⚠ Prisma generate failed on this machine (common on Synology NAS).

The pre-generated client in src/generated/prisma should still work after git pull.
If login fails, on your laptop run:
  npm run db:generate
  git add src/generated/prisma && git commit && git push
`);
}

function main() {
  if (isClientGenerated()) {
    console.log("✔ Prisma Client ready (src/generated/prisma)");
    return;
  }

  const isPostInstall = process.env.npm_lifecycle_event === "postinstall";

  try {
    generateClient();
  } catch (err) {
    console.error("Prisma generate error:", err?.message || err);
    if (isPostInstall) {
      printNasHelp();
      process.exit(0);
    }
    printNasHelp();
    process.exit(1);
  }

  if (!isClientGenerated()) {
    if (isPostInstall) {
      printNasHelp();
      process.exit(0);
    }
    printNasHelp();
    process.exit(1);
  }

  console.log("✔ Prisma Client generated successfully");
}

main();
