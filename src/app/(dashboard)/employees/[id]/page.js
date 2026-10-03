"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Mail,
  Phone,
  Building,
  Calendar,
  FileText,
  Download,
  Save,
  Upload,
  Camera,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { useAuth } from "@/context/auth-context";
import { useLookups } from "@/hooks/use-lookups";
import { FilePreviewDialog } from "@/components/employees/file-preview-dialog";
import { ImageCropDialog } from "@/components/employees/image-crop-dialog";
import { BankNameField } from "@/components/employees/bank-name-field";
import { validateUploadFile } from "@/lib/file-upload";


function toEditForm(emp) {
  if (!emp) return {};
  return {
    employeeCode: emp.employeeCode || "",
    firstName: emp.firstName || "",
    lastName: emp.lastName || "",
    dob: emp.dob || "",
    gender: emp.gender || "",
    bloodGroup: emp.bloodGroup || "",
    motherName: emp.motherName || "",
    fatherName: emp.fatherName || "",
    maritalStatus: emp.maritalStatus || "",
    spouseName: emp.spouseName || "",
    religion: emp.religion || "",
    nationality: emp.nationality || "",
    mobile: emp.mobile || "",
    alternateMobile: emp.alternateMobile || "",
    email: emp.email || "",
    address: emp.address || "",
    temporaryAddress: emp.temporaryAddress || "",
    emergencyContact: emp.emergencyContact || "",
    departmentId: emp.departmentId ? String(emp.departmentId) : "",
    designationId: emp.designationId ? String(emp.designationId) : "",
    roleId: emp.roleId ? String(emp.roleId) : "",
    reportingManagerId: emp.reportingManagerId ? String(emp.reportingManagerId) : "none",
    joiningDate: emp.joiningDate || "",
    employmentType: emp.employmentTypeValue || "Full_Time",
    status: emp.statusValue || "Active",
    pan: emp.pan || "",
    aadhaar: emp.aadhaar || "",
    bankName: emp.bankName || "",
    accountNumber: emp.accountNumber || "",
    ifscCode: emp.ifscCode || "",
    skills: emp.skills || "",
  };
}

function DocLink({ label, url }) {
  if (!url) return <DetailRow label={label} value="" />;
  return (
    <div className="flex justify-between gap-4 border-b pb-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-sm font-medium text-champagne hover:underline"
      >
        <Download className="h-3.5 w-3.5" /> View / Download
      </a>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b pb-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%] break-words">{value || "—"}</span>
    </div>
  );
}

