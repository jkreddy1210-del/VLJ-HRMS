"use client";

import "./attendance-monthly-statement.css";

export function AttendanceMonthlyStatement({ headerTitle, rows = [] }) {
  return (
    <div className="print-area attendance-statement-root">
      <div className="attendance-statement-scroll">
        <table className="attendance-statement-table" cellSpacing={0} cellPadding={0}>
          <colgroup>
            <col className="attendance-col-sno" />
            <col className="attendance-col-name" />
            <col className="attendance-col-num" />
            <col className="attendance-col-num" />
            <col className="attendance-col-num" />
            <col className="attendance-col-num" />
            <col className="attendance-col-num" />
            <col className="attendance-col-num" />
          </colgroup>
          <thead>
            <tr>
              <th className="attendance-statement-title" colSpan={8}>
                {headerTitle}
              </th>
            </tr>
            <tr>
              <th className="attendance-statement-sub" rowSpan={2}>
                S.NO
              </th>
              <th className="attendance-statement-sub attendance-statement-name" rowSpan={2}>
                NAME OF THE EMPLOYEE
              </th>
              <th className="attendance-statement-sub" rowSpan={2}>
                NO. OF LATE DAYS
              </th>
              <th className="attendance-statement-sub" colSpan={3}>
                PRESENT DAYS
              </th>
              <th className="attendance-statement-sub" rowSpan={2}>
                TOTAL PRESENT DAYS
              </th>
              <th className="attendance-statement-sub" rowSpan={2}>
                ABSENT DAYS
              </th>
            </tr>
            <tr>
              <th className="attendance-statement-sub">FULL DAYS</th>
              <th className="attendance-statement-sub">HALF DAYS</th>
              <th className="attendance-statement-sub">SUNDAYS</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="attendance-statement-data-row">
                <td colSpan={8} className="py-8 text-center text-muted-foreground">
                  No records found for the selected filters
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.employeeId || row.sno} className="attendance-statement-data-row">
                  <td className="attendance-statement-num">{row.sno}</td>
                  <td className="attendance-statement-name">{row.employeeName}</td>
                  <td className="attendance-statement-num">{row.lateDays}</td>
                  <td className="attendance-statement-num">{row.fullDays}</td>
                  <td className="attendance-statement-num">{row.halfDays}</td>
                  <td className="attendance-statement-num" title={`Sundays attended (month has ${row.sundaysInMonth ?? "—"} Sundays)`}>
                    {row.sundays}
                  </td>
                  <td className="attendance-statement-num">{row.totalPresentDays}</td>
                  <td className="attendance-statement-num">{row.absentDays}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
