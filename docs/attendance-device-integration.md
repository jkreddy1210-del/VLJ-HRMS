# Attendance Device Integration

This module is vendor-neutral. A device provider has a registry entry, each device employee ID is explicitly mapped to an HRMS employee, and inbound device events are stored for review before they can affect payroll-facing attendance.

## Safety behavior

- Existing `Employee.camAttendanceId` and attendance workflows remain unchanged.
- Device IDs are mapped independently to HRMS employee IDs; employee names are never used for matching.
- The KENT webhook requires `KENT_ATTENDANCE_WEBHOOK_TOKEN` and accepts it as `x-kent-token` or a Bearer token.
- The webhook only stores events. It does **not** automatically mark IN/OUT attendance. Confirm the device's event semantics and timezone first.
- Never put the webhook token in source control or send it to a browser.

## Setup

1. Apply the migration in a test database first. Do not run `prisma migrate deploy` on production until the schema has been validated and a backup is confirmed.
2. Register the KENT device through the authenticated API. Set `provider` to `KENT` and `externalDeviceId` to the exact `deviceId` delivered by the webhook.
3. Set a long random secret (at least 32 characters) in the server environment as `KENT_ATTENDANCE_WEBHOOK_TOKEN`, then restart the HRMS process.
4. In KENT's webhook configuration, set the URL to `https://hrms.varlakshmijewellery.co.in/api/attendance/kent` and configure the same token using the supported header if KENT permits custom headers. If the device provider cannot send a secret header, do not expose this endpoint publicly without adding a provider-supported signature or network allowlist.
5. Create an employee-device mapping for each employee. Device employee IDs such as `VLJ001` remain separate from HRMS codes such as `VLJ-IT-2001`.

## API

All management endpoints require the normal HRMS bearer-token authentication.

- `GET /api/attendance-devices` — list active devices. Add `?includeInactive=true` to include disabled devices.
- `POST /api/attendance-devices` — create a device with `{ "name": "...", "provider": "KENT", "externalDeviceId": "...", "location": "..." }`.
- `PATCH /api/attendance-devices/:id` — update device metadata or `isActive`.
- `GET /api/attendance-devices/:id/mappings` — list employee mappings.
- `POST /api/attendance-devices/:id/mappings` — create mapping with `{ "employeeId": 123, "deviceEmployeeId": "VLJ001" }`.
- `PATCH /api/attendance-devices/:id/mappings/:mappingId` — activate/deactivate a mapping with `{ "isActive": false }`.
- `GET /api/attendance-devices/:id/events` — review recent device events; optional `status` and `limit` query parameters.
- `POST /api/attendance/kent` — authenticated device webhook. Accepts one event object or an array of up to 100 events.

## KENT event fields accepted

The receiver recognizes `deviceId`, `empId`, and `time`, plus common aliases (`device_id`, `employeeId`, `timestamp`, etc.). It records `type` and an optional `eventId`/`recordId`/`recognitionId` for deduplication. The exact provider payload and timezone must be verified before implementing automatic attendance processing.

Events without a matching active device or with invalid required fields are rejected. Unmapped employee IDs and unknown-person events are retained with review statuses when the device is registered.
