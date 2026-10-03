/**
 * Seed leave balances + matching leave requests for testing.
 * Balance cards (used/pending) are derived from requests in the table below.
 * Run: npm run db:seed-leaves
 */

const { createPrismaClient } = require("./db");

const prisma = createPrismaClient();

const LEAVE_TYPE_LIMITS = {
  "Casual Leave": 12,
  "Sick Leave": 10,
  "Earned Leave": 15,
  "Optional Holiday": 10,
  "Comp Off": 3,
};

/** Leave requests that drive used/pending counts — must match balance cards */
const EMP005_REQUESTS = [
  {
    leaveName: "Casual Leave",
    from: "01-06",
    to: "01-09",
    days: 4,
    reason: "Family function",
    status: "Approved",
  },
  {
    leaveName: "Casual Leave",
    from: "06-20",
    to: "06-22",
    days: 3,
    reason: "Personal work — pending approval",
    status: "Pending",
  },
  {
    leaveName: "Sick Leave",
    from: "03-10",
    to: "03-11",
    days: 2,
    reason: "Fever",
    status: "Approved",
  },
  {
    leaveName: "Optional Holiday",
    from: "04-14",
    to: "04-18",
    days: 5,
    reason: "Optional holiday block 1",
    status: "Approved",
  },
  {
    leaveName: "Optional Holiday",
    from: "12-24",
    to: "12-28",
    days: 5,
    reason: "Year-end optional holiday",
    status: "Approved",
  },
  {
    leaveName: "Comp Off",
    from: "02-15",
    to: "02-15",
    days: 1,
    reason: "Weekend work compensation",
    status: "Approved",
  },
];

const EMP004_REQUESTS = [
  {
    leaveName: "Casual Leave",
    from: "02-10",
    to: "02-11",
    days: 2,
    reason: "Personal",
    status: "Approved",
  },
  {
    leaveName: "Sick Leave",
    from: "05-05",
    to: "05-05",
    days: 1,
    reason: "Medical",
    status: "Approved",
  },
  {
    leaveName: "Earned Leave",
    from: "07-01",
    to: "07-03",
    days: 3,
    reason: "Vacation",
    status: "Approved",
  },
  {
    leaveName: "Optional Holiday",
    from: "08-10",
    to: "08-14",
    days: 5,
    reason: "Festival",
    status: "Approved",
  },
];

function statusFields(status) {
  if (status === "Approved") {
    return {
      managerStatus: "Approved",
      hrStatus: "Approved",
      finalStatus: "Approved",
    };
  }
  return {
    managerStatus: "Pending",
    hrStatus: "Pending",
    finalStatus: "Pending",
  };
}

async function seedEmployeeRequests(employee, requests, leaveTypeByName, year) {
  for (const req of requests) {
    const lt = leaveTypeByName[req.leaveName];
    if (!lt) continue;

    await prisma.leaveRequest.create({
      data: {
        employeeId: employee.id,
        leaveTypeId: lt.id,
        fromDate: new Date(`${year}-${req.from}`),
        toDate: new Date(`${year}-${req.to}`),
        totalDays: req.days,
        reason: req.reason,
        ...statusFields(req.status),
      },
    });
  }
}

async function syncBalancesFromRequests(employeeId, leaveTypeByName, year) {
  for (const [leaveName, total] of Object.entries(LEAVE_TYPE_LIMITS)) {
    const lt = leaveTypeByName[leaveName];
    if (!lt) continue;

    const approved = await prisma.leaveRequest.aggregate({
      where: {
        employeeId,
        leaveTypeId: lt.id,
        finalStatus: "Approved",
        fromDate: {
          gte: new Date(`${year}-01-01`),
          lte: new Date(`${year}-12-31`),
        },
      },
      _sum: { totalDays: true },
    });

    const used = Number(approved._sum.totalDays || 0);

    await prisma.leaveBalance.upsert({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId,
          leaveTypeId: lt.id,
          year,
        },
      },
      update: {
        totalLeave: total,
        usedLeave: used,
        remainingLeave: Math.max(0, total - used),
      },
      create: {
        employeeId,
        leaveTypeId: lt.id,
        totalLeave: total,
        usedLeave: used,
        remainingLeave: Math.max(0, total - used),
        year,
      },
    });
  }
}

async function main() {
  console.log("🌱 Seeding leave balances & matching requests...\n");

  const year = new Date().getFullYear();
  const leaveTypes = await prisma.leaveType.findMany();
  const leaveTypeByName = Object.fromEntries(leaveTypes.map((lt) => [lt.leaveName, lt]));

  for (const [name, limit] of Object.entries(LEAVE_TYPE_LIMITS)) {
    const lt = leaveTypeByName[name];
    if (lt && lt.yearlyLimit !== limit) {
      await prisma.leaveType.update({
        where: { id: lt.id },
        data: { yearlyLimit: limit },
      });
    }
  }

  await prisma.leaveRequest.deleteMany();
  console.log("  ✓ Cleared all leave requests");

  const employees = await prisma.employee.findMany({
    select: { id: true, employeeCode: true, fullName: true },
  });

  const requestMap = {
    EMP005: EMP005_REQUESTS,
    EMP004: EMP004_REQUESTS,
  };

  for (const emp of employees) {
    const requests = requestMap[emp.employeeCode] || [];
    if (requests.length) {
      await seedEmployeeRequests(emp, requests, leaveTypeByName, year);
      console.log(`  ✓ Requests: ${emp.employeeCode} (${requests.length} records)`);
    }

    await syncBalancesFromRequests(emp.id, leaveTypeByName, year);
    console.log(`  ✓ Balances synced: ${emp.employeeCode}`);
  }

  const holidays = [
    { holidayName: "Republic Day", holidayDate: new Date(`${year}-01-26`) },
    { holidayName: "Independence Day", holidayDate: new Date(`${year}-08-15`) },
    { holidayName: "Diwali", holidayDate: new Date(`${year}-10-20`) },
  ];

  for (const h of holidays) {
    await prisma.holiday.upsert({
      where: { holidayDate: h.holidayDate },
      update: { holidayName: h.holidayName },
      create: h,
    });
  }
  console.log(`  ✓ Holidays: ${holidays.length}`);

  console.log("\n✅ Leave seed complete!");
  console.log("\n📋 EMP005 (employee@vlj.com) — cards match table:");
  console.log("   Casual Leave     — 4 used (approved) + 3 pending = 5 rows in table");
  console.log("   Sick Leave       — 2 used (1 approved request)");
  console.log("   Optional Holiday — 10 used (2 approved requests, exhausted)");
  console.log("   Comp Off         — 1 used (1 approved request)");
  console.log("   Earned Leave     — 0 used\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
