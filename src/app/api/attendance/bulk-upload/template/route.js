import { requireAuth, canBulkImportAttendance, forbiddenResponse } from "@/lib/auth-server";
import { buildAttendanceTemplateWorkbook } from "@/lib/attendance-bulk-upload";

export async function GET(request) {
  const { user, error } = await requireAuth(request);
  if (error) return error;
  if (!canBulkImportAttendance(user)) return forbiddenResponse();

  const buffer = buildAttendanceTemplateWorkbook();

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="attendance-bulk-upload-template.xlsx"',
    },
  });
}
