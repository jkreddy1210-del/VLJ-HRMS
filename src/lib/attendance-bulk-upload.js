import * as XLSX from "xlsx";
import { parseExcelDate } from "@/lib/employee-bulk-upload";

export const ATTENDANCE_BULK_HEADERS = [
  "Employee Code",
  "Date",
  "Status",
  "In Time",
  "Out Time",
];

const HEADER_ALIASES = {
  employeecode: "employeeCode",
  empcode: "employeeCode",
  employeeid: "employeeCode",
  date: "date",
  attendancedate: "date",
  status: "status",
  attendancestatus: "status",
  intime: "inTime",
  checkin: "inTime",
  outtime: "outTime",
  checkout: "outTime",
};

/** Map Excel status labels to mark API codes. */
const STATUS_ALIASES = {
  present: "present",
  p: "present",
  absent: "absent",
  a: "absent",
  halfday: "halfDay",
  "half day": "halfDay",
  hd: "halfDay",
  leave: "leave",
  l: "leave",
  late: "late",
};

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function cellValue(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value).trim();
}

function formatDateYmd(date) {
  if (!date || isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Accept HH:mm, H:mm, HH:mm:ss, or Excel time fraction / Date. */
export function parseExcelTime(value) {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date && !isNaN(value.getTime())) {
    const h = String(value.getHours()).padStart(2, "0");
    const m = String(value.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    // Excel time serial (fraction of day) or full datetime serial
    const fraction = value >= 1 ? value % 1 : value;
    const totalMinutes = Math.round(fraction * 24 * 60);
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  const raw = String(value).trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3]?.toLowerCase();

  if (minutes < 0 || minutes > 59 || hours < 0) return null;

  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === "pm" && hours < 12) hours += 12;
    if (meridiem === "am" && hours === 12) hours = 0;
  } else if (hours > 23) {
    return null;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function mapAttendanceStatus(value) {
  const key = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ");
  const compact = key.replace(/\s+/g, "");
  return STATUS_ALIASES[key] || STATUS_ALIASES[compact] || null;
}

export function parseAttendanceWorkbook(buffer) {
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

  const requiredFields = ["employeeCode", "date", "status"];
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
      const raw = row[Number(index)];
      if (field === "date") {
        const parsed = parseExcelDate(raw);
        record.date = formatDateYmd(parsed) || cellValue(raw);
        record.dateRaw = raw;
      } else if (field === "inTime" || field === "outTime") {
        record[field] = parseExcelTime(raw);
        record[`${field}Raw`] = raw;
      } else {
        record[field] = cellValue(raw);
      }
    });

    parsedRows.push(record);
  }

  if (!parsedRows.length) {
    throw new Error("No attendance rows found in the Excel file");
  }

  return parsedRows;
}

export function validateAttendanceRow(row, { todayYmd, employeeByCode }) {
  const errors = [];

  const code = String(row.employeeCode || "").trim();
  if (!code) errors.push("Employee Code is required");

  const date = String(row.date || "").trim();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.push("Date must be YYYY-MM-DD (e.g. 2026-07-15)");
  } else if (date > todayYmd) {
    errors.push("Future dates are not allowed");
  }

  const statusApi = mapAttendanceStatus(row.status);
  if (!statusApi || !["present", "absent", "halfDay", "leave"].includes(statusApi)) {
    errors.push("Status must be Present, Absent, Half Day, or Leave");
  }

  if (row.inTimeRaw !== undefined && row.inTimeRaw !== "" && row.inTime == null) {
    errors.push("In Time must be HH:mm (e.g. 09:30)");
  }
  if (row.outTimeRaw !== undefined && row.outTimeRaw !== "" && row.outTime == null) {
    errors.push("Out Time must be HH:mm (e.g. 18:00)");
  }

  if (code && employeeByCode && !employeeByCode.has(code.toLowerCase())) {
    errors.push(`Employee Code "${code}" not found`);
  }

  if (errors.length) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      employeeCode: code,
      date,
      status: statusApi,
      inTime: row.inTime || null,
      outTime: row.outTime || null,
    },
  };
}

export function buildAttendanceTemplateWorkbook() {
  const exampleRows = [
    ["VLJ-ACC-001", "2026-07-01", "Present", "09:15", "18:00"],
    ["VLJ-ACC-001", "2026-07-02", "Absent", "", ""],
    ["VLJ-ACC-002", "2026-07-01", "Half Day", "09:30", "13:00"],
    ["VLJ-ACC-002", "2026-07-02", "Leave", "", ""],
  ];

  const helpRows = [
    ["Column", "Required", "Allowed values / format"],
    ["Employee Code", "Yes", "Exact code from employees list (e.g. VLJ-ACC-001)"],
    ["Date", "Yes", "YYYY-MM-DD (past or today only)"],
    ["Status", "Yes", "Present | Absent | Half Day | Leave"],
    ["In Time", "Optional", "HH:mm (24h). Needed for Present / Half Day when available"],
    ["Out Time", "Optional", "HH:mm (24h). Must be after In Time"],
    ["", "", ""],
    ["Notes", "", "Each row is one employee on one date. Existing attendance for that day is updated."],
  ];

  const sheet = XLSX.utils.aoa_to_sheet([ATTENDANCE_BULK_HEADERS, ...exampleRows]);
  const helpSheet = XLSX.utils.aoa_to_sheet(helpRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Attendance");
  XLSX.utils.book_append_sheet(workbook, helpSheet, "Instructions");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
