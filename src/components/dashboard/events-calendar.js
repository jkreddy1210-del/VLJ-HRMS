"use client";

import { useEffect, useMemo, useState } from "react";
import { Cake, ChevronLeft, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const WEEKDAYS = [
  { label: "Sun", className: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300" },
  { label: "Mon", className: "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300" },
  { label: "Tue", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" },
  { label: "Wed", className: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" },
  { label: "Thu", className: "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300" },
  { label: "Fri", className: "bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300" },
  { label: "Sat", className: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300" },
];

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

const selectClassName =
  "h-8 rounded-md border border-input bg-background px-2 text-sm font-medium shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-champagne/40";

function buildCells(year, month, daysInMonth) {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({ day, date });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function dayCellTone({ hasFestival, hasBirthday, isToday, isSelected }) {
  if (hasFestival && hasBirthday) {
    return cn(
      "border-violet-300/80 bg-gradient-to-br from-amber-100 via-orange-50 to-rose-100",
      "dark:border-violet-500/40 dark:from-amber-950/50 dark:via-orange-950/30 dark:to-rose-950/50",
      isSelected && "ring-2 ring-violet-400/70 ring-offset-1 ring-offset-background",
      isToday && !isSelected && "ring-1 ring-champagne"
    );
  }
  if (hasFestival) {
    return cn(
      "border-amber-300/90 bg-amber-50",
      "dark:border-amber-500/40 dark:bg-amber-950/40",
      isSelected && "ring-2 ring-amber-400/80 ring-offset-1 ring-offset-background",
      isToday && !isSelected && "ring-1 ring-champagne"
    );
  }
  if (hasBirthday) {
    return cn(
      "border-rose-300/90 bg-rose-50",
      "dark:border-rose-500/40 dark:bg-rose-950/40",
      isSelected && "ring-2 ring-rose-400/80 ring-offset-1 ring-offset-background",
      isToday && !isSelected && "ring-1 ring-champagne"
    );
  }
  return cn(
    "border-border/60 bg-background/70 hover:bg-muted/60",
    isSelected && "border-champagne bg-champagne/10 ring-2 ring-champagne/50 ring-offset-1 ring-offset-background",
    isToday && !isSelected && "border-champagne/50 bg-champagne/5"
  );
}

export function EventsCalendar({ className }) {
  const now = useMemo(() => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
    }).formatToParts(new Date());
    const get = (type) => Number(parts.find((p) => p.type === type)?.value);
    return { year: get("year"), month: get("month") };
  }, []);

  const [year, setYear] = useState(now.year);
  const [month, setMonth] = useState(now.month);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api
      .dashboardCalendar({ year, month })
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setSelectedDate((prev) => {
          if (prev && prev.startsWith(`${year}-${String(month).padStart(2, "0")}`)) return prev;
          if (res.today?.startsWith(`${year}-${String(month).padStart(2, "0")}`)) return res.today;
          return `${year}-${String(month).padStart(2, "0")}-01`;
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setData(null);
        setError(err.message || "Failed to load calendar");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year, month]);

  const shiftMonth = (delta) => {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1));
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth() + 1);
  };

  const cells = data ? buildCells(data.year, data.month, data.daysInMonth) : [];
  const selected =
    selectedDate && data?.byDate?.[selectedDate]
      ? data.byDate[selectedDate]
      : { festivals: [], birthdays: [] };
  const monthFestivalCount = data?.festivals?.length || 0;
  const monthBirthdayCount = data?.birthdays?.length || 0;
  const yearOptions = useMemo(() => {
    const start = Math.min(now.year - 1, year);
    const end = Math.max(now.year + 5, year);
    const list = [];
    for (let y = start; y <= end; y++) list.push(y);
    return list;
  }, [now.year, year]);

  return (
    <Card className={cn("glass-card", className)}>
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Calendar</CardTitle>
            <CardDescription className="text-xs">
              Select month & year to view festivals and birthdays
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <select
              aria-label="Select month"
              className={cn(selectClassName, "min-w-[8.5rem]")}
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Select year"
              className={cn(selectClassName, "min-w-[5rem]")}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/50 dark:text-amber-200">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/40" />
            Festival
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 font-medium text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/50 dark:text-rose-200">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/40" />
            Birthday
          </span>
          <span className="ml-auto rounded-full bg-muted px-2.5 py-1 font-medium text-muted-foreground">
            {MONTHS[month - 1]?.label} {year} · {monthFestivalCount} festival
            {monthFestivalCount === 1 ? "" : "s"} · {monthBirthdayCount} birthday
            {monthBirthdayCount === 1 ? "" : "s"}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : error ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{error}</p>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAYS.map((d) => (
                <div
                  key={d.label}
                  className={cn(
                    "rounded-md py-1.5 text-center text-[10px] font-bold uppercase tracking-wide",
                    d.className
                  )}
                >
                  {d.label}
                </div>
              ))}
              {cells.map((cell, idx) => {
                if (!cell) {
                  return <div key={`e-${idx}`} className="min-h-[4rem] rounded-lg bg-muted/15" />;
                }
                const dayData = data.byDate?.[cell.date] || { festivals: [], birthdays: [] };
                const hasFestival = dayData.festivals.length > 0;
                const hasBirthday = dayData.birthdays.length > 0;
                const isToday = cell.date === data.today;
                const isSelected = cell.date === selectedDate;
                return (
                  <button
                    key={cell.date}
                    type="button"
                    onClick={() => setSelectedDate(cell.date)}
                    className={cn(
                      "min-h-[4rem] rounded-lg border p-1.5 text-left transition-all",
                      dayCellTone({ hasFestival, hasBirthday, isToday, isSelected })
                    )}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span
                        className={cn(
                          "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[11px] font-bold",
                          isToday && "bg-champagne text-white shadow-sm",
                          !isToday && hasFestival && !hasBirthday && "text-amber-900 dark:text-amber-100",
                          !isToday && hasBirthday && !hasFestival && "text-rose-900 dark:text-rose-100",
                          !isToday && hasFestival && hasBirthday && "text-violet-900 dark:text-violet-100",
                          !isToday && !hasFestival && !hasBirthday && "text-foreground"
                        )}
                      >
                        {cell.day}
                      </span>
                      <span className="flex items-center gap-0.5 pt-0.5">
                        {hasFestival && (
                          <span className="h-2 w-2 rounded-full bg-amber-500 ring-2 ring-amber-200/80 dark:ring-amber-900/60" />
                        )}
                        {hasBirthday && (
                          <span className="h-2 w-2 rounded-full bg-rose-500 ring-2 ring-rose-200/80 dark:ring-rose-900/60" />
                        )}
                      </span>
                    </div>
                    {hasFestival && (
                      <p className="mt-1 truncate rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-semibold leading-tight text-amber-900 dark:bg-amber-400/15 dark:text-amber-100">
                        {dayData.festivals[0].name}
                      </p>
                    )}
                    {!hasFestival && hasBirthday && (
                      <p className="mt-1 truncate rounded bg-rose-500/15 px-1 py-0.5 text-[9px] font-semibold leading-tight text-rose-900 dark:bg-rose-400/15 dark:text-rose-100">
                        {dayData.birthdays[0].employeeName.split(" ")[0]}
                        {dayData.birthdays.length > 1 ? ` +${dayData.birthdays.length - 1}` : ""}
                      </p>
                    )}
                    {hasFestival && hasBirthday && (
                      <p className="mt-0.5 truncate text-[9px] font-medium leading-tight text-rose-700 dark:text-rose-300">
                        +{dayData.birthdays.length} birthday
                        {dayData.birthdays.length === 1 ? "" : "s"}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl border border-champagne/20 bg-gradient-to-br from-background via-background to-champagne/5 p-3.5">
              <p className="mb-3 text-xs font-semibold text-foreground">
                {selectedDate
                  ? new Date(`${selectedDate}T00:00:00Z`).toLocaleDateString("en-IN", {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      timeZone: "UTC",
                    })
                  : "Select a date"}
              </p>
              {!selected.festivals.length && !selected.birthdays.length ? (
                <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-4 text-center text-sm text-muted-foreground">
                  No festivals or birthdays on this day.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {selected.festivals.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-start gap-2.5 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2.5 dark:border-amber-500/25 dark:bg-amber-950/40"
                    >
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">
                        <Sparkles className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-amber-950 dark:text-amber-50">{f.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {f.type && (
                            <Badge className="h-5 border-0 bg-amber-500/20 text-[10px] text-amber-900 hover:bg-amber-500/20 dark:text-amber-100">
                              {f.type}
                            </Badge>
                          )}
                          {f.description && (
                            <span className="text-[11px] text-amber-800/80 dark:text-amber-200/70">
                              {f.description}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {selected.birthdays.map((b) => (
                    <div
                      key={b.employeeId}
                      className="flex items-start gap-2.5 rounded-lg border border-rose-200/80 bg-rose-50/90 px-3 py-2.5 dark:border-rose-500/25 dark:bg-rose-950/40"
                    >
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-300">
                        <Cake className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-rose-950 dark:text-rose-50">{b.employeeName}</p>
                        <p className="font-mono text-[11px] text-rose-700/80 dark:text-rose-200/70">
                          {b.employeeCode}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
