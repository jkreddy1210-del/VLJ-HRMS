"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  FileBarChart,
  Search,
  RotateCcw,
  Printer,
  FileSpreadsheet,
  FileText,
  Upload,
  Download,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AttendanceMonthlyStatement } from "@/components/reports/attendance-monthly-statement";
import {
  exportAttendanceStatementExcel,
  printAttendanceStatementPdf,
} from "@/lib/attendance-monthly-report";
import { api } from "@/lib/api-client";
import { useAuth } from "@/context/auth-context";
import { useLookups } from "@/hooks/use-lookups";
import { toast } from "sonner";

function canAccessReport(hasPermission) {
  return (
    hasPermission("Generate Reports") ||
    hasPermission("View Team Reports") ||
    hasPermission("Full System Access") ||
    hasPermission("All Permissions")
  );
}

function canBulkUploadReport(user, hasPermission) {
  return (
    hasPermission("Attendance Monitoring") ||
    hasPermission("Attendance Corrections") ||
    hasPermission("Mark Attendance") ||
    hasPermission("Full System Access") ||
    hasPermission("All Permissions") ||
    ["security", "hr", "admin", "super_admin"].includes(user?.role)
  );
}

const defaultFilters = () => ({
  month: "",
  year: String(new Date().getFullYear()),
  department: "all",
  search: "",
});

