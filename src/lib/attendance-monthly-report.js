import * as XLSX from "xlsx";

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function getMonthIndexFromName(monthName) {
  const idx = MONTH_NAMES.indexOf(monthName);
  return idx >= 0 ? idx + 1 : null;
}

export function formatAttendanceReportHeader(monthName, year) {
  const short = String(monthName || "").slice(0, 3).toUpperCase();
  return `ATTENDANCE FOR THE MONTH OF ${short} - ${year}`;
}

/** Total calendar Sundays in the month (e.g. June 2026 → 4). */
export function countSundaysInMonth(year, monthIndex) {
  const daysInMonth = new Date(year, monthIndex, 0).getDate();
  let total = 0;
  for (let day = 1; day <= daysInMonth; day += 1) {
    if (new Date(year, monthIndex - 1, day).getDay() === 0) total += 1;
  }
  return total;
}

function parseAttendanceCalendarDay(attendanceDate) {
  const d = attendanceDate instanceof Date ? attendanceDate : new Date(attendanceDate);
  if (Number.isNaN(d.getTime())) return null;
  return {
    day: d.getUTCDate(),
    dayOfWeek: d.getUTCDay(),
  };
}

function hasMarkedWork(att) {
  return Boolean(att?.inTime);
}

/**
 * Monthly attendance summary (Admin Attendance Excel).
 * Sundays column = only Sundays where attendance was marked (Present/Late with in-time).
 * If month has 4 Sundays but employee came on 1, sundays = 1 (not 4).
 */
