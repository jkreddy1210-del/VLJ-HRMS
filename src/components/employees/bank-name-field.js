"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { clearLookupsCache } from "@/hooks/use-lookups";

export function BankNameField({
  value,
  onChange,
  banks = [],
  onBanksChange,
  error,
  required = false,
  className = "",
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const options = banks.length
    ? banks
    : value
      ? [{ value, label: value, bankName: value }]
      : [];

  if (value && !options.some((b) => b.value === value || b.bankName === value)) {
    options.unshift({ value, label: value, bankName: value });
  }

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) {
      toast.error("Enter a bank name");
      return;
    }
    setSaving(true);
    try {
      const { bank } = await api.createBank({ bankName: name });
      clearLookupsCache();
      const next = [...options];
      if (!next.some((b) => (b.bankName || b.value) === bank.bankName)) {
        next.push(bank);
        next.sort((a, b) => String(a.bankName || a.value).localeCompare(String(b.bankName || b.value)));
      }
      onBanksChange?.(next);
      onChange(bank.bankName);
      setNewName("");
      setAddOpen(false);
      toast.success("Bank added");
    } catch (err) {
      toast.error(err.message || "Failed to add bank");
    }
    setSaving(false);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <Label>Bank Name{required ? " *" : ""}</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="mr-1 h-3 w-3" />
          Add Bank
        </Button>
      </div>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger className={error ? "border-destructive focus:ring-destructive" : undefined}>
          <SelectValue placeholder="Select bank" />
        </SelectTrigger>
        <SelectContent>
          {options.map((b) => {
            const v = b.bankName || b.value;
            return (
              <SelectItem key={b.id || v} value={v}>
                {b.label || v}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {error && <p className="text-xs text-destructive">{error}</p>}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Bank</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="e.g. HDFC Bank"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            maxLength={100}
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={handleAdd} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