export default function AttendanceReportPage() {
  const router = useRouter();
  const { user, isLoading, hasPermission } = useAuth();
  const { lookups } = useLookups();
  const canView = canAccessReport(hasPermission);
  const canBulk = canBulkUploadReport(user, hasPermission);
  const fileInputRef = useRef(null);

  const [filters, setFilters] = useState(defaultFilters);
  const [draft, setDraft] = useState(defaultFilters);
  const [rows, setRows] = useState([]);
  const [headerTitle, setHeaderTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  const months = lookups?.months || [];
  const years = lookups?.reportYears || [];

  useEffect(() => {
    if (!isLoading && user && !canView) {
      router.replace("/dashboard");
    }
  }, [user, isLoading, router, canView]);

  useEffect(() => {
    if (months.length && !draft.month) {
      const currentMonth = months[new Date().getMonth()]?.value || months[0]?.value || "";
      setDraft((prev) => ({ ...prev, month: currentMonth }));
    }
  }, [months, draft.month]);

  const loadReport = useCallback((activeFilters) => {
    if (!activeFilters.month) {
      toast.error("Select a month");
      return;
    }

    setLoading(true);
    api
      .attendanceReport({
        month: activeFilters.month,
        year: activeFilters.year,
        department: activeFilters.department,
        search: activeFilters.search.trim(),
      })
      .then((data) => {
        setRows(data.rows || []);
        setHeaderTitle(data.headerTitle || "");
        setGenerated(true);
      })
      .catch((err) => toast.error(err.message || "Failed to load report"))
      .finally(() => setLoading(false));
  }, []);

  const handleSearch = () => {
    setFilters(draft);
    loadReport(draft);
  };

  const handleReset = () => {
    const reset = {
      ...defaultFilters(),
      month: months[new Date().getMonth()]?.value || months[0]?.value || "",
    };
    setDraft(reset);
    setFilters(reset);
    setRows([]);
    setHeaderTitle("");
    setGenerated(false);
  };

  const handlePrint = () => {
    if (!generated || !rows.length) {
      toast.error("Generate the report first");
      return;
    }
    printAttendanceStatementPdf();
  };

  const handleExportExcel = () => {
    if (!generated || !rows.length) {
      toast.error("Generate the report first");
      return;
    }
    try {
      exportAttendanceStatementExcel({
        month: filters.month,
        year: filters.year,
        headerTitle,
        rows,
      });
      toast.success("Excel file downloaded.");
    } catch (err) {
      toast.error(err?.message || "Failed to export Excel");
    }
  };

  const handleExportPdf = () => {
    if (!generated || !rows.length) {
      toast.error("Generate the report first");
      return;
    }
    printAttendanceStatementPdf();
    toast.info("Choose 'Save as PDF' in the print dialog.");
  };

  const handleDownloadTemplate = async () => {
    try {
      await api.downloadAttendanceMonthlyBulkTemplate();
      toast.success("Template downloaded");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleBulkUpload = async () => {
    if (!bulkFile) {
      toast.error("Select an Excel file");
      return;
    }
    setUploading(true);
    try {
      const result = await api.bulkUploadAttendanceMonthly(bulkFile);
      setUploadResult(result);
      setBulkOpen(false);
      setBulkFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setResultOpen(true);
      if (result.summary?.success > 0 && (filters.month || draft.month)) {
        const active = filters.month ? filters : draft;
        setFilters(active);
        loadReport(active);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const departmentOptions = (lookups?.reportDepartmentOptions || []).filter(
    (opt) => opt.value !== "All Departments"
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold lg:text-3xl">Attendance Report</h1>
          <p className="text-muted-foreground">
            Monthly attendance statement with present, late and absent day totals.
          </p>
        </div>
        {canBulk && (
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => setBulkOpen(true)}>
            <Upload className="h-4 w-4" /> Bulk Upload
          </Button>
        )}
      </div>

      <Card className="glass-card no-print">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileBarChart className="h-5 w-5 text-champagne" />
            Filters
          </CardTitle>
          <CardDescription>Select month, year and department to generate the statement</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label>Month</Label>
              <Select
                value={draft.month}
                onValueChange={(value) => setDraft((prev) => ({ ...prev, month: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m.value} value={String(m.value)}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Year</Label>
              <Select
                value={draft.year}
                onValueChange={(value) => setDraft((prev) => ({ ...prev, year: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y.value} value={String(y.value)}>
                      {y.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Department</Label>
              <Select
                value={draft.department}
                onValueChange={(value) => setDraft((prev) => ({ ...prev, department: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departmentOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Search Employee</Label>
              <Input
                placeholder="Name or employee code"
                value={draft.search}
                onChange={(e) => setDraft((prev) => ({ ...prev, search: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch();
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="premium" onClick={handleSearch} disabled={loading}>
              <Search className="h-4 w-4" />
              {loading ? "Searching..." : "Search"}
            </Button>
            <Button variant="outline" onClick={handleReset} disabled={loading}>
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
            {generated && (
              <>
                <Button variant="outline" onClick={handlePrint}>
                  <Printer className="h-4 w-4" />
                  Print
                </Button>
                <Button variant="outline" onClick={handleExportExcel}>
                  <FileSpreadsheet className="h-4 w-4" />
                  Export Excel
                </Button>
                <Button variant="outline" onClick={handleExportPdf}>
                  <FileText className="h-4 w-4" />
                  Export PDF
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {generated && (
        <Card className="glass-card">
          <CardHeader className="no-print">
            <CardTitle>Attendance Statement</CardTitle>
            <CardDescription>
              {filters.month} {filters.year}
              {filters.department !== "all" ? ` · ${filters.department}` : ""}
              {filters.search ? ` · "${filters.search}"` : ""}
              {" · "}
              {rows.length} employee(s)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-6">
            <AttendanceMonthlyStatement headerTitle={headerTitle} rows={rows} />
          </CardContent>
        </Card>
      )}

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Upload Monthly Attendance</DialogTitle>
            <DialogDescription>
              Upload month-wise totals for previous months. Columns: Employee Code, Employee Name, Month,
              Year, Late Days, Full Days, Half Days, Sundays, Total Present, Absent.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Button variant="outline" className="w-full" onClick={handleDownloadTemplate}>
              <Download className="mr-2 h-4 w-4" /> Download Excel Template
            </Button>
            <div className="rounded-lg border border-dashed p-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-champagne file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
                onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
              />
              {bulkFile && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Selected: <span className="font-medium text-foreground">{bulkFile.name}</span>
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button variant="premium" onClick={handleBulkUpload} disabled={uploading || !bulkFile}>
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Results</DialogTitle>
            <DialogDescription>Summary of the monthly attendance bulk upload</DialogDescription>
          </DialogHeader>
          {uploadResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-2xl font-bold">{uploadResult.summary?.total ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Total Rows</p>
                </div>
                <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950/30">
                  <p className="flex items-center justify-center gap-1 text-2xl font-bold text-emerald-600">
                    <CheckCircle2 className="h-5 w-5" />
                    {uploadResult.summary?.success ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Saved</p>
                </div>
                <div className="rounded-lg bg-red-50 p-3 dark:bg-red-950/30">
                  <p className="flex items-center justify-center gap-1 text-2xl font-bold text-red-600">
                    <XCircle className="h-5 w-5" />
                    {uploadResult.summary?.failed ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
              </div>

              {uploadResult.failures?.length > 0 && (
                <div className="space-y-2">
                  <p className="flex items-center gap-1 text-sm font-medium text-amber-600">
                    <AlertCircle className="h-4 w-4" /> Failed rows
                  </p>
                  <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border p-2">
                    {uploadResult.failures.map((item, idx) => (
                      <div key={idx} className="rounded-md bg-muted/40 p-2 text-sm">
                        <p className="font-medium">
                          Row {item.row}
                          {item.employeeCode ? ` · ${item.employeeCode}` : ""}
                          {item.month ? ` · ${item.month}` : ""}
                          {item.year ? ` ${item.year}` : ""}
                        </p>
                        <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                          {(item.errors || []).map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setResultOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
