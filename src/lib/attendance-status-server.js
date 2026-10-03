import { formatEnumLabel } from "@/lib/lookups";
import { DEFAULT_ATTENDANCE_STATUSES } from "@/lib/attendance-status-defaults";

function mapStatusRow(row) {
  return {
    id: row.id,
    code: row.code,
    value: row.code,
    label: row.label,
    dbEnum: row.dbEnum,
    sortOrder: row.sortOrder,
    isMarkable: row.isMarkable,
    isFilterable: row.isFilterable,
    requiresInTime: row.requiresInTime,
    badgeVariant: row.badgeVariant,
  };
}

export async function loadAttendanceStatusSettings(prisma) {
  try {
    const rows = await prisma.attendanceStatusSetting.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
    if (rows.length) return rows.map(mapStatusRow);
  } catch {
    // Table may not exist before migration
  }
  return DEFAULT_ATTENDANCE_STATUSES.map((row, index) =>
    mapStatusRow({ id: index + 1, isActive: true, ...row })
  );
}

export async function getAttendanceMarkStatuses(prisma) {
  const rows = await loadAttendanceStatusSettings(prisma);
  return rows
    .filter((s) => s.isMarkable)
    .map(({ value, label, dbEnum, requiresInTime, badgeVariant }) => ({
      value,
      label,
      dbEnum,
      requiresInTime,
      badgeVariant,
    }));
}

export async function getAttendanceListFilters(prisma) {
  const rows = await loadAttendanceStatusSettings(prisma);
  return [
    { value: "all", label: "All Employees" },
    ...rows
      .filter((s) => s.isMarkable)
      .map((s) => ({ value: s.label, label: s.label })),
  ];
}

export async function resolveMarkStatusToDb(prisma, apiValue) {
  const rows = await loadAttendanceStatusSettings(prisma);
  const entry = rows.find((s) => s.code === apiValue && s.isMarkable);
  return entry?.dbEnum || null;
}

export async function resolveDisplayStatusToMarkApi(prisma, displayStatus) {
  if (!displayStatus) return null;
  const normalized = String(displayStatus).trim();
  const rows = await loadAttendanceStatusSettings(prisma);
  const entry = rows.find(
    (s) =>
      s.isMarkable &&
      (formatEnumLabel(s.dbEnum) === normalized || s.label === normalized)
  );
  return entry?.code || null;
}

export async function dbStatusRequiresInTime(prisma, dbEnum) {
  const rows = await loadAttendanceStatusSettings(prisma);
  const entry = rows.find((s) => s.dbEnum === dbEnum);
  return Boolean(entry?.requiresInTime);
}

export async function resolveFilterStatusToDb(prisma, filterValue) {
  if (!filterValue || filterValue === "all") return null;
  const rows = await loadAttendanceStatusSettings(prisma);
  const entry = rows.find((s) => s.label === filterValue || formatEnumLabel(s.dbEnum) === filterValue);
  return entry?.dbEnum || filterValue;
}

export async function getMarkedStatusDbEnums(prisma) {
  const rows = await loadAttendanceStatusSettings(prisma);
  return rows.filter((s) => s.isMarkable || s.isFilterable).map((s) => s.dbEnum);
}

export async function resolveDbEnumToMarkApi(prisma, dbEnum) {
  const rows = await loadAttendanceStatusSettings(prisma);
  const entry = rows.find((s) => s.dbEnum === dbEnum);
  return entry?.code || null;
}

export async function resolveMarkApiToDbEnum(prisma, apiValue) {
  const rows = await loadAttendanceStatusSettings(prisma);
  const entry = rows.find((s) => s.code === apiValue);
  return entry?.dbEnum || null;
}

export async function getStatusBadgeVariant(prisma, labelOrDbEnum) {
  const rows = await loadAttendanceStatusSettings(prisma);
  const normalized = String(labelOrDbEnum || "").trim();
  const entry = rows.find(
    (s) => s.label === normalized || formatEnumLabel(s.dbEnum) === normalized || s.dbEnum === normalized
  );
  return entry?.badgeVariant || "secondary";
}
