"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Shield, Check, Plus, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { api } from "@/lib/api-client";
import { useAuth } from "@/context/auth-context";
import { formatRoleDisplayName } from "@/lib/role-utils";
import { toast } from "sonner";

function canManageRoles(user) {
  return user?.role === "admin" || user?.role === "super_admin";
}

const emptyForm = {
  displayName: "",
  permissionIds: [],
};

export default function RolesPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [roles, setRoles] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadRoles = useCallback(() => {
    setLoading(true);
    return api
      .roles()
      .then((data) => {
        setRoles(data.roles || []);
        setCanManage(data.canManage || false);
      })
      .catch((err) => toast.error(err.message || "Failed to load roles"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isLoading && user && !canManageRoles(user)) {
      router.replace("/dashboard");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user || !canManageRoles(user)) return;
    loadRoles();
    api
      .permissions()
      .then((data) => setAllPermissions(data.permissions || []))
      .catch((err) => toast.error(err.message || "Failed to load permissions"));
  }, [user, loadRoles]);

  const permissionsByModule = useMemo(() => {
    return allPermissions.reduce((acc, perm) => {
      if (!acc[perm.moduleName]) acc[perm.moduleName] = [];
      acc[perm.moduleName].push(perm);
      return acc;
    }, {});
  }, [allPermissions]);

  const openAddDialog = () => {
    setEditingRole(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEditDialog = (role) => {
    setEditingRole(role);
    setForm({
      displayName: formatRoleDisplayName(role.roleName),
      permissionIds: role.permissionDetails.map((p) => p.id),
    });
    setDialogOpen(true);
  };

  const togglePermission = (permissionId) => {
    setForm((prev) => {
      const has = prev.permissionIds.includes(permissionId);
      return {
        ...prev,
        permissionIds: has
          ? prev.permissionIds.filter((id) => id !== permissionId)
          : [...prev.permissionIds, permissionId],
      };
    });
  };

  const toggleModule = (modulePerms, checked) => {
    const ids = modulePerms.map((p) => p.id);
    setForm((prev) => {
      if (checked) {
        const merged = new Set([...prev.permissionIds, ...ids]);
        return { ...prev, permissionIds: [...merged] };
      }
      return {
        ...prev,
        permissionIds: prev.permissionIds.filter((id) => !ids.includes(id)),
      };
    });
  };

  const handleSave = async () => {
    const displayName = form.displayName.trim();
    if (!displayName) {
      toast.error("Role name is required.");
      return;
    }

    setSaving(true);
    try {
      if (editingRole) {
        await api.updateRole(editingRole.id, {
          displayName,
          permissionIds: form.permissionIds,
        });
        toast.success("Role updated successfully.");
      } else {
        await api.createRole({
          displayName,
          permissionIds: form.permissionIds,
        });
        toast.success("Role created successfully.");
      }
      setDialogOpen(false);
      loadRoles();
    } catch (err) {
      toast.error(err.message || "Failed to save role");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingRole) return;
    if (!window.confirm(`Delete role "${editingRole.name}"? This cannot be undone.`)) return;

    setSaving(true);
    try {
      await api.deleteRole(editingRole.id);
      toast.success("Role deleted.");
      setDialogOpen(false);
      loadRoles();
    } catch (err) {
      toast.error(err.message || "Failed to delete role");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !user || !canManageRoles(user)) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold lg:text-3xl">Roles & Permissions</h1>
          <p className="text-muted-foreground">
            Create roles and control which screens each role can access
          </p>
        </div>
        {canManage && (
          <Button onClick={openAddDialog}>
            <Plus className="h-4 w-4" /> Add Role
          </Button>
        )}
      </div>

      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl bg-muted/60" />
          ))}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {roles.map((role, i) => (
            <motion.div
              key={role.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="glass-card h-full overflow-hidden">
                <div className={`h-2 bg-gradient-to-r ${role.color}`} />
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-r ${role.color} text-white`}
                      >
                        <Shield className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-lg truncate">{role.name}</CardTitle>
                        <Badge variant="outline" className="mt-1 text-[10px]">
                          {role.roleName}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Badge variant="secondary">{role.permissionCount} perms</Badge>
                      {canManage && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditDialog(role)}
                          title="Edit role"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <CardDescription className="mt-2">
                    {role.userCount} employee{role.userCount !== 1 ? "s" : ""} · Updated{" "}
                    {new Date(role.lastUpdated).toLocaleDateString("en-IN")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Assigned Permissions
                  </p>
                  <ul className="space-y-2 max-h-64 overflow-y-auto">
                    {role.permissions.length === 0 ? (
                      <li className="text-sm text-muted-foreground">No permissions assigned</li>
                    ) : (
                      role.permissions.map((perm) => (
                        <li key={perm} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                          {perm}
                        </li>
                      ))
                    )}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRole ? `Edit Role — ${editingRole.name}` : "Add Role"}</DialogTitle>
            <DialogDescription>
              Set the role name and select which screens (permissions) this role can access.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="role-display-name">Role Name *</Label>
              <Input
                id="role-display-name"
                value={form.displayName}
                onChange={(e) => setForm((prev) => ({ ...prev, displayName: e.target.value }))}
                placeholder="e.g. Team Lead"
              />
              <p className="text-xs text-muted-foreground">
                Saved as system key (e.g. team_lead). Employees with this role get the selected access.
              </p>
            </div>

            <div className="space-y-3">
              <Label>Screen Access (Permissions)</Label>
              <div className="max-h-[50vh] space-y-4 overflow-y-auto rounded-lg border p-4">
                {Object.entries(permissionsByModule).map(([module, perms]) => {
                  const moduleIds = perms.map((p) => p.id);
                  const selectedCount = moduleIds.filter((id) => form.permissionIds.includes(id)).length;
                  const allSelected = selectedCount === perms.length;
                  const someSelected = selectedCount > 0 && !allSelected;

                  return (
                    <div key={module} className="space-y-2">
                      <div className="flex items-center gap-2 border-b pb-2">
                        <Checkbox
                          id={`module-${module}`}
                          checked={allSelected ? true : someSelected ? "indeterminate" : false}
                          onCheckedChange={(checked) => toggleModule(perms, Boolean(checked))}
                        />
                        <label
                          htmlFor={`module-${module}`}
                          className="cursor-pointer text-sm font-semibold"
                        >
                          {module}
                        </label>
                        <span className="text-xs text-muted-foreground">
                          ({selectedCount}/{perms.length})
                        </span>
                      </div>
                      <ul className="space-y-2 pl-6">
                        {perms.map((perm) => (
                          <li key={perm.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`perm-${perm.id}`}
                              checked={form.permissionIds.includes(perm.id)}
                              onCheckedChange={() => togglePermission(perm.id)}
                            />
                            <label htmlFor={`perm-${perm.id}`} className="cursor-pointer text-sm">
                              {perm.permissionName}
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {form.permissionIds.length} of {allPermissions.length} permissions selected
              </p>
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <div>
              {editingRole && !editingRole.isProtected && editingRole.userCount === 0 && (
                <Button type="button" variant="destructive" onClick={handleDelete} disabled={saving}>
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : editingRole ? "Update Role" : "Save Role"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
