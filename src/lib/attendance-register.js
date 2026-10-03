import { formatExcelRegisterDate } from "@/lib/utils";

/** Landscape A4 (mm) */
export const PAGE_WIDTH_MM = 297;
export const PAGE_HEIGHT_MM = 210;
export const PAGE_MARGIN_MM = 8;
export const ROWS_PER_SHEET = 20;
export const PRINT_HEADER_ROWS_MM = 20;
export const PRINT_ROW_HEIGHT_MM =
  (PAGE_HEIGHT_MM - PAGE_MARGIN_MM * 2 - PRINT_HEADER_ROWS_MM) / ROWS_PER_SHEET;

export const PRINTABLE_WIDTH_MM = PAGE_WIDTH_MM - PAGE_MARGIN_MM * 2;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getMonthDays(year, month) {
  const days = [];
  const date = new Date(year, month - 1, 1);
  while (date.getMonth() === month - 1) {
    if (date.getDay() !== 0) days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

export function getMonthIndex(monthName) {
  return MONTHS.indexOf(monthName) + 1;
}

export function filterEmployeesByDepartment(employees, department) {
  if (!department || department === "All Departments") return employees;
  const dept = String(department).trim();
  return employees.filter(
    (e) => String(e.department || "").trim() === dept
  );
}

/** Split month working days (Mon–Sat) into weeks ending on Saturday. */
export function getWeeksForMonth(year, monthName) {
  const monthIndex = getMonthIndex(monthName);
  const days = getMonthDays(year, monthIndex);
  const weeks = [];
  let current = [];

  for (const day of days) {
    current.push(day);
    if (day.getDay() === 6) {
      weeks.push(current);
      current = [];
    }
  }
  if (current.length) weeks.push(current);
  return weeks;
}

export function formatWeekTitle(weekNumber, monthName, year) {
  return `Week ${weekNumber} for the month of ${monthName}-${year}`;
}

export function getDayPairs(days) {
  const pairs = [];
  for (let i = 0; i < days.length; i += 2) {
    pairs.push(days.slice(i, i + 2));
  }
  return pairs;
}

/** Pad or trim employee slice to exactly ROWS_PER_SHEET display rows. */
export function buildSheetRows(employees, startIndex) {
  const rows = [];
  for (let i = 0; i < ROWS_PER_SHEET; i++) {
    const emp = employees[i];
    rows.push({
      sno: startIndex + i + 1,
      name: emp ? String(emp.name).toUpperCase() : "",
      key: emp ? emp.id : `empty-${startIndex + i}`,
    });
  }
  return rows;
}

/**
 * One print page = one week title + one date-pair + 20 rows (Excel layout).
 * Employee lists longer than 20 continue on the next page with the same week/dates.
 */
export function buildRegisterPages({ department, month, year, employees = [] }) {
  const deptEmployees = filterEmployeesByDepartment(employees, department);
  const weeks = getWeeksForMonth(year, month);
  const pages = [];

  weeks.forEach((weekDays, weekIndex) => {
    const dayPairs = getDayPairs(weekDays);
    const weekTitle = formatWeekTitle(weekIndex + 1, month, year);

    dayPairs.forEach((datePair, pairIndex) => {
      const chunks =
        deptEmployees.length > 0
          ? Array.from(
              { length: Math.ceil(deptEmployees.length / ROWS_PER_SHEET) },
              (_, ci) =>
                deptEmployees.slice(
                  ci * ROWS_PER_SHEET,
                  (ci + 1) * ROWS_PER_SHEET
                )
            )
          : [[]];

      chunks.forEach((chunk, chunkIndex) => {
        pages.push({
          id: `${weekIndex}-${pairIndex}-${chunkIndex}`,
          weekNumber: weekIndex + 1,
          weekTitle,
          datePair,
          employees: chunk,
          startIndex: chunkIndex * ROWS_PER_SHEET,
          weekIndex,
          pairIndex,
          chunkIndex,
        });
      });
    });
  });

  return pages.map((p, i) => ({
    ...p,
    globalPageNumber: i + 1,
    totalPages: pages.length,
  }));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildSheetTableHtml(page) {
  const rows = buildSheetRows(page.employees, page.startIndex);
  const date1 = page.datePair[0] ? formatExcelRegisterDate(page.datePair[0]) : "";
  const date2 = page.datePair[1] ? formatExcelRegisterDate(page.datePair[1]) : "";
  const padSecond = page.datePair.length === 1;

  const bodyRows = rows
    .map(
      (row) => `
    <tr class="data-row">
      <td class="c-sno">${row.sno}</td>
      <td class="c-name">${escapeHtml(row.name)}</td>
      <td class="c-field"></td><td class="c-field"></td><td class="c-field c-section-end"></td>
      <td class="c-field"></td><td class="c-field"></td><td class="c-field"></td>
    </tr>`
    )
    .join("");

  return `
  <table class="week-table" cellspacing="0" cellpadding="0">
    <colgroup>
      <col style="width:5%" />
      <col style="width:24%" />
      <col style="width:10.5%" /><col style="width:10.5%" /><col style="width:10.5%" />
      <col style="width:10.5%" /><col style="width:10.5%" /><col style="width:10.5%" />
    </colgroup>
    <thead>
      <tr>
        <th colspan="8" class="week-title-row">${escapeHtml(page.weekTitle)}</th>
      </tr>
      <tr>
        <th rowspan="2" class="h-sno">S.No</th>
        <th rowspan="2" class="h-name">Name of the Employee</th>
        <th colspan="3" class="h-date">${escapeHtml(date1)}</th>
        <th colspan="3" class="h-date">${escapeHtml(padSecond ? "" : date2)}</th>
      </tr>
      <tr>
        <th class="h-sub">In Time</th><th class="h-sub">Out Time</th><th class="h-sub c-section-end">Signature</th>
        <th class="h-sub">In Time</th><th class="h-sub">Out Time</th><th class="h-sub">Signature</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>`;
}

function buildPageHtml(page) {
  return `
  <div class="page-block">
    ${buildSheetTableHtml(page)}
  </div>`;
}

function buildExcelDocumentHtml(pages) {
  const body = pages.map((p) => buildPageHtml(p)).join("");

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<!--[if gte mso 9]><xml>
<x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>Attendance Register</x:Name>
<x:WorksheetOptions>
  <x:PageSetup>
    <x:Layout x:Orientation="Landscape"/>
    <x:PaperSizeIndex>9</x:PaperSizeIndex>
    <x:FitToPage/><x:FitWidth>1</x:FitWidth><x:FitHeight>1</x:FitHeight>
  </x:PageSetup>
</x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook>
</xml><![endif]-->
<style>
  @page { size: A4 landscape; margin: 8mm; }
  body { font-family: Calibri, Arial, sans-serif; color: #000; margin: 0; }
  .page-block { page-break-after: always; width: 100%; }
  .page-block:last-child { page-break-after: auto; }
  table.week-table {
    border-collapse: collapse;
    table-layout: fixed;
    width: 100%;
    border: 2px solid #000;
  }
  th, td {
    border: 1px solid #000;
    padding: 2pt 4pt;
    font-size: 10pt;
    vertical-align: middle;
  }
  .week-title-row {
    text-align: center;
    font-size: 11pt;
    font-weight: bold;
    border: 1px solid #000;
    padding: 5pt 4pt;
  }
  .h-name, .c-name { text-align: left; border-right: 2px solid #000; }
  .h-sno, .c-sno { text-align: center; }
  .h-date, .h-sub { text-align: center; font-weight: bold; }
  thead tr:nth-child(3) th { border-bottom: 2px solid #000; }
  .c-section-end { border-right: 2px solid #000; }
  .data-row { height: ${PRINT_ROW_HEIGHT_MM.toFixed(2)}mm; }
  .data-row td { height: ${PRINT_ROW_HEIGHT_MM.toFixed(2)}mm; }
</style>
</head>
<body>${body}</body>
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

export function exportAttendanceRegisterExcel({
  department,
  month,
  year,
  employees = [],
}) {
  const pages = buildRegisterPages({ department, month, year, employees });
  const html = buildExcelDocumentHtml(pages);
  const blob = new Blob(["\uFEFF", html], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });

  const safeDept = String(department)
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  const filename = `Attendance-Register_${safeDept}_${month}-${year}.xls`;
  triggerDownload(blob, filename);
}

export function downloadRegisterPdf() {
  window.print();
}
