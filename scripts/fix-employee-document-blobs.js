/**
 * Add BLOB columns to employee_documents for in-database file storage.
 * Run: npm run db:fix-document-blobs
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
    connectTimeout: 15000,
    allowPublicKeyRetrieval: true,
  };
}

async function columnExists(conn, table, column) {
  const rows = await conn.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return Number(rows[0]?.cnt || 0) > 0;
}

async function main() {
  loadEnvFile();
  const pool = mariadb.createPool(parseDatabaseUrl(process.env.DATABASE_URL));
  const conn = await pool.getConnection();
  try {
    if (!(await columnExists(conn, "employee_documents", "mime_type"))) {
      await conn.query(
        "ALTER TABLE employee_documents ADD COLUMN mime_type VARCHAR(100) NULL AFTER file_name"
      );
      console.log("✅ Added mime_type column");
    }
    if (!(await columnExists(conn, "employee_documents", "file_data"))) {
      await conn.query(
        "ALTER TABLE employee_documents ADD COLUMN file_data LONGBLOB NULL AFTER mime_type"
      );
      console.log("✅ Added file_data column");
    }
    await conn.query(
      "ALTER TABLE employee_documents MODIFY COLUMN file_path VARCHAR(500) NULL"
    );
    console.log("✅ employee_documents ready for BLOB storage");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

main();
