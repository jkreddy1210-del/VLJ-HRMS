import { getFestivalsForMonth } from "@/lib/indian-festivals";

const IST = "Asia/Kolkata";

/** @returns {{ year: number, month: number, day: number }} */
export function getISTDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
  };
}

/**
 * Month calendar: free Google India holidays ICS (festivals) + active employee birthdays.
 * No festivals DB table.
 */
export async function getDashboardCalendarMonth(prisma, year, month) {
  if (!Number.isInteger(year) || year < 1970 || year > 2100) {
    return { ok: false, error: "Invalid year" };
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return { ok: false, error: "Invalid month" };
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const [{ festivals, source }, employees] = await Promise.all([
    getFestivalsForMonth(year, month),
    prisma.employee.findMany({
      where: { status: "Active", dob: { not: null } },
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        dob: true,
      },
      orderBy: { fullName: "asc" },
    }),
  ]);

  const birthdays = employees
    .filter((emp) => {
      if (!emp.dob) return false;
      const dobMonth = emp.dob.getUTCMonth() + 1;
      const dobDay = emp.dob.getUTCDate();
      return dobMonth === month && dobDay <= daysInMonth;
    })
    .map((emp) => {
      const day = emp.dob.getUTCDate();
      const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return {
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        employeeName: emp.fullName,
        date: dateKey,
        day,
      };
    })
    .sort((a, b) => a.day - b.day || a.employeeName.localeCompare(b.employeeName));

  const byDate = {};
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    byDate[date] = { festivals: [], birthdays: [] };
  }
  for (const f of festivals) {
    if (byDate[f.date]) byDate[f.date].festivals.push(f);
  }
  for (const b of birthdays) {
    if (byDate[b.date]) byDate[b.date].birthdays.push(b);
  }

  const today = getISTDateParts();

  return {
    ok: true,
    year,
    month,
    daysInMonth,
    today: `${today.year}-${String(today.month).padStart(2, "0")}-${String(today.day).padStart(2, "0")}`,
    festivals,
    birthdays,
    byDate,
    festivalSource: source,
  };
}

export function parseYearMonth(searchParams) {
  const now = getISTDateParts();
  const yearRaw = searchParams.get("year");
  const monthRaw = searchParams.get("month");
  const year = yearRaw != null && yearRaw !== "" ? Number(yearRaw) : now.year;
  const month = monthRaw != null && monthRaw !== "" ? Number(monthRaw) : now.month;
  return { year, month };
}
