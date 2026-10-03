/**
 * E2E test: create department + designation, verify they appear in /api/lookups
 * Run: node scripts/test-org-lookups-flow.js
 */
const BASE = process.env.API_BASE || "http://localhost:3000/api";
const TEST_DEPT_NAME = `Test Dept ${Date.now()}`;
const TEST_DEPT_CODE = `T${String(Date.now()).slice(-5)}`;
const TEST_DESIG_NAME = `Test Designation ${Date.now()}`;

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `${path} failed (${res.status})`);
  }
  return data;
}

async function main() {
  console.log("1. Login as superadmin...");
  const login = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "superadmin@vlj.com", password: "Admin@123" }),
  });
  const token = login.token;
  if (!token) throw new Error("No token returned");
  const auth = { Authorization: `Bearer ${token}` };
  console.log("   ✔ Logged in");

  console.log("2. Fetch lookups BEFORE add...");
  const before = await request("/lookups", { headers: auth });
  const deptCountBefore = before.departments?.length ?? 0;
  const desigCountBefore = before.designations?.length ?? 0;
  console.log(`   Departments: ${deptCountBefore}, Designations: ${desigCountBefore}`);

  console.log("3. Create test department...");
  const deptRes = await request("/departments", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      departmentName: TEST_DEPT_NAME,
      departmentCode: TEST_DEPT_CODE,
    }),
  });
  const newDeptId = deptRes.department?.id;
  console.log(`   ✔ Created: ${TEST_DEPT_NAME} (id=${newDeptId})`);

  console.log("4. Create test designation...");
  const desigRes = await request("/designations", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ designationName: TEST_DESIG_NAME }),
  });
  const newDesigId = desigRes.designation?.id;
  console.log(`   ✔ Created: ${TEST_DESIG_NAME} (id=${newDesigId})`);

  console.log("5. Fetch lookups AFTER add (fresh API — like page refresh)...");
  const after = await request("/lookups", { headers: auth });
  const deptFound = after.departments?.some(
    (d) => d.id === newDeptId || d.departmentName === TEST_DEPT_NAME
  );
  const desigFound = after.designations?.some(
    (d) => d.id === newDesigId || d.designationName === TEST_DESIG_NAME
  );

  console.log(`   Departments: ${after.departments?.length ?? 0} (was ${deptCountBefore})`);
  console.log(`   Designations: ${after.designations?.length ?? 0} (was ${desigCountBefore})`);

  if (!deptFound) {
    console.error("   ✗ FAIL: New department NOT in lookups");
    process.exit(1);
  }
  console.log("   ✔ New department appears in lookups (Add Employee dropdown source)");

  if (!desigFound) {
    console.error("   ✗ FAIL: New designation NOT in lookups");
    process.exit(1);
  }
  console.log("   ✔ New designation appears in lookups (Add Employee dropdown source)");

  console.log("\n✔ PASS — Organization add → Employee dropdown data flow works via API");
  console.log(`  Test dept: ${TEST_DEPT_NAME}`);
  console.log(`  Test desig: ${TEST_DESIG_NAME}`);
}

main().catch((err) => {
  console.error("\n✗ TEST FAILED:", err.message);
  process.exit(1);
});
