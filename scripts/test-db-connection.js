/**
 * Test MySQL connection using the same settings as the app.
 * Run on Synology: node scripts/test-db-connection.js
 */
const fs = require("fs");
const path = require("path");
const mariadb = require("mariadb");

function loadEnvFile() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) {
    console.error("❌ .env file not found at", envPath);
    process.exit(1);
  }

  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseDatabaseUrl(databaseUrl) {
  const url = new URL(databaseUrl);
  let host = url.hostname;
  if (host === "localhost") host = "127.0.0.1";

  return {
    host,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    connectionLimit: 2,
    connectTimeout: 15000,
    acquireTimeout: 15000,
    allowPublicKeyRetrieval: true,
  };
}

async function main() {
  loadEnvFile();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL is missing in .env");
    process.exit(1);
  }

  const config = parseDatabaseUrl(databaseUrl);
  console.log("Testing connection with:");
  console.log(`  host: ${config.host}`);
  console.log(`  port: ${config.port}`);
  console.log(`  user: ${config.user}`);
  console.log(`  database: ${config.database}`);

  let conn;
  try {
    conn = await mariadb.createConnection(config);
    const rows = await conn.query("SELECT 1 AS ok");
    console.log("✔ MySQL connection OK:", rows);

    const tables = await conn.query("SHOW TABLES");
    console.log(`✔ Tables in ${config.database}:`, tables.length);

    const employees = await conn.query(
      "SELECT COUNT(*) AS count FROM employees"
    ).catch(() => null);
    if (employees) {
      console.log("✔ employees table rows:", employees[0]?.count ?? 0);
    } else {
      console.warn("⚠ employees table not found — run npm run db:push && npm run db:seed on laptop");
    }
  } catch (err) {
    console.error("\n❌ Connection failed:", err.message);
    console.error(`
Fix .env for Synology Docker mysql-hrms container:

  DATABASE_URL="mysql://vnas:121011@127.0.0.1:3306/vlj_hrms"

If app runs inside another Docker container on the same network, use:
  DATABASE_URL="mysql://vnas:121011@mysql-hrms:3306/vlj_hrms"

Test MySQL via Docker:
  docker exec -it mysql-hrms mysql -u vnas -p121011 vlj_hrms -e "SELECT 1"
`);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

main();
