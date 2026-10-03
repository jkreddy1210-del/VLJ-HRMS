import * as XLSX from "xlsx";
import { getMonthIndexFromName, MONTH_NAMES } from "@/lib/attendance-monthly-report";

export const ATTENDANCE_MONTHLY_BULK_HEADERS = [
  "Employee Code",
  "Employee Name",
  "Month",
  "Year",
  "Late Days",
  "Full Days",
  "Half Days",
  "Sundays",
  "Total Present",
  "Absent",
];

const HEADER_ALIASES = {
  employeecode: "employeeCode",
  empcode: "employeeCode",
  employeename: "employeeName",
  name: "employeeName",
  nameofemployee: "employeeName",
  month: "month",
  year: "year",
  latedays: "lateDays",
  nooflatedays: "lateDays",
  fulldays: "fullDays",
  halfdays: "halfDays",
  sundays: "sundays",
  totalpresent: "totalPresentDays",
  totalpresentdays: "totalPresentDays",
  absent: "absentDays",
  absentdays: "absentDays",
};

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function cellValue(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function parseNonNegativeInt(value, fieldLabel) {
  if (value === null || value === undefined || value === "") {
    return { value: 0 };
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    if (!Number.isInteger(value) || value < 0) {
      return { error: `${fieldLabel} must be a whole number ≥ 0` };
    }
    return { value };
  }
  const raw = String(value).trim();
  if (!/^\d+$/.test(raw)) {
    return { error: `${fieldLabel} must be a whole number ≥ 0` };
  }
  return { value: Number(raw) };
}

export function resolveMonthIndex(monthValue) {
  if (monthValue === null || monthValue === undefined || monthValue === "") return null;

  if (typeof monthValue === "number" && Number.isFinite(monthValue)) {
    const n = Math.trunc(monthValue);
    if (n >= 1 && n <= 12) return n;
    return null;
  }

  const raw = String(monthValue).trim();
  if (/^\d{1,2}$/.test(raw)) {
    const n = Number(raw);
    if (n >= 1 && n <= 12) return n;
    return null;
  }

  const fromName = getMonthIndexFromName(raw);
  if (fromName) return fromName;

  const short = raw.slice(0, 3).toLowerCase();
  const shortIdx = MONTH_NAMES.findIndex((name) => name.slice(0, 3).toLowerCase() === short);
  return shortIdx >= 0 ? shortIdx + 1 : null;
}

export function parseYearValue(yearValue) {
  if (typeof yearValue === "number" && Number.isFinite(yearValue)) {
    return Math.trunc(yearValue);
  }
  const raw = String(yearValue || "").trim();
  if (!/^\d{4}$/.test(raw)) return null;
  return Number(raw);
}

export function isFutureMonth(year, monthIndex, now = new Date()) {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  return year > currentYear || (year === currentYear && monthIndex > currentMonth);
}

export function parseMonthlyAttendanceWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Excel file has no sheets");
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
  if (rows.length < 2) {
    throw new Error("Excel file must have a header row and at least one data row");
  }

  const headerRow = rows[0];
  const columnMap = {};
  headerRow.forEach((header, index) => {
    const field = HEADER_ALIASES[normalizeHeader(header)];
    if (field) columnMap[index] = field;
  });

  const requiredFields = [
    "employeeCode",
    "month",
    "year",
    "lateDays",
    "fullDays",
    "halfDays",
    "sundays",
    "totalPresentDays",
    "absentDays",
  ];
  const mappedFields = new Set(Object.values(columnMap));
  const missingHeaders = requiredFields.filter((f) => !mappedFields.has(f));
  if (missingHeaders.length) {
    throw new Error(
      `Missing required column(s): ${missingHeaders.join(", ")}. Download the template for correct headers.`
    );
  }

  const parsedRows = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const isEmpty = row.every((cell) => cellValue(cell) === "");
    if (isEmpty) continue;

    const record = { rowNumber: i + 1 };
    Object.entries(columnMap).forEach(([index, field]) => {
      record[field] = row[Number(index)];
    });
    parsedRows.push(record);
  }

  if (!parsedRows.length) {
    throw new Error("No attendance rows found in the Excel file");
  }

  return parsedRows;
}

