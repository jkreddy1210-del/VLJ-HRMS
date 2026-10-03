"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Minus, Pencil, Plus, Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const STORAGE_PREFIX = "emp_quick_actions_";

function storageKey(userId) {
  return `${STORAGE_PREFIX}${userId || "guest"}`;
}

function loadPinnedIds(userId, allowedIds) {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((id) => allowedIds.includes(id));
  } catch {
    return null;
  }
}

function savePinnedIds(userId, ids) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(ids));
  } catch {
    /* ignore quota */
  }
}

export function QuickActionsCard({
  availableActions = [],
  userId,
  className = "",
  gridClassName = "grid grid-cols-2 gap-3 sm:grid-cols-3",
}) {
  const allowedIds = useMemo(() => availableActions.map((a) => a.id), [availableActions]);
  const [pinnedIds, setPinnedIds] = useState(allowedIds);
  const [editing, setEditing] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = loadPinnedIds(userId, allowedIds);
    setPinnedIds(saved?.length ? saved : allowedIds);
    setHydrated(true);
  }, [userId, allowedIds.join("|")]);

  useEffect(() => {
    if (!hydrated) return;
    // Drop removed permissions from pin list
    setPinnedIds((prev) => {
      const next = prev.filter((id) => allowedIds.includes(id));
      return next.length ? next : allowedIds;
    });
  }, [allowedIds.join("|"), hydrated]);

  if (!availableActions.length) return null;

  const pinnedActions = pinnedIds
    .map((id) => availableActions.find((a) => a.id === id))
    .filter(Boolean);
  const availableToAdd = availableActions.filter((a) => !pinnedIds.includes(a.id));

  const persist = (ids) => {
    setPinnedIds(ids);
    savePinnedIds(userId, ids);
  };

  const removeAction = (id) => {
    if (pinnedIds.length <= 1) {
      toast.error("Keep at least one quick action");
      return;
    }
    persist(pinnedIds.filter((x) => x !== id));
  };

  const addAction = (id) => {
    if (pinnedIds.includes(id)) return;
    persist([...pinnedIds, id]);
  };

  const finishEdit = () => {
    setEditing(false);
    toast.success("Quick actions updated");
  };

  return (
    <Card className={`glass-card ${className}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            {editing ? "Tap − to remove, + to add" : "Frequently used actions"}
          </CardDescription>
        </div>
        <Button
          type="button"
          variant={editing ? "premium" : "outline"}
          size="sm"
          className="h-8 shrink-0"
          onClick={() => (editing ? finishEdit() : setEditing(true))}
        >
          {editing ? (
            <>
              <Check className="h-3.5 w-3.5" /> Done
            </>
          ) : (
            <>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={gridClassName}>
          {pinnedActions.map((action) => {
            const href = action.useProfileHref ? `/employees/${userId}` : action.href;
            const tile = (
              <motion.div
                whileHover={editing ? undefined : { scale: 1.02 }}
                whileTap={editing ? undefined : { scale: 0.98 }}
                className="relative flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors hover:bg-muted/50"
              >
                {editing && (
                  <button
                    type="button"
                    aria-label={`Remove ${action.label}`}
                    className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      removeAction(action.id);
                    }}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                )}
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${action.color} text-white`}>
                  <action.icon className="h-5 w-5" />
                </div>
                <span className="text-center text-xs font-medium">{action.label}</span>
              </motion.div>
            );

            if (editing) {
              return <div key={action.id}>{tile}</div>;
            }
            return (
              <Link key={action.id} href={href}>
                {tile}
              </Link>
            );
          })}
        </div>

        {editing && availableToAdd.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground">Add more</p>
            <div className={gridClassName}>
              {availableToAdd.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => addAction(action.id)}
                  className="relative flex flex-col items-center gap-2 rounded-xl border border-dashed p-4 text-left transition-colors hover:bg-muted/50"
                >
                  <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow">
                    <Plus className="h-3.5 w-3.5" />
                  </span>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${action.color} text-white opacity-80`}>
                    <action.icon className="h-5 w-5" />
                  </div>
                  <span className="text-center text-xs font-medium">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {editing && availableToAdd.length === 0 && (
          <p className="border-t pt-3 text-center text-xs text-muted-foreground">
            All available actions are already added
          </p>
        )}
      </CardContent>
    </Card>
  );
}
