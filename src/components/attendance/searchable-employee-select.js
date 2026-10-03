"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function SearchableEmployeeSelect({
  employees = [],
  value,
  onSelect,
  label = "Employee *",
  placeholder = "Search employee by name or code...",
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const selected = employees.find((e) => e.employeeCode === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (emp) =>
        emp.employeeName?.toLowerCase().includes(q) ||
        emp.employeeCode?.toLowerCase().includes(q) ||
        emp.department?.toLowerCase().includes(q)
    );
  }, [employees, query]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!value) {
      setQuery("");
      return;
    }
    if (selected && !open) {
      setQuery(`${selected.employeeName} (${selected.employeeCode})`);
    }
  }, [value, selected, open]);

  const handleInputChange = (e) => {
    const next = e.target.value;
    setQuery(next);
    setOpen(true);
    if (value) onSelect("");
  };

  const handleSelect = (emp) => {
    onSelect(emp.employeeCode);
    setQuery(`${emp.employeeName} (${emp.employeeCode})`);
    setOpen(false);
  };

  return (
    <div className="space-y-2" ref={containerRef}>
      <Label>{label}</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="pl-9"
          autoComplete="off"
        />
        {open && (
          <ul
            className={cn(
              "absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-md border bg-popover py-1 shadow-md",
              filtered.length === 0 && "p-3 text-sm text-muted-foreground"
            )}
          >
            {filtered.length === 0 ? (
              <li>No employees found</li>
            ) : (
              filtered.map((emp) => (
                <li key={emp.employeeCode}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted",
                      value === emp.employeeCode && "bg-champagne/10 text-champagne"
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(emp)}
                  >
                    <span className="font-medium">
                      {emp.employeeName}{" "}
                      <span className="font-mono text-xs text-muted-foreground">({emp.employeeCode})</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {emp.department}
                      {emp.alreadyMarked ? " · already marked" : ""}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
