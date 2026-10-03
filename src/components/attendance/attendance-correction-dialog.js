"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import { toast } from "sonner";

export function AttendanceCorrectionDialog({ open, onOpenChange, row, date, statuses, onSuccess }) {
  const [requestedStatus, setRequestedStatus] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !row) return;
    setRequestedStatus("");
    setReason("");
  }, [open, row]);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error("Please enter a reason for attendance correction");
      return;
    }
    if (!requestedStatus) {
      toast.error("Please select requested status");
      return;
    }

    setSubmitting(true);
    try {
      await api.submitAttendanceCorrection({
        date,
        employeeCode: row.employeeCode,
        attendanceId: row.attendanceId || undefined,
        requestedStatus,
        reason: reason.trim(),
      });
      toast.success("Attendance corrected");
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error(err.message || "Failed to save correction");
    }
    setSubmitting(false);
  };

  if (!row) return null;

  const dateLabel = new Date(date).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Attendance Correction</DialogTitle>
          <DialogDescription>
            Update past attendance with a reason. Changes save immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="grid gap-3 rounded-lg border bg-muted/30 p-3">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Employee Name</span>
              <span className="font-medium text-right">{row.employeeName}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Attendance Date</span>
              <span className="font-medium text-right">{dateLabel}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Current Status</span>
              <Badge variant="outline">{row.statusLabel || "Not Marked"}</Badge>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Requested Status *</Label>
            <Select value={requestedStatus} onValueChange={setRequestedStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Reason / Remarks *</Label>
            <Textarea
              placeholder="Why is this correction needed?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="premium" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving..." : "Save Correction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
