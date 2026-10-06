import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

function getSuppliedToken(request) {
  const queryToken = new URL(request.url).searchParams.get("token");
  if (queryToken) return queryToken;

  const headerToken = request.headers.get("x-kent-token");
  if (headerToken) return headerToken;

  const authorization = request.headers.get("authorization") || "";
  return authorization.replace(/^Bearer\s+/i, "");
}

function authorized(request) {
  const expected = process.env.KENT_ATTENDANCE_WEBHOOK_TOKEN;
  if (!expected || expected.length < 32) return false;

  const supplied = getSuppliedToken(request);
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function parseOccurredAt(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number" || /^\d{10,13}$/.test(String(value))) {
    const numeric = Number(value);
    const milliseconds = String(value).length <= 10 ? numeric * 1000 : numeric;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function extractDeviceId(payload) {
  const value = payload?.deviceId ?? payload?.device_id ?? payload?.device?.id;
  return value === undefined || value === null || value === "" ? null : String(value).trim();
}

function extractEmployeeId(payload) {
  const value = payload?.empId ?? payload?.employeeId ?? payload?.employee_id ?? payload?.userId;
  return value === undefined || value === null || value === "" ? null : String(value).trim();
}

function extractEventId(payload) {
  const value = payload?.eventId ?? payload?.recordId ?? payload?.recognitionId ?? payload?.event_id;
  return value === undefined || value === null || value === "" ? null : String(value).trim();
}

async function storeEvent(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { accepted: false, status: 400, error: "Each event must be a JSON object" };
  }

  const externalDeviceId = extractDeviceId(payload);
  const deviceEmployeeId = extractEmployeeId(payload);
  const occurredAt = parseOccurredAt(
    payload.time ?? payload.timestamp ?? payload.occurredAt ?? payload.occurred_at
  );

  if (!externalDeviceId) return { accepted: false, status: 400, error: "Missing deviceId" };
  if (!deviceEmployeeId) return { accepted: false, status: 400, error: "Missing empId/employeeId" };
  if (!occurredAt) return { accepted: false, status: 400, error: "Missing or invalid event time" };

  const device = await prisma.attendanceDevice.findFirst({
    where: { provider: "KENT", externalDeviceId, isActive: true },
    select: { id: true },
  });

  if (!device) {
    return {
      accepted: false,
      status: 404,
      error: "Active KENT device not registered for this deviceId",
    };
  }

  const eventType =
    payload.type === undefined || payload.type === null
      ? null
      : String(payload.type).slice(0, 50);

  const mapping = await prisma.employeeDeviceMapping.findFirst({
    where: {
      attendanceDeviceId: device.id,
      deviceEmployeeId,
      isActive: true,
    },
    select: { id: true },
  });

  let processingStatus = "NeedsReview";
  let errorMessage =
    "Event stored for review; attendance is not auto-marked until device punch semantics are confirmed.";

  if (payload.type === 0 || payload.type === "0") {
    processingStatus = "UnknownPerson";
    errorMessage = "Device reported an unknown/unrecognized person.";
  } else if (!mapping) {
    processingStatus = "UnmatchedEmployee";
    errorMessage = "No active employee mapping exists for this device employee ID.";
  }

  const externalEventId = extractEventId(payload);

  try {
    const event = await prisma.deviceAttendanceEvent.create({
      data: {
        attendanceDeviceId: device.id,
        deviceEmployeeId,
        externalEventId,
        occurredAt,
        eventType,
        processingStatus,
        errorMessage,
        rawPayload: payload,
      },
      select: { id: true, processingStatus: true },
    });

    return {
      accepted: true,
      eventId: event.id,
      status: event.processingStatus,
    };
  } catch (error) {
    if (error?.code === "P2002" && externalEventId) {
      return {
        accepted: true,
        duplicate: true,
        status: "DuplicateIgnored",
      };
    }
    throw error;
  }
}

export async function GET(request) {
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json({
    success: true,
    service: "KENT attendance webhook",
    ready: true,
  });
}

export async function POST(request) {
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const events = Array.isArray(body) ? body : [body];

    if (!events.length || events.length > 100) {
      return Response.json(
        { error: "Send between 1 and 100 events per request" },
        { status: 400 }
      );
    }

    const results = [];
    for (const event of events) {
      results.push(await storeEvent(event));
    }

    const acceptedCount = results.filter((item) => item.accepted).length;
    const failedCount = results.length - acceptedCount;

    return Response.json(
      {
        success: failedCount === 0,
        received: results.length,
        accepted: acceptedCount,
        failed: failedCount,
        results,
      },
      { status: failedCount && !acceptedCount ? 400 : 200 }
    );
  } catch (error) {
    console.error("KENT attendance webhook failed:", error);
    return Response.json(
      { error: "Failed to store attendance device event" },
      { status: 500 }
    );
  }
}
