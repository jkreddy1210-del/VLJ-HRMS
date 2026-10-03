import { requireAuth, canBulkImportAttendance, forbiddenResponse } from "@/lib/auth-server";
import { buildMonthlyAttendanceTemplateWorkbook } from "@/lib/attendance-monthly-bulk-upload";

export async function GET(request) {
  const { user, error } = await requireAuth(request);
  if (error) return error;
  if (!canBulkImportAttendance(user)) return forbiddenResponse();

  const buffer = buildMonthlyAttendanceTemplateWorkbook();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="attendance-monthly-report-template.xlsx"',
    },
  });
}
