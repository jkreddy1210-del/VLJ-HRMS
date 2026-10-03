"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Plus,
  Check,
  X,
  Clock,
  Palmtree,
  Heart,
  Star,
  Gift,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, getLocalDateString, isDateBeforeToday } from "@/lib/utils";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { useAuth } from "@/context/auth-context";
import { useLookups } from "@/hooks/use-lookups";
import { ListPagination } from "@/components/ui/list-pagination";

const LEAVE_ICON_MAP = {
  Palmtree,
  Heart,
  Star,
  Gift,
  RefreshCw,
  CalendarDays,
  Clock,
};

export default function LeavesPage() {
  const { user, hasPermission } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";

  const [requests, setRequests] = useState([]);
  const [leaveBalances, setLeaveBalances] = useState({});
  const [leaveTypeBalances, setLeaveTypeBalances] = useState({});
  const [holidays, setHolidays] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [leaveTypeMeta, setLeaveTypeMeta] = useState([]);
  const [viewMode, setViewMode] = useState(isSuperAdmin ? "all" : "self");
  const [canApplyLeave, setCanApplyLeave] = useState(false);
  const [employeeLeaveBalances, setEmployeeLeaveBalances] = useState([]);
  const [applyOpen, setApplyOpen] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(null);
  const [leaveActing, setLeaveActing] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ leaveType: "", fromDate: "", toDate: "", reason: "" });
  const [loading, setLoading] = useState(true);
  const [requestPage, setRequestPage] = useState(1);
  const [requestLimit, setRequestLimit] = useState(null);
  const [requestStatus, setRequestStatus] = useState("all");
  const [requestPagination, setRequestPagination] = useState(null);
  const [leaveRequestStatusFilters, setLeaveRequestStatusFilters] = useState([]);
  const [balancePage, setBalancePage] = useState(1);
  const [balanceLimit, setBalanceLimit] = useState(null);
  const [balancePagination, setBalancePagination] = useState(null);
  const { lookups } = useLookups();

  useEffect(() => {
    if (lookups?.pagination?.defaultLimit) {
      if (requestLimit === null) setRequestLimit(lookups.pagination.defaultLimit);
      if (balanceLimit === null) setBalanceLimit(lookups.pagination.defaultLimit);
    }
  }, [lookups, requestLimit, balanceLimit]);

  const loadLeaves = (silent = false) => {
    if (!requestLimit || !balanceLimit) return;
    if (!silent) setLoading(true);
    api.leaves({
      page: String(requestPage),
      limit: String(requestLimit),
      status: requestStatus,
      balancePage: String(balancePage),
      balanceLimit: String(balanceLimit),
    })
      .then((data) => {
        setRequests(data.leaveRequests || []);
        setLeaveBalances(data.leaveBalances || {});
        setLeaveTypeBalances(data.leaveTypeBalances || {});
        setEmployeeLeaveBalances(data.employeeLeaveBalances || []);
        setViewMode(data.viewMode || (isSuperAdmin ? "all" : "self"));
        setCanApplyLeave(!!data.canApply);
        setHolidays(data.holidays || []);
        setLeaveTypes(data.leaveTypes || []);
        setLeaveTypeMeta(data.leaveTypeMeta || []);
        setRequestPagination(data.leaveRequestPagination || null);
        setBalancePagination(data.balancePagination || null);
        setLeaveRequestStatusFilters(
          data.leaveRequestStatusFilters || lookups?.leaveRequestStatusFilters || []
        );
      })
      .catch(() => {})
      .finally(() => {
        if (!silent) setLoading(false);
      });
  };

  useEffect(() => {
    setRequestPage(1);
  }, [requestStatus, requestLimit]);

  useEffect(() => {
    setBalancePage(1);
  }, [balanceLimit]);

  useEffect(() => { loadLeaves(); }, [requestPage, requestLimit, requestStatus, balancePage, balanceLimit]);

  const leaveCards = leaveTypeMeta.map((card) => ({
    ...card,
    icon: LEAVE_ICON_MAP[card.icon] || CalendarDays,
  }));
  const isSuperAdminView = viewMode === "all";
  const canApply = canApplyLeave;
  const today = getLocalDateString();
  const canApprove =
    hasPermission("Leave Approval") ||
    hasPermission("Approve Any Leave") ||
    hasPermission("Final Leave Approval") ||
    hasPermission("Full System Access");

  const statusVariant = (s) => {
    if (s === "Approved") return "success";
    if (s === "Pending") return "warning";
    return "destructive";
  };

  const handleApprove = async (id, level) => {
    try {
      await api.updateLeave(id, { action: "approve", level });
      setLeaveConfirm(null);
      loadLeaves(true);
      toast.success("Leave approved");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLeaveActing(false);
    }
  };

  const handleReject = async (id) => {
    try {
      await api.updateLeave(id, { action: "reject" });
      setLeaveConfirm(null);
      loadLeaves(true);
      toast.success("Leave rejected");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLeaveActing(false);
    }
  };

  const askLeaveConfirm = (req, action, level) => {
    setLeaveConfirm({
      id: req.id,
      action,
      level: level || null,
      employeeName: req.employeeName,
      leaveType: req.type || req.leaveType,
      from: req.from,
      to: req.to,
    });
  };

  const confirmLeaveAction = async () => {
    if (!leaveConfirm) return;
    setLeaveActing(true);
    if (leaveConfirm.action === "approve") {
      await handleApprove(leaveConfirm.id, leaveConfirm.level);
    } else {
      await handleReject(leaveConfirm.id);
    }
  };

  const selectedBalance = leaveTypeBalances[leaveForm.leaveType];
  const requestedDays =
    leaveForm.fromDate && leaveForm.toDate
      ? Math.max(
          0,
          Math.ceil(
            (new Date(leaveForm.toDate) - new Date(leaveForm.fromDate)) / (1000 * 60 * 60 * 24)
          ) + 1
        )
      : 0;

  const handleApplyLeave = async () => {
    if (!leaveForm.leaveType) {
      toast.error("Please select a leave type");
      return;
    }
    if (!leaveForm.fromDate || !leaveForm.toDate) {
      toast.error("Please select from and to dates");
      return;
    }
    if (isDateBeforeToday(leaveForm.fromDate) || isDateBeforeToday(leaveForm.toDate)) {
      toast.error("Cannot apply leave for past dates");
      return;
    }
    if (leaveForm.toDate < leaveForm.fromDate) {
      toast.error("To date cannot be before from date");
      return;
    }
    const balance = leaveTypeBalances[leaveForm.leaveType];
    if (!balance || balance.available <= 0) {
      toast.error(`No ${leaveForm.leaveType} balance left to apply`);
      return;
    }
    if (requestedDays > balance.available) {
      toast.error(`Only ${balance.available} day(s) available for ${leaveForm.leaveType}`);
      return;
    }
    try {
      await api.applyLeave(leaveForm);
      setApplyOpen(false);
      setLeaveForm({ leaveType: "", fromDate: "", toDate: "", reason: "" });
      loadLeaves(true);
      toast.success("Leave application submitted");
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold lg:text-3xl">Leave Management</h1>
          <p className="text-muted-foreground">
            {isSuperAdminView
              ? "View employee leave balances and approve requests"
              : "Apply, approve, and track employee leaves"}
          </p>
        </div>
        {canApply && (
          <Button variant="premium" className="w-full sm:w-auto" onClick={() => setApplyOpen(true)}>
            <Plus className="h-4 w-4" /> Apply Leave
          </Button>
        )}
      </div>

      {loading ? (
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <div className="h-6 w-56 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-4 w-72 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent>
            <div className={`animate-pulse rounded-lg bg-muted/60 ${isSuperAdminView ? "h-48" : "h-36"}`} />
          </CardContent>
        </Card>
      ) : isSuperAdminView ? (
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Employee Leave Balances ({new Date().getFullYear()})</CardTitle>
            <CardDescription>Remaining leave days for all active employees</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[min(22rem,40vh)] overflow-auto rounded-lg border">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="sticky top-0 z-10 bg-muted/95 px-4 py-3 text-left backdrop-blur-sm">Employee</th>
                    <th className="sticky top-0 z-10 bg-muted/95 px-4 py-3 text-left backdrop-blur-sm">Department</th>
                    {leaveCards.map((card) => (
                      <th key={card.key} className="sticky top-0 z-10 bg-muted/95 px-3 py-3 text-center whitespace-nowrap backdrop-blur-sm">
                        {card.label}
                        <span className="block text-[10px] font-normal text-muted-foreground">Left / Total</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employeeLeaveBalances.map((emp) => (
                    <tr key={emp.employeeId} className="border-b hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <p className="font-medium">{emp.employeeName}</p>
                        <p className="text-xs text-muted-foreground">{emp.employeeCode}</p>
                      </td>
                      <td className="px-4 py-3">{emp.department}</td>
                      {leaveCards.map((card) => {
                        const b = emp.balances?.[card.key] || { remaining: 0, total: 0, used: 0 };
                        return (
                          <td key={card.key} className="px-3 py-3 text-center">
                            <span className={`font-semibold ${b.remaining <= 0 ? "text-destructive" : "text-emerald-600"}`}>
                              {b.remaining}
                            </span>
                            <span className="text-muted-foreground"> / {b.total}</span>
                            {b.pending > 0 && (
                              <p className="text-[10px] text-amber-600">{b.pending} pending</p>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ListPagination
              page={balancePagination?.page || balancePage}
              totalPages={balancePagination?.totalPages || 0}
              total={balancePagination?.total || 0}
              from={balancePagination?.from || 0}
              to={balancePagination?.to || 0}
              limit={balancePagination?.limit || balanceLimit}
              pageSizeOptions={balancePagination?.pageSizeOptions || lookups?.pagination?.pageSizeOptions || []}
              loading={loading}
              onPageChange={setBalancePage}
              onLimitChange={setBalanceLimit}
              className="mt-4"
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">My Leave Balance ({new Date().getFullYear()})</CardTitle>
            <CardDescription>Total allotted, used, and remaining days per leave type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {leaveCards.map((card, i) => {
                const balance = leaveBalances[card.key] || {
                  remaining: 0,
                  used: 0,
                  total: 0,
                  pending: 0,
                  available: 0,
                };
                const exhausted = balance.available <= 0;
                return (
                  <motion.div
                    key={card.key}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <div
                      className={`rounded-xl border p-4 ${
                        exhausted ? "border-destructive/30 bg-destructive/5" : "bg-card"
                      }`}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <div className={`inline-flex rounded-lg p-2 ${card.bg}`}>
                          <card.icon className={`h-5 w-5 ${card.color}`} />
                        </div>
                        {exhausted && (
                          <Badge variant="destructive" className="text-[10px]">
                            Exhausted
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-lg font-bold text-champagne">{balance.total}</p>
                          <p className="text-[10px] text-muted-foreground">Total</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-amber-600">{balance.used}</p>
                          <p className="text-[10px] text-muted-foreground">Used</p>
                        </div>
                        <div>
                          <p className={`text-lg font-bold ${exhausted ? "text-destructive" : "text-emerald-600"}`}>
                            {balance.remaining}
                          </p>
                          <p className="text-[10px] text-muted-foreground">Left</p>
                        </div>
                      </div>
                      {balance.pending > 0 && (
                        <p className="mt-2 text-center text-[10px] text-amber-600">
                          {balance.pending} day(s) pending approval
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="requests" className="space-y-4">
        <TabsList>
          <TabsTrigger value="requests">Leave Requests</TabsTrigger>
          <TabsTrigger value="calendar">Leave Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          <Card className="glass-card">
            <CardHeader className="space-y-4">
              <div>
                <CardTitle>Pending & Recent Requests</CardTitle>
                <CardDescription>Manager and HR approval workflow</CardDescription>
              </div>
              <Select value={requestStatus} onValueChange={setRequestStatus}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {(leaveRequestStatusFilters.length
                    ? leaveRequestStatusFilters
                    : lookups?.leaveRequestStatusFilters || []
                  ).map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="h-48 animate-pulse rounded-lg bg-muted/60" />
              ) : (
              <>
              <div className="max-h-[min(28rem,45vh)] overflow-auto rounded-lg border">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="sticky top-0 z-10 bg-muted/95 px-4 py-3 text-left backdrop-blur-sm">Employee</th>
                      <th className="sticky top-0 z-10 bg-muted/95 px-4 py-3 text-left backdrop-blur-sm">Department</th>
                      <th className="sticky top-0 z-10 bg-muted/95 px-4 py-3 text-left backdrop-blur-sm">Leave Type</th>
                      <th className="sticky top-0 z-10 bg-muted/95 px-4 py-3 text-left backdrop-blur-sm">Duration</th>
                      <th className="sticky top-0 z-10 bg-muted/95 px-4 py-3 text-left backdrop-blur-sm">Days</th>
                      <th className="sticky top-0 z-10 bg-muted/95 px-4 py-3 text-left backdrop-blur-sm">Manager</th>
                      <th className="sticky top-0 z-10 bg-muted/95 px-4 py-3 text-left backdrop-blur-sm">HR</th>
                      <th className="sticky top-0 z-10 bg-muted/95 px-4 py-3 text-left backdrop-blur-sm">Status</th>
                      <th className="sticky top-0 z-10 bg-muted/95 px-4 py-3 text-left backdrop-blur-sm">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((req) => (
                      <tr key={req.id} className="border-b hover:bg-muted/20">
                        <td className="px-4 py-3">
                          <p className="font-medium">{req.employeeName}</p>
                          <p className="text-xs text-muted-foreground">{req.employeeCode}</p>
                        </td>
                        <td className="px-4 py-3">{req.department}</td>
                        <td className="px-4 py-3">{req.leaveType}</td>
                        <td className="px-4 py-3">
                          {formatDate(req.from)} - {formatDate(req.to)}
                        </td>
                        <td className="px-4 py-3">{req.days}</td>
                        <td className="px-4 py-3">
                          <Badge variant={statusVariant(req.managerStatus)} className="text-[10px]">
                            {req.managerStatus}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={statusVariant(req.hrStatus === "N/A" ? "secondary" : req.hrStatus)} className="text-[10px]">
                            {req.hrStatus}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={statusVariant(req.status)}>{req.status}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          {req.status === "Pending" && canApprove && (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-emerald-600"
                                title="Approve (Manager)"
                                onClick={() => askLeaveConfirm(req, "approve", "manager")}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-emerald-600"
                                title="Approve (HR)"
                                onClick={() => askLeaveConfirm(req, "approve", "hr")}
                              >
                                <Clock className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                title="Reject"
                                onClick={() => askLeaveConfirm(req, "reject")}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ListPagination
                page={requestPagination?.page || requestPage}
                totalPages={requestPagination?.totalPages || 0}
                total={requestPagination?.total || 0}
                from={requestPagination?.from || 0}
                to={requestPagination?.to || 0}
                limit={requestPagination?.limit || requestLimit}
                pageSizeOptions={requestPagination?.pageSizeOptions || lookups?.pagination?.pageSizeOptions || []}
                loading={loading}
                onPageChange={setRequestPage}
                onLimitChange={setRequestLimit}
              />
              </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-champagne" /> Holidays
                </CardTitle>
              </CardHeader>
              <CardContent className="max-h-[min(28rem,45vh)] space-y-3 overflow-y-auto pr-1">
                {holidays.map((h) => (
                  <div key={h.date} className="flex items-center justify-between rounded-lg border p-3">
                    <span className="font-medium">{h.name}</span>
                    <span className="text-sm text-muted-foreground">{formatDate(h.date)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Approved Leaves</CardTitle>
              </CardHeader>
              <CardContent className="max-h-[min(28rem,45vh)] space-y-3 overflow-y-auto pr-1">
                {requests.filter((r) => r.status === "Approved").map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-medium">{r.employeeName}</p>
                      <p className="text-xs text-muted-foreground">{r.leaveType}</p>
                    </div>
                    <span className="text-sm">{formatDate(r.from)} - {formatDate(r.to)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply for Leave</DialogTitle>
            <DialogDescription>Submit a new leave request for approval</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Leave Type</Label>
              <Select value={leaveForm.leaveType} onValueChange={(v) => setLeaveForm((f) => ({ ...f, leaveType: v }))}>
                <SelectTrigger><SelectValue placeholder="Select leave type" /></SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((t) => {
                    const bal = leaveTypeBalances[t] || { available: 0, total: 0, used: 0 };
                    const disabled = bal.available <= 0;
                    return (
                      <SelectItem key={t} value={t} disabled={disabled}>
                        {t} — {disabled ? "No balance left" : `${bal.available} of ${bal.total} available`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {selectedBalance && (
                <p className="text-xs text-muted-foreground">
                  Total: {selectedBalance.total} · Used: {selectedBalance.used} · Left:{" "}
                  {selectedBalance.remaining}
                  {selectedBalance.pending > 0 && ` · Pending: ${selectedBalance.pending}`}
                  {requestedDays > 0 && ` · Requesting: ${requestedDays} day(s)`}
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>From Date</Label>
                <Input
                  type="date"
                  min={today}
                  value={leaveForm.fromDate}
                  onChange={(e) => {
                    const fromDate = e.target.value;
                    setLeaveForm((f) => ({
                      ...f,
                      fromDate,
                      toDate: f.toDate && f.toDate < fromDate ? fromDate : f.toDate,
                    }));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>To Date</Label>
                <Input
                  type="date"
                  min={leaveForm.fromDate || today}
                  value={leaveForm.toDate}
                  onChange={(e) => setLeaveForm((f) => ({ ...f, toDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea placeholder="Reason for leave" value={leaveForm.reason} onChange={(e) => setLeaveForm((f) => ({ ...f, reason: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyOpen(false)}>Cancel</Button>
            <Button variant="premium" onClick={handleApplyLeave}>Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(leaveConfirm)}
        onOpenChange={(open) => {
          if (!open && !leaveActing) setLeaveConfirm(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {leaveConfirm?.action === "approve" ? "Approve leave?" : "Reject leave?"}
            </DialogTitle>
            <DialogDescription>
              {leaveConfirm ? (
                <>
                  Are you sure you want to{" "}
                  <span className="font-semibold text-foreground">
                    {leaveConfirm.action === "approve" ? "approve" : "reject"}
                  </span>{" "}
                  leave for{" "}
                  <span className="font-semibold text-foreground">{leaveConfirm.employeeName}</span>
                  {leaveConfirm.leaveType ? ` (${leaveConfirm.leaveType})` : ""}
                  {leaveConfirm.from && leaveConfirm.to
                    ? ` · ${formatDate(leaveConfirm.from)} – ${formatDate(leaveConfirm.to)}`
                    : ""}
                  ?
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={leaveActing}
              onClick={() => setLeaveConfirm(null)}
            >
              No
            </Button>
            <Button
              type="button"
              disabled={leaveActing || !leaveConfirm}
              className={
                leaveConfirm?.action === "approve"
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-red-600 text-white hover:bg-red-700"
              }
              onClick={confirmLeaveAction}
            >
              Yes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