export function validateMonthlyAttendanceRow(row, { employeeByCode }) {
  const errors = [];

  const code = cellValue(row.employeeCode);
  if (!code) {
    errors.push("Employee Code is required");
  } else if (employeeByCode && !employeeByCode.has(code.toLowerCase())) {
    errors.push(`Employee Code "${code}" not found`);
  }

  const monthIndex = resolveMonthIndex(row.month);
  if (!monthIndex) {
    errors.push("Month must be January–December (or 1–12)");
  }

  const year = parseYearValue(row.year);
  if (!year || year < 2000 || year > 2100) {
    errors.push("Year must be a valid 4-digit year");
  }

  if (monthIndex && year && isFutureMonth(year, monthIndex)) {
    errors.push("Future months are not allowed");
  }

  const lateDays = parseNonNegativeInt(row.lateDays, "Late Days");
  const fullDays = parseNonNegativeInt(row.fullDays, "Full Days");
  const halfDays = parseNonNegativeInt(row.halfDays, "Half Days");
  const sundays = parseNonNegativeInt(row.sundays, "Sundays");
  const totalPresentDays = parseNonNegativeInt(row.totalPresentDays, "Total Present");
  const absentDays = parseNonNegativeInt(row.absentDays, "Absent");

  for (const parsed of [lateDays, fullDays, halfDays, sundays, totalPresentDays, absentDays]) {
    if (parsed.error) errors.push(parsed.error);
  }

  if (errors.length) {
    return { valid: false, errors };
  }

  const employee = employeeByCode.get(code.toLowerCase());
  const monthName = MONTH_NAMES[monthIndex - 1];

  return {
    valid: true,
    data: {
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      employeeName: employee.fullName,
      year,
      month: monthIndex,
      monthName,
      lateDays: lateDays.value,
      fullDays: fullDays.value,
      halfDays: halfDays.value,
      sundays: sundays.value,
      totalPresentDays: totalPresentDays.value,
      absentDays: absentDays.value,
    },
  };
}

export function buildMonthlyAttendanceTemplateWorkbook() {
  const exampleRows = [
    ["VLJ-ACC-001", "Ravi Kumar", "January", 2026, 2, 20, 1, 4, 25, 6],
    ["VLJ-ACC-002", "Priya Sharma", "January", 2026, 0, 22, 0, 4, 26, 5],
  ];

  const helpRows = [
    ["Column", "Required", "Allowed values / format"],
    ["Employee Code", "Yes", "Exact code from employees list"],
    ["Employee Name", "Optional", "For reference only — not used for matching"],
    ["Month", "Yes", "January–December or 1–12"],
    ["Year", "Yes", "YYYY (e.g. 2026). Future months not allowed"],
    ["Late Days", "Yes", "Whole number ≥ 0"],
    ["Full Days", "Yes", "Whole number ≥ 0"],
    ["Half Days", "Yes", "Whole number ≥ 0"],
    ["Sundays", "Yes", "Whole number ≥ 0"],
    ["Total Present", "Yes", "Whole number ≥ 0"],
    ["Absent", "Yes", "Whole number ≥ 0"],
    ["", "", ""],
    ["Notes", "", "One row = one employee for one month. Same employee + month + year is updated."],
  ];

  const sheet = XLSX.utils.aoa_to_sheet([ATTENDANCE_MONTHLY_BULK_HEADERS, ...exampleRows]);
  const helpSheet = XLSX.utils.aoa_to_sheet(helpRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Monthly Attendance");
  XLSX.utils.book_append_sheet(workbook, helpSheet, "Instructions");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