function EditField({ label, children, className = "" }) {
  return (
    <div className={`space-y-2 ${className}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export default function EmployeeProfilePage() {
  const params = useParams();
  const { user, hasPermission } = useAuth();
  const photoInputRef = useRef(null);
  const photoCameraRef = useRef(null);

  const [employee, setEmployee] = useState(null);
  const [lookups, setLookups] = useState(null);
  const { lookups: formLookups } = useLookups();
  const [canEdit, setCanEdit] = useState(false);
  const [editScope, setEditScope] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [docPreview, setDocPreview] = useState({ open: false, url: null, title: "", fileName: "" });
  const [banks, setBanks] = useState([]);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [photoPreviewOpen, setPhotoPreviewOpen] = useState(false);
  const [photoCropOpen, setPhotoCropOpen] = useState(false);
  const [photoCropSrc, setPhotoCropSrc] = useState(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",  
  });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const isFullEdit = editScope === "full";
  const isOwnProfile = user?.id === Number(params.id);
  const backHref = hasPermission("Employee Management") ? "/employees" : "/dashboard";

  const set = (field, value) => setEditForm((f) => ({ ...f, [field]: value }));

  const filteredDesignations = useMemo(() => {
    if (!editForm.departmentId) return [];
    return (lookups?.designations || []).filter(
      (d) => String(d.departmentId) === String(editForm.departmentId)
    );
  }, [lookups?.designations, editForm.departmentId]);

  const setPassword = (field, value) => {
    setPasswordForm((f) => ({ ...f, [field]: value }));
    setPasswordErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const resetPasswordForm = () => {
    setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setPasswordErrors({});
    setShowPasswords({ current: false, new: false, confirm: false });
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordErrors({});

    if (!passwordForm.currentPassword.trim()) {
      setPasswordErrors({ currentPassword: "Current password is required" });
      return;
    }
    if (!passwordForm.newPassword.trim() || passwordForm.newPassword.length < 6) {
      setPasswordErrors({ newPassword: "New password must be at least 6 characters" });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordErrors({ confirmPassword: "Passwords do not match" });
      return;
    }

    setChangingPassword(true);
    try {
      await api.changePassword(passwordForm);
      resetPasswordForm();
      toast.success("Password changed successfully.");
    } catch (err) {
      if (err.field) {
        setPasswordErrors({ [err.field]: err.message });
      }
      toast.error(err.message || "Failed to change password");
    }
    setChangingPassword(false);
  };

  const loadProfile = () => {
    return api.employee(params.id).then((data) => {
      setEmployee(data.employee);
      setLookups(data.lookups || null);
      setCanEdit(Boolean(data.canEdit));
      setEditScope(data.editScope || null);
      setAttendance(data.attendance || []);
      setLeaves(data.leaves || []);
      setDocuments(data.documents || []);
      setEditForm(toEditForm(data.employee));
      setBanks(data.lookups?.banks || formLookups?.banks || []);
      setPhotoPreview(data.employee?.photo || null);
      setPendingPhoto(null);
    });
  };

  useEffect(() => {
    if (formLookups?.banks?.length && !banks.length) {
      setBanks(formLookups.banks);
    }
  }, [formLookups, banks.length]);

  useEffect(() => {
    loadProfile().catch(() => {});
  }, [params.id]);

  const applyPendingPhoto = (file) => {
    if (!file) return;
    const check = validateUploadFile(file, { allowPdf: false });
    if (!check.valid) {
      toast.error(check.message);
      return;
    }
    setPendingPhoto(file);
    setPhotoPreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    applyPendingPhoto(file);
  };

  const handleProfileCameraSelect = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPhotoCropSrc(url);
    setPhotoCropOpen(true);
  };

  const handlePhotoCropClose = (open) => {
    if (!open && photoCropSrc?.startsWith("blob:")) URL.revokeObjectURL(photoCropSrc);
    if (!open) setPhotoCropSrc(null);
    setPhotoCropOpen(open);
  };

  const handleCancel = () => {
    setEditForm(toEditForm(employee));
    setPhotoPreview(employee?.photo || null);
    setPendingPhoto(null);
    setEditing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (pendingPhoto) {
        await api.uploadEmployeePhoto(params.id, pendingPhoto);
      }

      const payload = {
        ...editForm,
        reportingManagerId:
          editForm.reportingManagerId === "none" ? null : editForm.reportingManagerId,
      };

      const { employee: updated } = await api.updateEmployee(params.id, payload);
      setEmployee(updated);
      setEditForm(toEditForm(updated));
      setPhotoPreview(updated.photo);
      setPendingPhoto(null);
      setEditing(false);

      const data = await api.employee(params.id);
      setLookups(data.lookups || null);

      if (isOwnProfile) {
        try {
          const { user: freshUser } = await api.me();
          localStorage.setItem("emp_user", JSON.stringify(freshUser));
        } catch {
          /* ignore */
        }
      }

      toast.success("Employee updated successfully.");
    } catch (err) {
      toast.error(err.message);
    }
    setSaving(false);
  };

  if (!employee) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-champagne border-t-transparent" />
      </div>
    );
  }

  const statusColor =
    employee.status === "Active"
      ? "success"
      : employee.status === "On Leave"
        ? "warning"
        : employee.status?.includes("Hold")
          ? "warning"
          : "secondary";

  const displayPhoto = photoPreview || employee.photo;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={backHref}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold">{isOwnProfile ? "My Profile" : "Employee Profile"}</h1>
          <p className="text-muted-foreground">Employee ID: {employee.employeeCode}</p>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="glass-card overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-espresso to-champagne" />
          <CardContent className="relative px-4 pb-6 sm:px-6">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:flex-wrap">
              <div className="relative -mt-12 shrink-0">
                <Image
                  src={displayPhoto}
                  alt={employee.name}
                  width={96}
                  height={96}
                  className="rounded-2xl border-4 border-background shadow-lg object-cover"
                  unoptimized
                />
                {editing && (
                  <div className="mt-2 flex flex-col gap-1">
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/jpeg,image/png"
                      className="hidden"
                      onChange={handlePhotoSelect}
                    />
                    <input
                      ref={photoCameraRef}
                      type="file"
                      accept="image/*"
                      capture="user"
                      className="hidden"
                      onChange={handleProfileCameraSelect}
                    />
                    <div className="flex flex-wrap gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => photoCameraRef.current?.click()}
                      >
                        <Camera className="h-3.5 w-3.5" />
                        Camera
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                      >
                        <Upload className="h-3.5 w-3.5" />
                        Upload
                      </Button>
                      {displayPhoto && (
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          onClick={() => setPhotoPreviewOpen(true)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Button>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground text-center">JPG/PNG, max 5MB</p>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-bold break-words">
                    {editing
                      ? `${editForm.firstName || ""} ${editForm.lastName || ""}`.trim() || employee.name
                      : employee.name}
                  </h2>
                  <Badge variant={statusColor}>
                    {editing && isFullEdit
                      ? String(editForm.status || "").replace("_", " ")
                      : employee.status}
                  </Badge>
                </div>
                <p className="text-muted-foreground">
                  {employee.designation} · {employee.department}
                </p>
              </div>
              {canEdit && (
                editing ? (
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    <Button variant="outline" className="w-full sm:w-auto" onClick={handleCancel}>
                      Cancel
                    </Button>
                    <Button variant="premium" className="w-full sm:w-auto" onClick={handleSave} disabled={saving}>
                      <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save"}
                    </Button>
                  </div>
                ) : (
                  <Button variant="premium" className="w-full sm:w-auto" onClick={() => setEditing(true)}>
                    <Upload className="h-4 w-4" /> Edit Profile
                  </Button>
                )
              )}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: Mail, label: "Email", value: editing ? editForm.email : employee.email },
                { icon: Phone, label: "Mobile", value: editing ? editForm.mobile : employee.mobile },
                { icon: Building, label: "Department", value: employee.department },
                {
                  icon: Calendar,
                  label: "Joined",
                  value: editing && isFullEdit && editForm.joiningDate
                    ? formatDate(editForm.joiningDate)
                    : formatDate(employee.joiningDate),
                },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3 rounded-lg border p-3">
                  <item.icon className="h-4 w-4 shrink-0 text-champagne" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground">{item.label}</p>
                    <p className="text-sm font-medium truncate">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="glass-card w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="leaves">Leaves</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-card">
              <CardHeader><CardTitle>Personal Details</CardTitle></CardHeader>
              <CardContent className={editing ? "grid gap-4 sm:grid-cols-2" : "space-y-3"}>
                {editing ? (
                  <>
                    <EditField label="First Name">
                      <Input value={editForm.firstName} onChange={(e) => set("firstName", e.target.value)} />
                    </EditField>
                    <EditField label="Last Name">
                      <Input value={editForm.lastName} onChange={(e) => set("lastName", e.target.value)} />
                    </EditField>
                    <EditField label="Date of Birth">
                      <Input type="date" value={editForm.dob} onChange={(e) => set("dob", e.target.value)} />
                    </EditField>
                    <EditField label="Gender">
                      <Select value={editForm.gender || ""} onValueChange={(v) => set("gender", v)}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {(formLookups?.genders || []).map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </EditField>
                    <EditField label="Blood Group">
                      <Select value={editForm.bloodGroup || ""} onValueChange={(v) => set("bloodGroup", v)}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {(formLookups?.bloodGroups || []).map((bg) => (
                            <SelectItem key={bg.value} value={bg.value}>{bg.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </EditField>
                    <EditField label="Father's Name">
                      <Input value={editForm.fatherName || ""} onChange={(e) => set("fatherName", e.target.value)} />
                    </EditField>
                    <EditField label="Mother's Name">
                      <Input value={editForm.motherName || ""} onChange={(e) => set("motherName", e.target.value)} />
                    </EditField>
                    <EditField label="Marriage Status">
                      <Select
                        value={editForm.maritalStatus || undefined}
                        onValueChange={(v) => set("maritalStatus", v)}
                      >
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {(lookups?.maritalStatuses || formLookups?.maritalStatuses || []).map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </EditField>
                    {editForm.maritalStatus === "Married" && (
                      <EditField label="Spouse Name">
                        <Input value={editForm.spouseName || ""} onChange={(e) => set("spouseName", e.target.value)} />
                      </EditField>
                    )}
                    <EditField label="Religion">
                      <Select value={editForm.religion || undefined} onValueChange={(v) => set("religion", v)}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {(formLookups?.religions || []).map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </EditField>
                    <EditField label="Nationality">
                      <Select value={editForm.nationality || undefined} onValueChange={(v) => set("nationality", v)}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {(formLookups?.nationalities || []).map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </EditField>
                    <EditField label="Emergency Contact">
                      <Input
                        value={editForm.emergencyContact}
                        onChange={(e) => set("emergencyContact", e.target.value)}
                      />
                    </EditField>
                    <EditField label="Mobile" className="sm:col-span-2">
                      <Input value={editForm.mobile} onChange={(e) => set("mobile", e.target.value)} />
                    </EditField>
                    <EditField label="Alternate Mobile" className="sm:col-span-2">
                      <Input
                        value={editForm.alternateMobile}
                        onChange={(e) => set("alternateMobile", e.target.value)}
                      />
                    </EditField>
                    <EditField label="Email" className="sm:col-span-2">
                      <Input type="email" value={editForm.email} onChange={(e) => set("email", e.target.value)} />
                    </EditField>
                    <EditField label="Permanent Address" className="sm:col-span-2">
                      <Textarea
                        value={editForm.address}
                        onChange={(e) => set("address", e.target.value)}
                        rows={3}
                      />
                    </EditField>
                    <EditField label="Temporary Address" className="sm:col-span-2">
                      <Textarea
                        value={editForm.temporaryAddress || ""}
                        onChange={(e) => set("temporaryAddress", e.target.value)}
                        rows={3}
                      />
                    </EditField>
                    {!isFullEdit && (
                      <EditField label="Skills" className="sm:col-span-2">
                        <Textarea
                          value={editForm.skills}
                          onChange={(e) => set("skills", e.target.value)}
                          rows={2}
                        />
                      </EditField>
                    )}
                  </>
                ) : (
                  <>
                    <DetailRow label="First Name" value={employee.firstName} />
                    <DetailRow label="Last Name" value={employee.lastName} />
                    <DetailRow label="Date of Birth" value={employee.dob ? formatDate(employee.dob) : ""} />
                    <DetailRow label="Gender" value={employee.gender} />
                    <DetailRow label="Blood Group" value={employee.bloodGroup} />
                    <DetailRow label="Father's Name" value={employee.fatherName} />
                    <DetailRow label="Mother's Name" value={employee.motherName} />
                    <DetailRow label="Marriage Status" value={employee.maritalStatus} />
                    {employee.maritalStatus === "Married" && (
                      <DetailRow label="Spouse Name" value={employee.spouseName} />
                    )}
                    <DetailRow label="Religion" value={employee.religion} />
                    <DetailRow label="Nationality" value={employee.nationality} />
                    <DetailRow label="Mobile" value={employee.mobile} />
                    <DetailRow label="Alternate Mobile" value={employee.alternateMobile} />
                    <DetailRow label="Email" value={employee.email} />
                    <DetailRow label="Emergency Contact" value={employee.emergencyContact} />
                    <DetailRow label="Permanent Address" value={employee.address} />
                    <DetailRow label="Temporary Address" value={employee.temporaryAddress} />
                    {employee.skills && <DetailRow label="Skills" value={employee.skills} />}
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader><CardTitle>Employment Details</CardTitle></CardHeader>
              <CardContent className={editing && isFullEdit ? "grid gap-4 sm:grid-cols-2" : "space-y-3"}>
                {editing && isFullEdit ? (
                  <>
                    <EditField label="Employee ID" className="sm:col-span-2">
                      <Input value={editForm.employeeCode} readOnly className="bg-muted" />
                      <p className="mt-1 text-xs text-muted-foreground">
                        ID updates automatically if designation changes on save
                      </p>
                    </EditField>
                    <EditField label="Department">
                      <Select
                        value={editForm.departmentId}
                        onValueChange={(v) => {
                          setEditForm((f) => ({
                            ...f,
                            departmentId: v,
                            designationId: "",
                          }));
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {(lookups?.departments || []).map((d) => (
                            <SelectItem key={d.id} value={String(d.id)}>{d.departmentName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </EditField>
                    <EditField label="Designation">
                      <Select
                        value={editForm.designationId}
                        onValueChange={(v) => set("designationId", v)}
                        disabled={!editForm.departmentId}
                      >
                        <SelectTrigger><SelectValue placeholder={editForm.departmentId ? "Select" : "Select department first"} /></SelectTrigger>
                        <SelectContent>
                          {filteredDesignations.map((d) => (
                            <SelectItem key={d.id} value={String(d.id)}>
                              {d.designationName} ({d.designationCode})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </EditField>
                    <EditField label="Role">
                      <Select value={editForm.roleId} onValueChange={(v) => set("roleId", v)}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {(lookups?.roles || []).map((r) => (
                            <SelectItem key={r.id} value={String(r.id)}>{r.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </EditField>
                    <EditField label="Reporting Manager">
                      <Select
                        value={editForm.reportingManagerId}
                        onValueChange={(v) => set("reportingManagerId", v)}
                      >
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {(lookups?.managers || []).map((m) => (
                            <SelectItem key={m.id} value={String(m.id)}>
                              {m.fullName} ({m.employeeCode})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </EditField>
                    <EditField label="Joining Date">
                      <Input
                        type="date"
                        value={editForm.joiningDate}
                        onChange={(e) => set("joiningDate", e.target.value)}
                      />
                    </EditField>
                    <EditField label="Employment Type">
                      <Select value={editForm.employmentType} onValueChange={(v) => set("employmentType", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(formLookups?.employmentTypes || []).map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </EditField>
                    <EditField label="Status" className="sm:col-span-2">
                      <Select value={editForm.status} onValueChange={(v) => set("status", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(formLookups?.employeeStatuses || []).map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </EditField>
                  </>
                ) : (
                  <>
                    <DetailRow label="Employee ID" value={employee.employeeCode} />
                    <DetailRow label="Department" value={employee.department} />
                    <DetailRow label="Designation" value={employee.designation} />
                    <DetailRow label="Role" value={employee.roleName} />
                    <DetailRow label="Reporting Manager" value={employee.reportingManager} />
                    <DetailRow
                      label="Joining Date"
                      value={employee.joiningDate ? formatDate(employee.joiningDate) : ""}
                    />
                    <DetailRow label="Employment Type" value={employee.employmentType} />
                    <DetailRow label="Employment Status" value={employee.employmentStatus} />
                    <DetailRow label="Current Status" value={employee.status} />
                    <DetailRow label="Employee Category" value={employee.employeeCategory} />
                  </>
                )}
              </CardContent>
            </Card>

            {!editing && (
              <Card className="glass-card">
                <CardHeader><CardTitle>Education</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <DetailRow label="Highest Qualification" value={employee.qualification} />
                  <DetailRow label="College / University" value={employee.collegeName} />
                  <DetailRow label="Specialization" value={employee.specialization} />
                  <DetailRow label="Graduation Year" value={employee.graduationYear} />
                  <DetailRow label="Percentage / CGPA" value={employee.cgpa} />
                  <DetailRow label="Internship Experience" value={employee.internshipDetails} />
                  <DetailRow label="Skills" value={employee.skills} />
                  <DetailRow label="Certifications" value={employee.certifications} />
                </CardContent>
              </Card>
            )}

            {employee.employeeCategory === "Experienced" && !editing && (
              <Card className="glass-card">
                <CardHeader><CardTitle>Experience History</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <DetailRow label="Total Experience" value={employee.experienceSummary} />
                  <DetailRow label="Previous Company" value={employee.previousCompany} />
                  <DetailRow label="Previous Designation" value={employee.previousDesignation} />
                  <DetailRow label="Previous CTC" value={employee.previousCtc != null ? `₹${employee.previousCtc}` : ""} />
                  <DetailRow label="Expected CTC" value={employee.expectedCtc != null ? `₹${employee.expectedCtc}` : ""} />
                  <DetailRow
                    label="Last Working Date"
                    value={employee.lastWorkingDate ? formatDate(employee.lastWorkingDate) : ""}
                  />
                  <DetailRow label="Notice Period" value={employee.noticePeriod} />
                  <DetailRow label="Relevant Experience" value={employee.relevantExperience} />
                  <DocLink label="Experience Letter" url={employee.experienceLetterUrl} />
                  <DocLink label="Relieving Letter" url={employee.relievingLetterUrl} />
                  {(employee.payslipUrls || []).map((url, i) => (
                    <DocLink key={url} label={`Payslip ${i + 1}`} url={url} />
                  ))}
                </CardContent>
              </Card>
            )}

            <Card className="glass-card lg:col-span-2">
              <CardHeader><CardTitle>Bank Details</CardTitle></CardHeader>
              <CardContent className={editing ? "grid gap-4 sm:grid-cols-2" : "space-y-3"}>
                {editing ? (
                  <>
                    <BankNameField
                      value={editForm.bankName}
                      onChange={(v) => set("bankName", v)}
                      banks={banks.length ? banks : formLookups?.banks || []}
                      onBanksChange={setBanks}
                    />
                    <EditField label="IFSC Code">
                      <Input
                        maxLength={11}
                        value={editForm.ifscCode}
                        onChange={(e) => set("ifscCode", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11))}
                      />
                    </EditField>
                    <EditField label="Account Number">
                      <Input
                        value={editForm.accountNumber}
                        onChange={(e) => set("accountNumber", e.target.value)}
                      />
                    </EditField>
                    {isFullEdit && (
                      <>
                        <EditField label="PAN">
                          <Input value={editForm.pan} onChange={(e) => set("pan", e.target.value)} />
                        </EditField>
                        <EditField label="Aadhaar">
                          <Input value={editForm.aadhaar} onChange={(e) => set("aadhaar", e.target.value)} />
                        </EditField>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <DetailRow label="Bank Name" value={employee.bankName} />
                    <DetailRow label="IFSC Code" value={employee.ifscCode} />
                    <DetailRow label="Account Number" value={employee.accountNumber} />
                    {isFullEdit && (
                      <>
                        <DetailRow label="PAN" value={employee.pan} />
                        <DetailRow label="Aadhaar" value={employee.aadhaar} />
                      </>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {isOwnProfile && (
              <Card className="glass-card lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-champagne" />
                    Change Password
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleChangePassword} className="grid max-w-xl gap-4 sm:grid-cols-2">
                    {[
                      { key: "currentPassword", label: "Current Password", showKey: "current" },
                      { key: "newPassword", label: "New Password", showKey: "new" },
                      { key: "confirmPassword", label: "Confirm New Password", showKey: "confirm" },
                    ].map(({ key, label, showKey }) => (
                      <EditField key={key} label={label} className={key === "confirmPassword" ? "sm:col-span-2" : ""}>
                        <div className="relative">
                          <Input
                            type={showPasswords[showKey] ? "text" : "password"}
                            value={passwordForm[key]}
                            onChange={(e) => setPassword(key, e.target.value)}
                            autoComplete={key === "currentPassword" ? "current-password" : "new-password"}
                            className={passwordErrors[key] ? "border-destructive" : ""}
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            onClick={() =>
                              setShowPasswords((prev) => ({ ...prev, [showKey]: !prev[showKey] }))
                            }
                            aria-label={showPasswords[showKey] ? "Hide password" : "Show password"}
                          >
                            {showPasswords[showKey] ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        {passwordErrors[key] && (
                          <p className="text-xs text-destructive">{passwordErrors[key]}</p>
                        )}
                      </EditField>
                    ))}
                    <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row">
                      <Button type="submit" variant="premium" disabled={changingPassword}>
                        {changingPassword ? "Updating..." : "Update Password"}
                      </Button>
                      <Button type="button" variant="outline" onClick={resetPasswordForm} disabled={changingPassword}>
                        Clear
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="attendance">
          <Card className="glass-card">
            <CardHeader><CardTitle>Recent Attendance</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">In Time</th>
                      <th className="px-4 py-3 text-left">Out Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((record) => (
                      <tr key={record.date} className="border-b">
                        <td className="px-4 py-3">{formatDate(record.date)}</td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              record.status === "Present"
                                ? "success"
                                : record.status === "Late"
                                  ? "warning"
                                  : "destructive"
                            }
                          >
                            {record.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">{record.inTime}</td>
                        <td className="px-4 py-3">{record.outTime}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leaves">
          <Card className="glass-card">
            <CardHeader><CardTitle>Leave History</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {leaves.map((leave, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">{leave.type}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(leave.from)} - {formatDate(leave.to)} ({leave.days} days)
                      </p>
                    </div>
                    <Badge variant="success">{leave.status}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card className="glass-card">
            <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                {(documents.length
                  ? documents
                  : [
                      { name: "PAN Card", fileName: employee.pan || "Not uploaded" },
                      { name: "Aadhaar Card", fileName: employee.aadhaar || "Not uploaded" },
                      {
                        name: "Bank Details",
                        fileName: `${employee.bankName || ""} - ${employee.accountNumber || ""}`,
                      },
                    ]
                ).map((doc) => (
                  <div key={doc.name} className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-8 w-8 shrink-0 text-champagne" />
                      <div className="min-w-0">
                        <p className="font-medium">{doc.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{doc.fileName || doc.id}</p>
                      </div>
                    </div>
                    {doc.url ? (
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          title="View"
                          onClick={() =>
                            setDocPreview({
                              open: true,
                              url: doc.url,
                              title: doc.name,
                              fileName: doc.fileName || doc.name,
                            })
                          }
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <a href={doc.url} target="_blank" rel="noopener noreferrer" download>
                          <Button variant="ghost" size="icon" type="button" title="Download">
                            <Download className="h-4 w-4" />
                          </Button>
                        </a>
                      </div>
                    ) : (
                      <Button variant="ghost" size="icon" disabled>
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <FilePreviewDialog
        open={docPreview.open}
        onOpenChange={(open) => setDocPreview((prev) => ({ ...prev, open }))}
        title={docPreview.title}
        url={docPreview.url}
        fileName={docPreview.fileName}
      />
      <FilePreviewDialog
        open={photoPreviewOpen}
        onOpenChange={setPhotoPreviewOpen}
        title="Profile Photo"
        url={displayPhoto}
        fileName={pendingPhoto?.name || "Profile photo"}
      />
      <ImageCropDialog
        open={photoCropOpen}
        onOpenChange={handlePhotoCropClose}
        imageSrc={photoCropSrc}
        title="Profile Photo"
        onConfirm={applyPendingPhoto}
      />
    </div>
  );
}