export function computeMonthlyAttendanceStats(attendanceRecords, year, monthIndex) {
  const daysInMonth = new Date(year, monthIndex, 0).getDate();
  const sundaysInMonth = countSundaysInMonth(year, monthIndex);
  const byDay = new Map();

  for (const record of attendanceRecords || []) {
    const parsed = parseAttendanceCalendarDay(record.attendanceDate);
    if (!parsed) continue;
    byDay.set(parsed.day, { ...record, _dayOfWeek: parsed.dayOfWeek });
  }

  let lateDays = 0;
  let fullDays = 0;
  let halfDays = 0;
  let sundays = 0;

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, monthIndex - 1, day);
    const dayOfWeek = date.getDay();
    const att = byDay.get(day);
    if (!att) continue;

    const status = att.attendanceStatus;
    const lateMinutes = Number(att.lateMinutes || 0);
    const worked = hasMarkedWork(att);

    if (worked && (lateMinutes > 0 || status === "Late")) {
      lateDays += 1;
    }

    if (status === "Half_Day" && worked) {
      halfDays += 1;
    } else if ((status === "Present" || status === "Late") && worked) {
      if (dayOfWeek === 0) sundays += 1;
      else fullDays += 1;
    }
  }

  const totalPresentDays = fullDays + halfDays + sundays;
  const absentDays = Math.max(0, daysInMonth - totalPresentDays);

  return {
    lateDays,
    fullDays,
    halfDays,
    sundays,
    sundaysInMonth,
    totalPresentDays,
    absentDays,
    daysInMonth,
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildStatementTableHtml({ headerTitle, rows }) {
  const bodyRows = (rows || [])
    .map(
      (row) => `<tr class="data-row">
  <td class="c c-sno">${row.sno}</td>
  <td class="c c-name">${escapeHtml(row.employeeName)}</td>
  <td class="c c-num">${row.lateDays}</td>
  <td class="c c-num">${row.fullDays}</td>
  <td class="c c-num">${row.halfDays}</td>
  <td class="c c-num">${row.sundays}</td>
  <td class="c c-num">${row.totalPresentDays}</td>
  <td class="c c-num">${row.absentDays}</td>
</tr>`
    )
    .join("\n");

  return `<table class="stmt-table" cellspacing="0" cellpadding="0">
  <colgroup>
    <col class="col-sno" /><col class="col-name" /><col class="col-num" />
    <col class="col-num" /><col class="col-num" /><col class="col-num" />
    <col class="col-num" /><col class="col-num" />
  </colgroup>
  <thead>
    <tr>
      <th class="title-row" colspan="8">${escapeHtml(headerTitle)}</th>
    </tr>
    <tr>
      <th class="h" rowspan="2">S.NO</th>
      <th class="h h-name" rowspan="2">NAME OF THE EMPLOYEE</th>
      <th class="h" rowspan="2">NO. OF LATE DAYS</th>
      <th class="h" colspan="3">PRESENT DAYS</th>
      <th class="h" rowspan="2">TOTAL PRESENT DAYS</th>
      <th class="h" rowspan="2">ABSENT DAYS</th>
    </tr>
    <tr>
      <th class="h h-sub">FULL DAYS</th>
      <th class="h h-sub">HALF DAYS</th>
      <th class="h h-sub">SUNDAYS</th>
    </tr>
  </thead>
  <tbody>
${bodyRows}
  </tbody>
</table>`;
}

const EXCEL_DOC_STYLE = `
  @page { size: A4 portrait; margin: 8mm; }
  body { font-family: Calibri, Arial, sans-serif; margin: 0; color: #000; }
  .stmt-table {
    border-collapse: collapse;
    width: 100%;
    table-layout: fixed;
    border: 1px solid #000;
  }
  .col-sno { width: 6%; }
  .col-name { width: 30%; }
  .col-num { width: 9%; }
  .title-row {
    text-align: center; font-size: 14pt; font-weight: bold;
    border: 1px solid #000; padding: 8pt 4pt;
  }
  .h, .c {
    border: 1px solid #000; padding: 4pt 5pt; font-size: 10pt;
    vertical-align: middle; text-align: center;
    mso-number-format: "\\@";
  }
  .c-num { mso-number-format: "0"; text-align: center; }
  .h-name, .c-name { text-align: left; text-transform: uppercase; }
  .h-sub { font-size: 9pt; font-weight: bold; }
  .data-row { height: 18pt; }
  .data-row td { height: 18pt; }
`;

export function buildAttendanceStatementExcelHtml({ headerTitle, rows }) {
  const table = buildStatementTableHtml({ headerTitle, rows });
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<!--[if gte mso 9]><xml>
<x:ExcelWorkbook>
  <x:ExcelWorksheets>
    <x:ExcelWorksheet>
      <x:Name>Attendance Report</x:Name>
      <x:WorksheetOptions>
        <x:Print>
          <x:ValidPrinterInfo/>
          <x:PaperSizeIndex>9</x:PaperSizeIndex>
          <x:Scale>100</x:Scale>
        </x:Print>
        <x:PageSetup>
          <x:Layout x:Orientation="Portrait"/>
          <x:PaperSizeIndex>9</x:PaperSizeIndex>
          <x:FitToPage/>
          <x:FitWidth>1</x:FitWidth>
          <x:FitHeight>0</x:FitHeight>
        </x:PageSetup>
      </x:WorksheetOptions>
    </x:ExcelWorksheet>
  </x:ExcelWorksheets>
</x:ExcelWorkbook>
</xml><![endif]-->
<style>${EXCEL_DOC_STYLE}</style>
</head>
<body>${table}</body>
</html>`;
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Real .xlsx with merged headers and column widths (opens neatly in Excel). */
export function exportAttendanceStatementXlsx({ month, year, headerTitle, rows }) {
  const sheetRows = [
    [headerTitle, "", "", "", "", "", "", ""],
    ["S.NO", "NAME OF THE EMPLOYEE", "NO. OF LATE DAYS", "PRESENT DAYS", "", "", "TOTAL PRESENT DAYS", "ABSENT DAYS"],
    ["", "", "", "FULL DAYS", "HALF DAYS", "SUNDAYS", "", ""],
  ];

  for (const row of rows || []) {
    sheetRows.push([
      row.sno,
      String(row.employeeName || "").toUpperCase(),
      row.lateDays,
      row.fullDays,
      row.halfDays,
      row.sundays,
      row.totalPresentDays,
      row.absentDays,
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(sheetRows);

  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
    { s: { r: 1, c: 0 }, e: { r: 2, c: 0 } },
    { s: { r: 1, c: 1 }, e: { r: 2, c: 1 } },
    { s: { r: 1, c: 2 }, e: { r: 2, c: 2 } },
    { s: { r: 1, c: 3 }, e: { r: 1, c: 5 } },
    { s: { r: 1, c: 6 }, e: { r: 2, c: 6 } },
    { s: { r: 1, c: 7 }, e: { r: 2, c: 7 } },
  ];

  ws["!cols"] = [
    { wch: 6 },
    { wch: 32 },
    { wch: 14 },
    { wch: 11 },
    { wch: 11 },
    { wch: 11 },
    { wch: 18 },
    { wch: 12 },
  ];

  const titleCell = ws.A1;
  if (titleCell) {
    titleCell.s = {
      alignment: { horizontal: "center", vertical: "center" },
      font: { bold: true, sz: 14 },
    };
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Attendance Report");

  const shortMonth = String(month || "").slice(0, 3);
  const filename = `Attendance-Report_${shortMonth}-${year}.xlsx`;
  XLSX.writeFile(wb, filename);
}

export function exportAttendanceStatementExcel({ month, year, headerTitle, rows }) {
  try {
    exportAttendanceStatementXlsx({ month, year, headerTitle, rows });
    return;
  } catch {
    const html = buildAttendanceStatementExcelHtml({ headerTitle, rows });
    const blob = new Blob(["\uFEFF", html], {
      type: "application/vnd.ms-excel;charset=utf-8",
    });
    const shortMonth = String(month || "").slice(0, 3);
    triggerDownload(blob, `Attendance-Report_${shortMonth}-${year}.xls`);
  }
}

export function printAttendanceStatementPdf() {
  window.print();
}
