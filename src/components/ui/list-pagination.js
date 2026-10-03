"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ListPagination({
  page = 1,
  totalPages = 0,
  total = 0,
  from = 0,
  to = 0,
  limit = 25,
  pageSizeOptions = [],
  onPageChange,
  onLimitChange,
  loading = false,
  className = "",
}) {
  if (!total && !loading) return null;

  const canPrev = page > 1;
  const canNext = totalPages > 0 && page < totalPages;
  const sizes = pageSizeOptions.length ? pageSizeOptions : [{ value: limit, label: `${limit} / page` }];

  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <p className="text-sm text-muted-foreground">
        {total > 0 ? `Showing ${from}–${to} of ${total}` : "No records"}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {onLimitChange && sizes.length > 0 && (
          <Select value={String(limit)} onValueChange={(v) => onLimitChange(Number(v))}>
            <SelectTrigger className="h-9 w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sizes.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9"
            disabled={!canPrev || loading}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[7rem] text-center text-sm">
            Page {totalPages ? page : 0} of {totalPages || 0}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9"
            disabled={!canNext || loading}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
