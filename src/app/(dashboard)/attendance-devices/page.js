"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Fingerprint, Plus, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const blankDevice = { name: "", provider: "KENT", externalDeviceId: "", location: "" };

export default function AttendanceDevicesPage() {
  const { user, hasPermission } = useAuth();
  const canManage = hasPermission("Employee Management") || user?.permissions?.includes("Full System Access") || user?.permissions?.includes("All Permissions");
  const canView = canManage || hasPermission("Attendance Monitoring");
  const [devices, setDevices] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [mappings, setMappings] = useState([]);
  const [events, setEvents] = useState([]);
  const [deviceForm, setDeviceForm] = useState(blankDevice);
  const [mappingForm, setMappingForm] = useState({ employeeId: "", deviceEmployeeId: "" });
  const [loading, setLoading] = useState(true);
  const [savingDevice, setSavingDevice] = useState(false);
  const [savingMapping, setSavingMapping] = useState(false);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/attendance-devices?includeInactive=true");
      setDevices(data.devices || []);
      setSelectedId((current) => current || String(data.devices?.[0]?.id || ""));
    } catch (error) {
      toast.error(error.message || "Could not load attendance devices");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetails = useCallback(async (id) => {
    if (!id) { setMappings([]); setEvents([]); return; }
    try {
      const [mappingData, eventData] = await Promise.all([
        apiFetch(`/attendance-devices/${id}/mappings`),
        apiFetch(`/attendance-devices/${id}/events?limit=100`),
      ]);
      setMappings(mappingData.mappings || []);
      setEvents(eventData.events || []);
    } catch (error) {
      toast.error(error.message || "Could not load device details");
    }
  }, []);

  useEffect(() => { loadDevices(); }, [loadDevices]);
  useEffect(() => {
    if (!canManage) return;
    apiFetch("/employees?limit=500&status=Active")
      .then((data) => setEmployees(data.employees || []))
      .catch((error) => toast.error(error.message || "Could not load employees"));
  }, [canManage]);
  useEffect(() => { loadDetails(selectedId); }, [selectedId, loadDetails]);

  async function createDevice(event) {
    event.preventDefault();
    setSavingDevice(true);
    try {
      const data = await apiFetch("/attendance-devices", {
        method: "POST",
        body: JSON.stringify(deviceForm),
      });
      toast.success("Attendance device registered");
      setDeviceForm(blankDevice);
      await loadDevices();
      setSelectedId(String(data.device.id));
    } catch (error) {
      toast.error(error.message || "Could not register device");
    } finally { setSavingDevice(false); }
  }

  async function createMapping(event) {
    event.preventDefault();
    if (!selectedId) return;
    setSavingMapping(true);
    try {
      await apiFetch(`/attendance-devices/${selectedId}/mappings`, {
        method: "POST",
        body: JSON.stringify({ employeeId: Number(mappingForm.employeeId), deviceEmployeeId: mappingForm.deviceEmployeeId }),
      });
      toast.success("Employee mapping saved");
      setMappingForm({ employeeId: "", deviceEmployeeId: "" });
      await loadDetails(selectedId);
    } catch (error) {
      toast.error(error.message || "Could not save mapping");
    } finally { setSavingMapping(false); }
  }

  async function toggleMapping(mapping) {
    try {
      await apiFetch(`/attendance-devices/${selectedId}/mappings/${mapping.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !mapping.isActive }),
      });
      toast.success(mapping.isActive ? "Mapping deactivated" : "Mapping activated");
      await loadDetails(selectedId);
    } catch (error) { toast.error(error.message || "Could not update mapping"); }
  }

  async function toggleDevice(device) {
    try {
      await apiFetch(`/attendance-devices/${device.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !device.isActive }),
      });
      toast.success(device.isActive ? "Device deactivated" : "Device activated");
      await loadDevices();
    } catch (error) { toast.error(error.message || "Could not update device"); }
  }

  if (!canView) return <div className="p-6 text-sm text-muted-foreground">You do not have permission to view attendance devices.</div>;

  const selectedDevice = devices.find((device) => String(device.id) === selectedId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><Fingerprint className="h-6 w-6 text-champagne" /><h1 className="font-display text-2xl font-bold lg:text-3xl">Attendance Devices</h1></div>
          <p className="mt-1 text-sm text-muted-foreground">Connect biometric and face-attendance devices without changing HRMS employee codes.</p>
        </div>
        <Button variant="outline" onClick={() => { loadDevices(); loadDetails(selectedId); }} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
      </div>

      {canManage && <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-4 w-4" />Register a device</CardTitle><CardDescription>Register each physical device once. Provider names are normalized to uppercase.</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={createDevice} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input placeholder="Device name (e.g. Main Gate)" value={deviceForm.name} onChange={(e) => setDeviceForm({ ...deviceForm, name: e.target.value })} required maxLength={100} />
            <Input placeholder="Provider (e.g. KENT)" value={deviceForm.provider} onChange={(e) => setDeviceForm({ ...deviceForm, provider: e.target.value })} required maxLength={50} />
            <Input placeholder="External device ID" value={deviceForm.externalDeviceId} onChange={(e) => setDeviceForm({ ...deviceForm, externalDeviceId: e.target.value })} maxLength={191} />
            <div className="flex gap-2"><Input placeholder="Location (optional)" value={deviceForm.location} onChange={(e) => setDeviceForm({ ...deviceForm, location: e.target.value })} maxLength={150} /><Button type="submit" disabled={savingDevice}>{savingDevice ? "Saving..." : "Add"}</Button></div>
          </form>
        </CardContent>
      </Card>}

      <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.6fr)]">
        <Card>
          <CardHeader><CardTitle>Registered devices</CardTitle><CardDescription>{devices.length} device(s)</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {loading ? <p className="text-sm text-muted-foreground">Loading devices…</p> : devices.length === 0 ? <p className="text-sm text-muted-foreground">No devices registered yet.</p> : devices.map((device) => (
              <button key={device.id} type="button" onClick={() => setSelectedId(String(device.id))} className={`w-full rounded-lg border p-3 text-left transition-colors ${selectedId === String(device.id) ? "border-champagne bg-champagne/10" : "hover:bg-muted/50"}`}>
                <div className="flex items-start justify-between gap-2"><span className="font-medium">{device.name}</span><Badge variant={device.isActive ? "success" : "secondary"}>{device.isActive ? "Active" : "Inactive"}</Badge></div>
                <div className="mt-1 text-xs text-muted-foreground">{device.provider} · ID: {device.externalDeviceId || "not set"}</div>
                <div className="mt-1 text-xs text-muted-foreground">{device.location || "Location not set"} · {device._count?.employeeMappings ?? 0} mappings · {device._count?.events ?? 0} events</div>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {selectedDevice ? <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3"><div><CardTitle>{selectedDevice.name}</CardTitle><CardDescription>Employee ID mapping for {selectedDevice.provider}</CardDescription></div>{canManage && <Button size="sm" variant="outline" onClick={() => toggleDevice(selectedDevice)}><Unplug className="mr-2 h-4 w-4" />{selectedDevice.isActive ? "Deactivate" : "Activate"}</Button>}</div>
            </CardHeader>
            <CardContent className="space-y-4">
              {canManage && <form onSubmit={createMapping} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <select className="h-10 rounded-md border bg-background px-3 text-sm" value={mappingForm.employeeId} onChange={(e) => setMappingForm({ ...mappingForm, employeeId: e.target.value })} required>
                  <option value="">Select HRMS employee</option>
                  {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeCode} — {employee.fullName}</option>)}
                </select>
                <Input placeholder="Device employee ID (e.g. VLJ001)" value={mappingForm.deviceEmployeeId} onChange={(e) => setMappingForm({ ...mappingForm, deviceEmployeeId: e.target.value })} maxLength={191} required />
                <Button type="submit" disabled={savingMapping || !selectedDevice.isActive}>{savingMapping ? "Saving..." : "Map employee"}</Button>
              </form>}
              <div className="overflow-x-auto">
                <table className="w-full text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="py-2 pr-3">HRMS employee</th><th className="py-2 pr-3">Device ID</th><th className="py-2 pr-3">Status</th>{canManage && <th className="py-2 text-right">Action</th>}</tr></thead>
                  <tbody>{mappings.map((mapping) => <tr key={mapping.id} className="border-b last:border-0"><td className="py-3 pr-3"><div className="font-medium">{mapping.employee.fullName}</div><div className="text-xs text-muted-foreground">{mapping.employee.employeeCode} · {mapping.employee.department?.departmentName || "No department"}</div></td><td className="py-3 pr-3">{mapping.deviceEmployeeId}</td><td className="py-3 pr-3"><Badge variant={mapping.isActive ? "success" : "secondary"}>{mapping.isActive ? "Active" : "Inactive"}</Badge></td>{canManage && <td className="py-3 text-right"><Button size="sm" variant="ghost" onClick={() => toggleMapping(mapping)}>{mapping.isActive ? "Deactivate" : "Activate"}</Button></td>}</tr>)}</tbody>
                </table>
                {mappings.length === 0 && <p className="py-5 text-center text-sm text-muted-foreground">No employee mappings yet.</p>}
              </div>
            </CardContent>
          </Card> : <Card><CardContent className="p-6 text-sm text-muted-foreground">Select a device to manage its employee mappings.</CardContent></Card>}

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4" />Incoming events</CardTitle><CardDescription><ShieldCheck className="mr-1 inline h-3.5 w-3.5" />Events are stored for review; attendance is not auto-marked until punch semantics are verified.</CardDescription></CardHeader>
            <CardContent>
              <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="py-2 pr-3">Device employee ID</th><th className="py-2 pr-3">Event time</th><th className="py-2 pr-3">Type</th><th className="py-2">Status</th></tr></thead>
                <tbody>{events.map((event) => <tr key={event.id} className="border-b last:border-0"><td className="py-3 pr-3">{event.deviceEmployeeId}</td><td className="py-3 pr-3 whitespace-nowrap">{new Date(event.occurredAt).toLocaleString("en-IN")}</td><td className="py-3 pr-3">{event.eventType || "—"}</td><td className="py-3"><Badge variant={event.processingStatus === "UnmatchedEmployee" || event.processingStatus === "UnknownPerson" ? "destructive" : "secondary"}>{event.processingStatus}</Badge>{event.errorMessage && <div className="mt-1 max-w-xs text-xs text-muted-foreground">{event.errorMessage}</div>}</td></tr>)}</tbody>
              </table>{events.length === 0 && <p className="py-5 text-center text-sm text-muted-foreground">No incoming events yet.</p>}</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
