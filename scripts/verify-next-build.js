const fs = require("fs");
const path = require("path");

function walk(dir, onFile, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath, onFile, results);
    else if (onFile(fullPath)) results.push(fullPath);
  }
  return results;
}

function fail(message) {
  console.error(`\n✖ Build verification failed: ${message}\n`);
  process.exit(1);
}

const root = process.cwd();
const buildIdPath = path.join(root, ".next", "BUILD_ID");
const chunksRoot = path.join(root, ".next", "static", "chunks");
const cssRoot = path.join(root, ".next", "static", "css");

if (!fs.existsSync(buildIdPath)) {
  fail(".next/BUILD_ID is missing. Run npm run build first.");
}

const buildId = fs.readFileSync(buildIdPath, "utf8").trim();
const reportsChunks = walk(chunksRoot, (filePath) => {
  const normalized = filePath.replace(/\\/g, "/");
  return normalized.includes("/reports/page-") && filePath.endsWith(".js");
});

const layoutChunks = walk(chunksRoot, (filePath) => {
  const normalized = filePath.replace(/\\/g, "/");
  return /\/app\/layout-[^/]+\.js$/.test(normalized);
});

const cssFiles = walk(cssRoot, () => true);

if (!reportsChunks.length) {
  fail("reports page chunk not found under .next/static/chunks (app router build incomplete).");
}

if (!layoutChunks.length) {
  fail("root app layout chunk not found under .next/static/chunks.");
}

if (!cssFiles.length) {
  fail("no CSS files found under .next/static/css.");
}

console.log("✔ Next.js build verified");
console.log(`  BUILD_ID: ${buildId}`);
console.log(`  reports chunk: ${path.relative(root, reportsChunks[0])}`);
console.log(`  layout chunk: ${path.relative(root, layoutChunks[0])}`);
console.log(`  css files: ${cssFiles.length}`);
