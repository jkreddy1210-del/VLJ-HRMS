const DEFAULT_ATTENDANCE_STATUSES = [
  {
    code: "present",
    label: "Present",
    dbEnum: "Present",
    sortOrder: 1,
    isMarkable: true,
    isFilterable: true,
    requiresInTime: true,
    badgeVariant: "success",
  },
  {
    code: "absent",
    label: "Absent",
    dbEnum: "Absent",
    sortOrder: 2,
    isMarkable: true,
    isFilterable: true,
    requiresInTime: false,
    badgeVariant: "destructive",
  },
  {
    code: "halfDay",
    label: "Half Day",
    dbEnum: "Half_Day",
    sortOrder: 3,
    isMarkable: true,
    isFilterable: true,
    requiresInTime: true,
    badgeVariant: "warning",
  },
  {
    code: "leave",
    label: "Leave",
    dbEnum: "Leave",
    sortOrder: 4,
    isMarkable: true,
    isFilterable: true,
    requiresInTime: false,
    badgeVariant: "destructive",
  },
  {
    code: "late",
    label: "Late",
    dbEnum: "Late",
    sortOrder: 5,
    isMarkable: false,
    isFilterable: true,
    requiresInTime: true,
    badgeVariant: "info",
  },
];

async function seedAttendanceStatuses(prisma) {
  for (const row of DEFAULT_ATTENDANCE_STATUSES) {
    await prisma.attendanceStatusSetting.upsert({
      where: { code: row.code },
      update: {
        label: row.label,
        dbEnum: row.dbEnum,
        sortOrder: row.sortOrder,
        isMarkable: row.isMarkable,
        isFilterable: row.isFilterable,
        requiresInTime: row.requiresInTime,
        badgeVariant: row.badgeVariant,
        isActive: true,
      },
      create: row,
    });
  }
}

module.exports = { seedAttendanceStatuses };
