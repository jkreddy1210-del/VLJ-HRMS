const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = process.cwd();
const buildIdPath = path.join(root, ".next", "BUILD_ID");

if (!fs.existsSync(buildIdPath)) {
  console.warn("Skipping build manifest: .next/BUILD_ID not found.");
  process.exit(0);
}

let gitCommit = null;
try {
  gitCommit = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
} catch {
  gitCommit = process.env.GIT_COMMIT || null;
}

const manifest = {
  buildId: fs.readFileSync(buildIdPath, "utf8").trim(),
  builtAt: new Date().toISOString(),
  gitCommit,
};

const outPath = path.join(root, "public", "build-info.json");
fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`✔ Wrote ${path.relative(root, outPath)}`);
