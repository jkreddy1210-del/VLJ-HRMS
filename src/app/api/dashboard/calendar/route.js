import { requireAuth } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { getDashboardCalendarMonth, parseYearMonth } from "@/lib/dashboard-calendar";

export async function GET(request) {
  const { error } = await requireAuth(request);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const { year, month } = parseYearMonth(searchParams);
    const result = await getDashboardCalendarMonth(prisma, year, month);
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 400 });
    }
    const { ok: _ok, ...payload } = result;
    return Response.json(payload);
  } catch (err) {
    console.error("Dashboard calendar error:", err);
    return Response.json({ error: "Failed to load calendar" }, { status: 500 });
  }
}
