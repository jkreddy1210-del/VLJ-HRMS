/**
 * Free Indian festivals via Google Calendar public ICS
 * ("Holidays in India") — no API key, no DB seed.
 * Covers past/future years Google publishes in the feed.
 */

const ICS_URL =
  "https://calendar.google.com/calendar/ical/en.indian%23holiday%40group.v.calendar.google.com/public/basic.ics";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** @type {{ fetchedAt: number, events: Array<{ date: string, name: string, type: string, description: string|null }> } | null} */
let cache = null;

const FIXED_NATIONAL = [
  { name: "Republic Day", month: 1, day: 26, type: "National" },
  { name: "Independence Day", month: 8, day: 15, type: "National" },
  { name: "Gandhi Jayanti", month: 10, day: 2, type: "National" },
  { name: "Christmas", month: 12, day: 25, type: "Christian" },
];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function dateKey(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function unfoldIcs(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n[ \t]/g, "");
}

function classifyType(name, description) {
  const blob = `${name} ${description || ""}`.toLowerCase();
  if (blob.includes("public holiday") || /republic day|independence day|gandhi/.test(blob)) {
    return "National";
  }
  if (/eid|muharram|milad|ramzan|bakr/.test(blob)) return "Muslim";
  if (/christmas|good friday|easter/.test(blob)) return "Christian";
  if (/guru nanak|vaisakhi|baisakhi|guru gobind/.test(blob)) return "Sikh";
  if (/mahavir/.test(blob)) return "Jain";
  if (/buddha|buddha purnima/.test(blob)) return "Buddhist";
  return "Festival";
}

function parseIcsEvents(icsText) {
  const text = unfoldIcs(icsText);
  const blocks = text.split("BEGIN:VEVENT").slice(1);
  const events = [];

  for (const block of blocks) {
    const body = block.split("END:VEVENT")[0] || "";
    const dateMatch = body.match(/DTSTART(?:;VALUE=DATE)?:(\d{8})/);
    const summaryMatch = body.match(/SUMMARY:([^\n]*)/);
    if (!dateMatch || !summaryMatch) continue;

    const raw = dateMatch[1];
    const date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    const name = summaryMatch[1]
      .trim()
      .replace(/\\,/g, ",")
      .replace(/\\n/g, " ")
      .replace(/\\/g, "");
    if (!name) continue;

    const descMatch = body.match(/DESCRIPTION:([^\n]*)/);
    const description = descMatch
      ? descMatch[1].trim().replace(/\\,/g, ",").replace(/\\n/g, " ").replace(/\\/g, "")
      : null;

    events.push({
      date,
      name,
      type: classifyType(name, description),
      description: description && description.length < 200 ? description : null,
    });
  }

  return events;
}

async function loadAllEvents() {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS && cache.events.length) {
    return cache.events;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(ICS_URL, {
      signal: controller.signal,
      headers: { Accept: "text/calendar, text/plain, */*" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      throw new Error(`Festival feed HTTP ${res.status}`);
    }
    const text = await res.text();
    const events = parseIcsEvents(text);
    if (!events.length) {
      throw new Error("Festival feed returned no events");
    }
    cache = { fetchedAt: now, events };
    return events;
  } finally {
    clearTimeout(timer);
  }
}

function fixedFestivalsForMonth(year, month) {
  return FIXED_NATIONAL.filter((f) => f.month === month).map((f) => ({
    id: `fixed-${year}-${pad2(f.month)}-${pad2(f.day)}-${f.name}`,
    name: f.name,
    date: dateKey(year, f.month, f.day),
    type: f.type,
    description: null,
  }));
}

/**
 * Festivals for a calendar month (any year present in the free Google ICS feed).
 * Falls back to fixed national days if the feed is unreachable.
 */
export async function getFestivalsForMonth(year, month) {
  const prefix = `${year}-${pad2(month)}-`;
  let fromFeed = [];
  let source = "google-ics";

  try {
    const all = await loadAllEvents();
    fromFeed = all
      .filter((e) => e.date.startsWith(prefix))
      .map((e, idx) => ({
        id: `ics-${e.date}-${idx}`,
        name: e.name,
        date: e.date,
        type: e.type,
        description: e.description,
      }));
  } catch (err) {
    console.warn("Festival ICS fetch failed, using fixed national days:", err?.message || err);
    source = "fixed-fallback";
  }

  const fixed = fixedFestivalsForMonth(year, month);
  const byKey = new Map();
  for (const f of [...fromFeed, ...fixed]) {
    const key = `${f.date}|${f.name.toLowerCase()}`;
    if (!byKey.has(key)) byKey.set(key, f);
  }

  const festivals = [...byKey.values()].sort((a, b) =>
    a.date === b.date ? a.name.localeCompare(b.name) : a.date.localeCompare(b.date)
  );

  return { festivals, source };
}
