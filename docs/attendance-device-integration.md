# Attendance Device Integration

This module is vendor-neutral. A device provider has a registry entry, each device employee ID is explicitly mapped to an HRMS employee, and inbound device events are stored for review before they can affect payroll-facing attendance.

## KENT webhook

KENT CamAttendance Cloud documents a real-time webhook that sends recognition data to a client-provided endpoint. The documented recognition payload includes `empId`, `time`, `type`, `deviceId`, and other metadata.

The HRMS receiver is:

`POST /api/attendance/kent`

Authentication is supported in either of these forms:

- `x-kent-token: <token>`
- `Authorization: Bearer <token>`
- URL query parameter: `?token=<token>`

The query-parameter form is provided because the current KENT Webhooks screen exposes only the webhook name, type, and endpoint URL; it does not expose a custom-header field.

For KENT, configure the endpoint as:

`https://hrms.varlakshmijewellery.co.in/api/attendance/kent?token=<KENT_ATTENDANCE_WEBHOOK_TOKEN>`

Do not commit the token to Git. Store it only in the server environment.

## Safety behavior

- Existing `Employee.camAttendanceId` and attendance workflows remain unchanged.
- Device IDs are mapped independently to HRMS employee IDs; employee names are never used for matching.
- The webhook stores inbound recognition events first; it does **not** automatically mark IN/OUT attendance yet.
- Unknown persons and unmapped device employee IDs are retained as reviewable event statuses.
- Duplicate external event IDs are ignored when KENT provides an event/record/recognition ID.
- Never put the webhook token in source control or send it to a browser.

## Device setup

1. Register the KENT device in `attendance_devices` with provider `KENT` and the exact `deviceId` sent by KENT.
2. Create an employee-device mapping for each employee using the exact KENT `empId`.
3. Configure the KENT Webhook as a Recognition webhook.
4. Validate the endpoint.
5. Send a controlled recognition and inspect the inbound event before enabling automatic attendance processing.

## Management API

All management endpoints require normal HRMS bearer-token authentication.

- `GET /api/attendance-devices` — list active devices.
- `POST /api/attendance-devices` — register a device.
- `PATCH /api/attendance-devices/:id` — update device metadata or status.
- `GET /api/attendance-devices/:id/mappings` — list employee mappings.
- `POST /api/attendance-devices/:id/mappings` — create a mapping.
- `PATCH /api/attendance-devices/:id/mappings/:mappingId` — activate/deactivate a mapping.
- `GET /api/attendance-devices/:id/events` — review received device events.

## KENT event fields accepted

The receiver recognizes `deviceId`, `empId`, and `time`, plus common aliases such as `device_id`, `employeeId`, `timestamp`, and `occurredAt`. It also records `type` and optional `eventId`, `recordId`, or `recognitionId`.

The exact provider payload and timezone will be verified during the first live test. No automatic IN/OUT calculation is performed until those semantics are confirmed.

## Database portability

The webhook is implemented at the HRMS application/API layer and uses Prisma. It is not tied to Supabase-specific APIs. The same integration is intended to work when the HRMS database is moved to MySQL/MariaDB on the Synology NAS, subject to the normal Prisma schema/migration compatibility checks.
