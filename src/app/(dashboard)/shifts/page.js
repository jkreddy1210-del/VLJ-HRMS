"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Clock, Plus, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListPagination } from "@/components/ui/list-pagination";
import { api } from "@/lib/api-client";
import { useAuth } from "@/context/auth-context";
import { useLookups } from "@/hooks/use-lookups";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

function canAccessShifts(hasPermission) {
  return (
    hasPermission("Shift Management") ||
    hasPermission("Department Management") ||
    hasPermission("Full System Access") ||
    hasPermission("All Permissions")
  );
}

const emptyForm = {
  departmentId: "",
  departmentIds: [],
  shiftName: "",
  startTime: "",
  endTime: "",
  graceMinutes: "0",
  status: "Active",
};

export default function ShiftManagementPage() {
  const router = useRouter();
  const { user, isLoading, hasPermission } = useAuth();
  const { lookups } = useLookups();
  const canManage = canAccessShifts(hasPermission);

  const [shifts, setShifts] = useState([]);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!isLoading && user && !canManage) {
      router.replace("/dashboard");
    }
  }, [user, isLoading, router, canManage]);

  useEffect(() => {
    if (lookups?.pagination?.defaultLimit && limit === null) {
      setLimit(lookups.pagination.defaultLimit);
    }
  }, [lookups, limit]);

  const loadShifts = useCallback(() => {
    if (!limit) return;
    setLoading(true);
    api
      .shifts({ page: String(page), limit: String(limit) })
      .then((data) => {
        setShifts(data.shifts || []);
        setPagination(data.pagination || null);
      })
      .catch((err) => toast.error(err.message || "Failed to load shifts"))
      .finally(() => setLoading(false));
  }, [page, limit]);

  const loadDepartments = useCallback(async (excludeShiftId = null) => {
    try {
      const params = excludeShiftId ? { excludeShiftId: String(excludeShiftId) } : {};
      const data = await api.shiftDepartments(params);
      setDepartmentOptions(data.departments || []);
    } catch (err) {
      toast.error(err.message || "Failed to load departments");
    }
  }, []);

  useEffect(() => {
    if (!user || !canManage || !limit) return;
    loadShifts();
  }, [user, canManage, limit, loadShifts]);

  const toggleDepartment = (deptValue) => {
    setForm((prev) => {
      const ids = prev.departmentIds.includes(deptValue)
        ? prev.departmentIds.filter((id) => id !== deptValue)
        : [...prev.departmentIds, deptValue];
      return { ...prev, departmentIds: ids };
    });
  };

  const openDialog = async (shift = null) => {
    setEditingShift(shift);
    await loadDepartments(shift?.id || null);
    setForm(
      shift
        ? {
            departmentId: String(shift.departmentId),
            departmentIds: [],
            shiftName: shift.shiftName,
            startTime: shift.startTime,
            endTime: shift.endTime,
            graceMinutes: String(shift.graceMinutes ?? 0),
            status: shift.status,
          }
        : emptyForm
    );
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.shiftName.trim() || !form.startTime || !form.endTime) {
      toast.error("Please fill all required fields");
      return;
    }

    if (editingShift) {
      if (!form.departmentId) {
        toast.error("Please select a department");
        return;
      }
    } else if (!form.departmentIds.length) {
      toast.error("Select at least one department");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        shiftName: form.shiftName.trim(),
        startTime: form.startTime,
        endTime: form.endTime,
        graceMinutes: Number(form.graceMinutes || 0),
        status: form.status,
      };

      if (editingShift) {
        await api.updateShift(editingShift.id, {
          ...payload,
          departmentId: Number(form.departmentId),
        });
        toast.success("Shift updated");
      } else {
        const result = await api.createShift({
          ...payload,
          departmentIds: form.departmentIds.map(Number),
        });
        const count = result.shifts?.length || 1;
        toast.success(`Shift created for ${count} department${count > 1 ? "s" : ""}`);
        if (result.skipped?.length) {
          toast.warning(result.skipped.join("; "));
        }
      }

      setDialogOpen(false);
      loadShifts();
    } catch (err) {
      toast.error(err.message || "Failed to save shift");
    }
    setSaving(false);
  };

  const handleDelete = async (shift) => {
    if (!window.confirm(`Delete shift "${shift.shiftName}" for ${shift.departmentName}?`)) return;
    try {
      await api.deleteShift(shift.id);
      toast.success("Shift deleted");
      loadShifts();
    } catch (err) {
      toast.error(err.message || "Failed to delete shift");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold lg:text-3xl">Shift Management</h1>
          <p className="text-muted-foreground">
            Assign one active shift per department. Employees follow their department shift automatically.
          </p>
        </div>
        <Button onClick={() => openDialog()}>
          <Plus className="h-4 w-4" /> Add Shift
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" /> Shift List
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/60" />
              ))}
            </div>
          ) : (
            <>
              <div className="space-y-4 lg:hidden">
                {shifts.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    No shifts configured yet. Create a department first, then add a shift.
                  </div>
                ) : (
                  shifts.map((shift, i) => (
                    <motion.div
                      key={shift.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.04, 0.3) }}
                    >
                      <Card className="glass-card overflow-hidden">
                        <div
                          className={`h-2 bg-gradient-to-r ${
                            shift.status === "Active"
                              ? "from-emerald-500 to-emerald-600"
                              : "from-slate-400 to-slate-500"
                          }`}
                        />
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <CardTitle className="truncate text-base">{shift.departmentName}</CardTitle>
                              <p className="mt-0.5 text-xs text-muted-foreground">{shift.shiftName}</p>
                            </div>
                            <Badge
                              variant={shift.status === "Active" ? "success" : "secondary"}
                              className="shrink-0"
                            >
                              {shift.statusLabel}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3 pt-0">
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Start Time
                              </p>
                              <p className="font-medium">{shift.startTimeDisplay}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                End Time
                              </p>
                              <p className="font-medium">{shift.endTimeDisplay}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Grace Time
                              </p>
                              <p className="font-medium">{shift.graceDisplay}</p>
                            </div>
                          </div>
                          <div className="flex gap-2 border-t pt-3">
                            <Button size="sm" variant="outline" onClick={() => openDialog(shift)}>
                              <Pencil className="h-3.5 w-3.5" /> Edit
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleDelete(shift)}>
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))
                )}
              </div>

              <div className="hidden overflow-x-auto rounded-lg border lg:block">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium">Department</th>
                      <th className="px-4 py-3 text-left font-medium">Shift Name</th>
                      <th className="px-4 py-3 text-left font-medium">Start Time</th>
                      <th className="px-4 py-3 text-left font-medium">End Time</th>
                      <th className="px-4 py-3 text-left font-medium">Grace Time</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-left font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                          No shifts configured yet. Create a department first, then add a shift.
                        </td>
                      </tr>
                    ) : (
                      shifts.map((shift) => (
                        <tr key={shift.id} className="border-b hover:bg-muted/20">
                          <td className="px-4 py-3 font-medium">{shift.departmentName}</td>
                          <td className="px-4 py-3 font-medium">{shift.shiftName}</td>
                          <td className="px-4 py-3">{shift.startTimeDisplay}</td>
                          <td className="px-4 py-3">{shift.endTimeDisplay}</td>
                          <td className="px-4 py-3">{shift.graceDisplay}</td>
                          <td className="px-4 py-3">
                            <Badge variant={shift.status === "Active" ? "success" : "secondary"}>
                              {shift.statusLabel}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => openDialog(shift)}>
                                <Pencil className="h-3.5 w-3.5" /> Edit
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleDelete(shift)}>
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <ListPagination
                page={pagination?.page || page}
                totalPages={pagination?.totalPages || 0}
                total={pagination?.total || 0}
                from={pagination?.from || 0}
                to={pagination?.to || 0}
                limit={pagination?.limit || limit}
                pageSizeOptions={pagination?.pageSizeOptions || lookups?.pagination?.pageSizeOptions || []}
                loading={loading}
                onPageChange={setPage}
                onLimitChange={setLimit}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingShift ? "Edit Shift" : "Add Shift"}</DialogTitle>
            <DialogDescription>
              {editingShift
                ? "Edit shift for this department only."
                : "Select one or more departments to apply the same shift."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Department{editingShift ? "" : "s"}</Label>
              {editingShift ? (
                <Select
                  value={form.departmentId}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, departmentId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departmentOptions.map((dept) => (
                      <SelectItem key={dept.id} value={dept.value} disabled={dept.disabled}>
                        {dept.label}
                        {dept.disabled ? " (Active shift exists)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border p-3">
                  {departmentOptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No departments available</p>
                  ) : (
                    departmentOptions.map((dept) => (
                      <label
                        key={dept.id}
                        className={`flex cursor-pointer items-center gap-2 text-sm ${dept.disabled ? "opacity-50" : ""}`}
                      >
                        <Checkbox
                          checked={form.departmentIds.includes(dept.value)}
                          disabled={dept.disabled}
                          onCheckedChange={() => !dept.disabled && toggleDepartment(dept.value)}
                        />
                        <span>
                          {dept.label}
                          {dept.disabled ? " (Active shift exists)" : ""}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Shift Name</Label>
              <Input
                value={form.shiftName}
                onChange={(e) => setForm((prev) => ({ ...prev, shiftName: e.target.value }))}
                placeholder="e.g. General Shift"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Grace Time (Minutes)</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.graceMinutes}
                  onChange={(e) => setForm((prev) => ({ ...prev, graceMinutes: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingShift ? "Update Shift" : "Create Shift"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
