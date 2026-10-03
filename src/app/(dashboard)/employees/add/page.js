"use client";

import { useState, useEffect, useRef, Suspense, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Upload, Save, ChevronRight, ChevronLeft, Camera, Eye } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { validateEmployeeCategory } from "@/lib/employee-category";
import {
  validateEmployeeForm,
  buildEmployeeApiPayload,
  mapCategoryErrorsToFields,
} from "@/lib/employee-validation";
import { isValidEmail } from "@/lib/auth-validation";
import { useAuth } from "@/context/auth-context";
import { useLookups } from "@/hooks/use-lookups";
import { DocumentUploadField } from "@/components/employees/document-upload-field";
import { FilePreviewDialog } from "@/components/employees/file-preview-dialog";
import { ImageCropDialog } from "@/components/employees/image-crop-dialog";
import { BankNameField } from "@/components/employees/bank-name-field";
import { validateUploadFile } from "@/lib/file-upload";

const sections = [
  { id: "personal", title: "Personal Information" },
  { id: "employment", title: "Employment Information" },
  { id: "category", title: "Education / Experience" },
  { id: "contact", title: "Contact Information" },
  { id: "documents", title: "Documents" },
];

const DOCUMENT_UPLOADS = [
  { label: "PAN Card", type: "PAN" },
  { label: "Aadhaar Card", type: "Aadhaar" },
  { label: "Bank Passbook", type: "Bank_Passbook" },
  { label: "Offer Letter", type: "Offer_Letter" },
];

const EXPERIENCE_DOC_UPLOADS = [
  { label: "Experience Letter", type: "Experience_Letter", key: "Experience_Letter" },
  { label: "Relieving Letter", type: "Relieving_Letter", key: "Relieving_Letter" },
  { label: "Payslip (Month 1)", type: "Payslip", key: "Payslip_1" },
  { label: "Payslip (Month 2)", type: "Payslip", key: "Payslip_2" },
  { label: "Payslip (Month 3)", type: "Payslip", key: "Payslip_3" },
];

function fieldClass(errors, field) {
  return errors[field] ? "border-destructive focus-visible:ring-destructive" : "";
}

function FieldError({ message }) {
  if (!message) return null;
  return <p className="text-xs text-destructive mt-1">{message}</p>;
}

function validationToastMessage(errors) {
  const keys = Object.keys(errors);
  if (!keys.length) return "Please fill the required fields.";
  if (keys.length > 1) return "Please fill the required fields.";
  return errors[keys[0]];
}

const emptyForm = {
  employeeCode: "", firstName: "", lastName: "", dob: "", gender: "",
  bloodGroup: "", motherName: "", fatherName: "", maritalStatus: "",
  spouseName: "", religion: "", nationality: "Indian",
  emergencyContact: "", departmentId: "", designationId: "", joiningDate: "",
  employmentType: "Full_Time", status: "Active", employeeCategory: "Fresher",
  roleId: "", reportingManagerId: "",
  qualification: "", specialization: "", skills: "",
  collegeName: "", graduationYear: "", cgpa: "", internshipDetails: "", certifications: "",
  totalExperienceYears: "", totalExperienceMonths: "", previousCompany: "", previousDesignation: "",
  previousCtc: "", expectedCtc: "", lastWorkingDate: "", noticePeriod: "", relevantExperience: "",
  mobile: "", alternateMobile: "", email: "",
  password: "", confirmPassword: "",
  address: "", temporaryAddress: "", pan: "", aadhaar: "", bankName: "", accountNumber: "", ifscCode: "",
};

function AddEmployeeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading, hasPermission } = useAuth();
  const editId = searchParams.get("edit");
  const isEditMode = Boolean(editId);

  useEffect(() => {
    if (!isLoading && user && !hasPermission("Employee Management")) {
      toast.error("You do not have permission to manage employees");
      router.replace("/dashboard");
    }
  }, [user, isLoading, hasPermission, router]);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [loadingEmployee, setLoadingEmployee] = useState(isEditMode);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [banks, setBanks] = useState([]);
  const { lookups } = useLookups();
  const [pendingFiles, setPendingFiles] = useState({});
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [profilePreview, setProfilePreview] = useState(null);
  const [profilePreviewOpen, setProfilePreviewOpen] = useState(false);
  const [profileCropOpen, setProfileCropOpen] = useState(false);
  const [profileCropSrc, setProfileCropSrc] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [codeLoading, setCodeLoading] = useState(false);
  const [existingDocs, setExistingDocs] = useState({});
  const photoInputRef = useRef(null);
  const photoCameraRef = useRef(null);

  const filteredDesignations = useMemo(() => {
    if (!form.departmentId) return [];
    return designations.filter((d) => String(d.departmentId) === String(form.departmentId));
  }, [designations, form.departmentId]);

  const fetchNextEmployeeCode = useCallback(async (designationId, departmentId) => {
    if (!designationId || !departmentId) return;
    setCodeLoading(true);
    try {
      const data = await api.employeeNextCode({
        designationId: String(designationId),
        departmentId: String(departmentId),
      });
      setForm((f) => ({ ...f, employeeCode: data.employeeCode || "" }));
    } catch (err) {
      toast.error(err.message || "Failed to generate employee ID");
    } finally {
      setCodeLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!lookups) return;
    setDepartments(lookups.departments || []);
    setDesignations(lookups.designations || []);
    setBanks(lookups.banks || []);
  }, [lookups]);

  useEffect(() => {
    if (!editId && form.designationId && form.departmentId) {
      fetchNextEmployeeCode(form.designationId, form.departmentId);
    }
  }, [form.designationId, form.departmentId, editId, fetchNextEmployeeCode]);

  useEffect(() => {
    if (!editId) return;
    setLoadingEmployee(true);
    api.employee(editId)
      .then((data) => {
        const emp = data.employee;
        if (!emp) throw new Error("Employee not found");
        setForm({
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
          nationality: emp.nationality || "Indian",
          emergencyContact: emp.emergencyContact || "",
          departmentId: emp.departmentId ? String(emp.departmentId) : "",
          designationId: emp.designationId ? String(emp.designationId) : "",
          joiningDate: emp.joiningDate || "",
          employmentType: emp.employmentTypeValue || "Full_Time",
          status: emp.statusValue || "Active",
          employeeCategory: emp.employeeCategory || "Fresher",
          roleId: emp.roleId ? String(emp.roleId) : "",
          reportingManagerId: emp.reportingManagerId ? String(emp.reportingManagerId) : "",
          qualification: emp.qualification || "",
          specialization: emp.specialization || "",
          skills: emp.skills || "",
          collegeName: emp.collegeName || "",
          graduationYear: emp.graduationYear ? String(emp.graduationYear) : "",
          cgpa: emp.cgpa || "",
          internshipDetails: emp.internshipDetails || "",
          certifications: emp.certifications || "",
          totalExperienceYears: emp.totalExperienceYears != null ? String(emp.totalExperienceYears) : "",
          totalExperienceMonths: emp.totalExperienceMonths != null ? String(emp.totalExperienceMonths) : "",
          previousCompany: emp.previousCompany || "",
          previousDesignation: emp.previousDesignation || "",
          previousCtc: emp.previousCtc != null ? String(emp.previousCtc) : "",
          expectedCtc: emp.expectedCtc != null ? String(emp.expectedCtc) : "",
          lastWorkingDate: emp.lastWorkingDate || "",
          noticePeriod: emp.noticePeriod || "",
          relevantExperience: emp.relevantExperience || "",
          mobile: emp.mobile || "",
          alternateMobile: emp.alternateMobile || "",
          email: emp.email || "",
          password: "",
          confirmPassword: "",
          address: emp.address || "",
          temporaryAddress: emp.temporaryAddress || "",
          pan: emp.pan || "",
          aadhaar: emp.aadhaar || "",
          bankName: emp.bankName || "",
          accountNumber: emp.accountNumber || "",
          ifscCode: emp.ifscCode || "",
        });
        if (emp.photo) setProfilePreview(emp.photo);
        const docsByType = {};
        (data.documents || []).forEach((doc) => {
          if (doc.documentType) docsByType[doc.documentType] = doc;
        });
        setExistingDocs(docsByType);
      })
      .catch((err) => {
        toast.error(err.message || "Failed to load employee");
        router.push("/employees");
      })
      .finally(() => setLoadingEmployee(false));
  }, [editId, router]);

  const activeSection = sections[step].id;
  const set = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validateFile = (file) => {
    const check = validateUploadFile(file, { allowPdf: true });
    if (!check.valid) {
      toast.error(check.message);
      return false;
    }
    return true;
  };

  const clearDocFieldError = (type) => {
    setFieldErrors((prev) => {
      const key = typeof type === "string" && type.startsWith("Payslip") ? null : `doc_${type}`;
      if (!key || !prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleDocFileSelect = (type, file) => {
    if (!file || !validateFile(file)) return;
    setPendingFiles((prev) => ({ ...prev, [type]: file }));
    clearDocFieldError(type);
  };

  const applyProfilePhotoFile = (file) => {
    if (!file) return;
    const check = validateUploadFile(file, { allowPdf: false });
    if (!check.valid) {
      toast.error(check.message);
      return;
    }
    setProfilePhoto(file);
    setProfilePreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const handlePhotoSelect = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    applyProfilePhotoFile(file);
  };

  const handleProfileCameraSelect = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const url = URL.createObjectURL(file);
    setProfileCropSrc(url);
    setProfileCropOpen(true);
  };

  const handleProfileCropClose = (open) => {
    if (!open && profileCropSrc?.startsWith("blob:")) URL.revokeObjectURL(profileCropSrc);
    if (!open) setProfileCropSrc(null);
    setProfileCropOpen(open);
  };

  const validateStep = (stepIndex) => {
    const errors = {};
    const add = (field, message) => { errors[field] = message; };

    if (stepIndex === 0) {
      if (isEditMode && !form.employeeCode?.trim()) {
        add("employeeCode", "Employee Code is required.");
      }
      if (!form.firstName?.trim()) add("firstName", "First Name is required.");
      if (!form.lastName?.trim()) add("lastName", "Last Name is required.");
    } else if (stepIndex === 1) {
      if (!form.departmentId) add("departmentId", "Department is required.");
      if (!form.designationId) add("designationId", "Designation is required.");
      if (!form.joiningDate) add("joiningDate", "Joining Date is required.");
      if (!form.employeeCategory) add("employeeCategory", "Employee Category is required.");
    } else if (stepIndex === 2) {
      const categoryCheck = validateEmployeeCategory(form);
      if (!categoryCheck.valid) {
        Object.assign(errors, mapCategoryErrorsToFields(categoryCheck.errors));
      }
    } else if (stepIndex === 3) {
      if (!form.mobile?.trim()) add("mobile", "Mobile is required.");
      if (!form.email?.trim()) add("email", "Email is required.");
      else if (!isValidEmail(form.email)) add("email", "Enter a valid email address.");
      if (!isEditMode) {
        if (!form.password || form.password.length < 6) {
          add("password", "Password is required (minimum 6 characters).");
        } else if (form.password !== form.confirmPassword) {
          add("confirmPassword", "Password and Confirm Password do not match.");
        }
      }
    }

    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      toast.error(validationToastMessage(errors));
      return false;
    }
    setFieldErrors({});
    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) setStep(step + 1);
  };

  const validateForm = () => {
    const validation = validateEmployeeForm(
      { ...form, confirmPassword: form.confirmPassword },
      { isEdit: isEditMode, checkConfirmPassword: true, autoEmployeeCode: !isEditMode }
    );
    const errors = { ...validation.fieldErrors };

    const categoryCheck = validateEmployeeCategory(form);
    if (!categoryCheck.valid) {
      Object.assign(errors, mapCategoryErrorsToFields(categoryCheck.errors));
    }

    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      const firstKey = Object.keys(errors)[0];
      const stepMap = {
        employeeCode: 0, firstName: 0, lastName: 0,
        departmentId: 1, designationId: 1, joiningDate: 1, employeeCategory: 1,
        qualification: 2, collegeName: 2, graduationYear: 2,
        totalExperienceYears: 2, totalExperienceMonths: 2,
        previousCompany: 2, previousDesignation: 2, previousCtc: 2,
        mobile: 3, email: 3, password: 3, confirmPassword: 3,
        pan: 4, aadhaar: 4, bankName: 4, accountNumber: 4, ifscCode: 4,
      };
      const errorStep = stepMap[firstKey] ?? 0;
      setStep(errorStep);
      toast.error(validationToastMessage(errors));
      return false;
    }

    setFieldErrors({});
    return true;
  };

  const handleApiError = (err) => {
    if (err.fields) {
      setFieldErrors(err.fields);
      toast.error(err.message || "Please fill the required fields.");
      return;
    }
    if (err.field) {
      setFieldErrors({ [err.field]: err.message });
    }
    toast.error(err.message || "Request failed");
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    let employeeId = editId;
    let employeeCreated = false;

    try {
      const payload = buildEmployeeApiPayload(form, { isEdit: isEditMode });

      if (isEditMode) {
        await api.updateEmployee(editId, payload);
      } else {
        const { employee } = await api.createEmployee(payload);
        employeeId = employee?.id;
        employeeCreated = Boolean(employeeId);
        if (!employeeId) {
          throw new Error("Employee was saved but no employee ID was returned.");
        }
      }

      const uploadFailures = [];

      if (employeeId) {
        for (const doc of DOCUMENT_UPLOADS) {
          const file = pendingFiles[doc.type];
          if (!file) continue;
          try {
            await api.uploadEmployeeDocument(employeeId, doc.type, file);
          } catch (uploadErr) {
            uploadFailures.push(`${doc.label}: ${uploadErr.message}`);
          }
        }

        if (form.employeeCategory === "Experienced") {
          for (const doc of EXPERIENCE_DOC_UPLOADS) {
            const file = pendingFiles[doc.key];
            if (!file) continue;
            try {
              await api.uploadEmployeeDocument(employeeId, doc.type, file);
            } catch (uploadErr) {
              uploadFailures.push(`${doc.label}: ${uploadErr.message}`);
            }
          }
        }

        if (profilePhoto) {
          try {
            await api.uploadEmployeePhoto(employeeId, profilePhoto);
          } catch (uploadErr) {
            uploadFailures.push(`Profile photo: ${uploadErr.message}`);
          }
        }
      }

      if (uploadFailures.length) {
        toast.warning(
          `Employee ${isEditMode ? "updated" : "created"}, but some uploads failed: ${uploadFailures.join("; ")}`
        );
      } else {
        toast.success(isEditMode ? "Employee updated successfully." : "Employee created successfully.");
      }

      if (isEditMode) {
        setPendingFiles({});
        setProfilePhoto(null);
        try {
          const data = await api.employee(editId);
          if (data.employee?.photo) setProfilePreview(data.employee.photo);
          const docsByType = {};
          (data.documents || []).forEach((doc) => {
            if (doc.documentType) docsByType[doc.documentType] = doc;
          });
          setExistingDocs(docsByType);
        } catch {
          /* stay on page even if refresh fails */
        }
        return;
      }

      router.push("/employees");
    } catch (err) {
      if (employeeCreated) {
        toast.error(
          `${err.message || "Save failed after employee was created."} Check the employee list and try uploading documents again.`
        );
        router.push("/employees");
        return;
      }
      handleApiError(err);
    } finally {
      setSaving(false);
    }
  };

  if (loadingEmployee) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-champagne border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/employees">
          <Button variant="ghost" size="icon" type="button" title={isEditMode ? "Back to employees list" : "Cancel"}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold lg:text-3xl">{isEditMode ? "Edit Employee" : "Add Employee"}</h1>
          <p className="text-muted-foreground">
            {isEditMode ? "Update employee record" : "Create a new employee record"}
          </p>
        </div>
        {isEditMode && (
          <Button variant="premium" type="button" onClick={handleSave} disabled={saving} className="shrink-0">
            {saving ? (
              "Saving..."
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save
              </>
            )}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="lg:hidden">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {sections.map((section, i) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setStep(i)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-medium transition-colors ${
                  step === i
                    ? "bg-champagne text-white"
                    : "border bg-background text-muted-foreground"
                }`}
              >
                {i + 1}. {section.title}
              </button>
            ))}
          </div>
        </div>

        <div className="hidden lg:block lg:w-64 shrink-0">
          <Card className="glass-card lg:sticky lg:top-20">
            <CardContent className="space-y-1 p-3">
              {sections.map((section, i) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setStep(i)}
                  className={`w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                    step === i ? "bg-champagne/10 font-medium text-champagne" : "text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  {section.title}
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="flex-1 space-y-6">
          {activeSection === "personal" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>Basic employee information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
                    <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-muted-foreground/30 bg-muted/30">
                      {profilePreview ? (
                        <img src={profilePreview} alt="Profile preview" className="h-full w-full object-cover" />
                      ) : (
                        <Upload className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/jpeg,image/jpg,image/png"
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
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" type="button" onClick={() => photoCameraRef.current?.click()}>
                          <Camera className="mr-1 h-3 w-3" />
                          Camera
                        </Button>
                        <Button variant="outline" size="sm" type="button" onClick={() => photoInputRef.current?.click()}>
                          <Upload className="mr-1 h-3 w-3" />
                          Upload File
                        </Button>
                        {profilePreview && (
                          <Button variant="outline" size="sm" type="button" onClick={() => setProfilePreviewOpen(true)}>
                            <Eye className="mr-1 h-3 w-3" />
                            View
                          </Button>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {profilePhoto ? profilePhoto.name : "JPG, PNG. Max 5MB. Camera opens phone camera directly."}
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Employee ID {isEditMode ? "*" : "(auto-generated)"}</Label>
                      <Input
                        className={fieldClass(fieldErrors, "employeeCode")}
                        placeholder={codeLoading ? "Generating..." : "Select department & designation"}
                        value={form.employeeCode}
                        readOnly={!isEditMode}
                        onChange={(e) => isEditMode && set("employeeCode", e.target.value)}
                      />
                      <FieldError message={fieldErrors.employeeCode} />
                      <p className="text-xs text-muted-foreground">
                        Format: VLJ-{'{code}'}-{'{sequence}'} — assigned automatically when you save
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>First Name *</Label>
                      <Input className={fieldClass(fieldErrors, "firstName")} value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
                      <FieldError message={fieldErrors.firstName} />
                    </div>
                    <div className="space-y-2">
                      <Label>Last Name *</Label>
                      <Input className={fieldClass(fieldErrors, "lastName")} value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
                      <FieldError message={fieldErrors.lastName} />
                    </div>
                    <div className="space-y-2">
                      <Label>Date of Birth</Label>
                      <Input type="date" value={form.dob} onChange={(e) => set("dob", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Gender</Label>
                      <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {(lookups?.genders || []).map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Blood Group</Label>
                      <Select value={form.bloodGroup} onValueChange={(v) => set("bloodGroup", v)}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {(lookups?.bloodGroups || []).map((bg) => (
                            <SelectItem key={bg.value} value={bg.value}>{bg.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Father&apos;s Name</Label>
                      <Input value={form.fatherName} onChange={(e) => set("fatherName", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Mother&apos;s Name</Label>
                      <Input value={form.motherName} onChange={(e) => set("motherName", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Marriage Status</Label>
                      <Select value={form.maritalStatus || undefined} onValueChange={(v) => set("maritalStatus", v)}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {(lookups?.maritalStatuses || []).map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {form.maritalStatus === "Married" && (
                      <div className="space-y-2">
                        <Label>Spouse Name</Label>
                        <Input value={form.spouseName} onChange={(e) => set("spouseName", e.target.value)} />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Religion</Label>
                      <Select value={form.religion || undefined} onValueChange={(v) => set("religion", v)}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {(lookups?.religions || []).map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Nationality</Label>
                      <Select value={form.nationality || undefined} onValueChange={(v) => set("nationality", v)}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {(lookups?.nationalities || []).map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Emergency Contact</Label>
                      <Input value={form.emergencyContact} onChange={(e) => set("emergencyContact", e.target.value)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeSection === "employment" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Employment Information</CardTitle>
                  <CardDescription>Job and role information</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Department *</Label>
                    <Select
                      value={form.departmentId}
                      onValueChange={(v) => {
                        set("departmentId", v);
                        setForm((f) => ({ ...f, departmentId: v, designationId: "", employeeCode: "" }));
                      }}
                    >
                      <SelectTrigger className={fieldClass(fieldErrors, "departmentId")}><SelectValue placeholder="Select Department" /></SelectTrigger>
                      <SelectContent>
                        {departments.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.departmentName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FieldError message={fieldErrors.departmentId} />
                  </div>
                  <div className="space-y-2">
                    <Label>Designation *</Label>
                    <Select
                      value={form.designationId}
                      onValueChange={(v) => {
                        set("designationId", v);
                        if (!isEditMode) {
                          setForm((f) => ({ ...f, designationId: v, employeeCode: "" }));
                        }
                      }}
                      disabled={!form.departmentId}
                    >
                      <SelectTrigger className={fieldClass(fieldErrors, "designationId")}><SelectValue placeholder={form.departmentId ? "Select Designation" : "Select department first"} /></SelectTrigger>
                      <SelectContent>
                        {filteredDesignations.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.designationName} ({d.designationCode})</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FieldError message={fieldErrors.designationId} />
                  </div>
                  <div className="space-y-2">
                    <Label>Joining Date *</Label>
                    <Input className={fieldClass(fieldErrors, "joiningDate")} type="date" value={form.joiningDate} onChange={(e) => set("joiningDate", e.target.value)} />
                    <FieldError message={fieldErrors.joiningDate} />
                  </div>
                  <div className="space-y-2">
                    <Label>Employment Type</Label>
                    <Select value={form.employmentType} onValueChange={(v) => set("employmentType", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(lookups?.employmentTypes || []).map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => set("status", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(lookups?.employeeStatuses || []).map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={form.roleId || "none"} onValueChange={(v) => set("roleId", v === "none" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Default: Employee" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Default (Employee)</SelectItem>
                        {(lookups?.roles || []).map((r) => (
                          <SelectItem key={r.id} value={String(r.id)}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Reporting Manager</Label>
                    <Select
                      value={form.reportingManagerId || "none"}
                      onValueChange={(v) => set("reportingManagerId", v === "none" ? "" : v)}
                    >
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {(lookups?.managers || []).map((m) => (
                          <SelectItem key={m.id} value={String(m.id)}>
                            {m.fullName} ({m.employeeCode})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3 sm:col-span-2">
                    <Label>Employee Category *</Label>
                    <div className="flex flex-wrap gap-6">
                      {(lookups?.employeeCategories || []).map((cat) => (
                        <label
                          key={cat.value}
                          className="flex cursor-pointer items-center gap-2 text-sm font-medium"
                        >
                          <input
                            type="radio"
                            name="employeeCategory"
                            value={cat.value}
                            checked={form.employeeCategory === cat.value}
                            onChange={() => set("employeeCategory", cat.value)}
                            className="h-4 w-4 accent-champagne"
                          />
                          {cat.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeSection === "category" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Education Details</CardTitle>
                  <CardDescription>Academic background</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Highest Qualification *</Label>
                    <Input
                      className={fieldClass(fieldErrors, "qualification")}
                      value={form.qualification}
                      onChange={(e) => set("qualification", e.target.value)}
                      placeholder="e.g. B.Tech"
                    />
                    <FieldError message={fieldErrors.qualification} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>College / University *</Label>
                    <Input
                      className={fieldClass(fieldErrors, "collegeName")}
                      value={form.collegeName}
                      onChange={(e) => set("collegeName", e.target.value)}
                    />
                    <FieldError message={fieldErrors.collegeName} />
                  </div>
                  <div className="space-y-2">
                    <Label>Specialization</Label>
                    <Input value={form.specialization} onChange={(e) => set("specialization", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Graduation Year *</Label>
                    <Input
                      className={fieldClass(fieldErrors, "graduationYear")}
                      type="number"
                      min="1950"
                      max="2100"
                      value={form.graduationYear}
                      onChange={(e) => set("graduationYear", e.target.value)}
                      placeholder="e.g. 2024"
                    />
                    <FieldError message={fieldErrors.graduationYear} />
                  </div>
                  <div className="space-y-2">
                    <Label>Percentage / CGPA</Label>
                    <Input value={form.cgpa} onChange={(e) => set("cgpa", e.target.value)} placeholder="e.g. 8.5 or 75%" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Internship Experience (Optional)</Label>
                    <Textarea rows={2} value={form.internshipDetails} onChange={(e) => set("internshipDetails", e.target.value)} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Skills</Label>
                    <Textarea rows={2} value={form.skills} onChange={(e) => set("skills", e.target.value)} placeholder="e.g. JavaScript, React" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Certifications (Optional)</Label>
                    <Textarea rows={2} value={form.certifications} onChange={(e) => set("certifications", e.target.value)} />
                  </div>
                </CardContent>
              </Card>

              {form.employeeCategory === "Experienced" && (
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle>Experience Details</CardTitle>
                    <CardDescription>Previous employment history</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Total Experience (Years) *</Label>
                      <Input
                        className={fieldClass(fieldErrors, "totalExperienceYears")}
                        type="number"
                        min="0"
                        value={form.totalExperienceYears}
                        onChange={(e) => set("totalExperienceYears", e.target.value)}
                      />
                      <FieldError message={fieldErrors.totalExperienceYears} />
                    </div>
                    <div className="space-y-2">
                      <Label>Total Experience (Months) *</Label>
                      <Input
                        className={fieldClass(fieldErrors, "totalExperienceMonths")}
                        type="number"
                        min="0"
                        max="11"
                        value={form.totalExperienceMonths}
                        onChange={(e) => set("totalExperienceMonths", e.target.value)}
                      />
                      <FieldError message={fieldErrors.totalExperienceMonths} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Previous Company Name *</Label>
                      <Input
                        className={fieldClass(fieldErrors, "previousCompany")}
                        value={form.previousCompany}
                        onChange={(e) => set("previousCompany", e.target.value)}
                      />
                      <FieldError message={fieldErrors.previousCompany} />
                    </div>
                    <div className="space-y-2">
                      <Label>Previous Designation *</Label>
                      <Input
                        className={fieldClass(fieldErrors, "previousDesignation")}
                        value={form.previousDesignation}
                        onChange={(e) => set("previousDesignation", e.target.value)}
                      />
                      <FieldError message={fieldErrors.previousDesignation} />
                    </div>
                    <div className="space-y-2">
                      <Label>Previous CTC *</Label>
                      <Input
                        className={fieldClass(fieldErrors, "previousCtc")}
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.previousCtc}
                        onChange={(e) => set("previousCtc", e.target.value)}
                      />
                      <FieldError message={fieldErrors.previousCtc} />
                    </div>
                    <div className="space-y-2">
                      <Label>Expected CTC</Label>
                      <Input type="number" min="0" step="0.01" value={form.expectedCtc} onChange={(e) => set("expectedCtc", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Last Working Date</Label>
                      <Input type="date" value={form.lastWorkingDate} onChange={(e) => set("lastWorkingDate", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Notice Period</Label>
                      <Input value={form.noticePeriod} onChange={(e) => set("noticePeriod", e.target.value)} placeholder="e.g. 30 days" />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Relevant Experience</Label>
                      <Textarea rows={2} value={form.relevantExperience} onChange={(e) => set("relevantExperience", e.target.value)} />
                    </div>
                    <div className="space-y-4 sm:col-span-2">
                      <Label>Previous Employment Documents</Label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {EXPERIENCE_DOC_UPLOADS.map((doc) => (
                          <DocumentUploadField
                            key={doc.key}
                            label={doc.label}
                            pendingFile={pendingFiles[doc.key]}
                            onFileSelect={(file) => handleDocFileSelect(doc.key, file)}
                            compact
                          />
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}

          {activeSection === "contact" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Contact Information</CardTitle>
                  <CardDescription>Communication information</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Mobile *</Label>
                    <Input
                      className={fieldClass(fieldErrors, "mobile")}
                      inputMode="numeric"
                      maxLength={10}
                      value={form.mobile}
                      onChange={(e) => set("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))}
                    />
                    <FieldError message={fieldErrors.mobile} />
                  </div>
                  <div className="space-y-2">
                    <Label>Alternate Mobile</Label>
                    <Input
                      className={fieldClass(fieldErrors, "alternateMobile")}
                      inputMode="numeric"
                      maxLength={10}
                      value={form.alternateMobile}
                      onChange={(e) => set("alternateMobile", e.target.value.replace(/\D/g, "").slice(0, 10))}
                    />
                    <FieldError message={fieldErrors.alternateMobile} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Email *</Label>
                    <Input className={fieldClass(fieldErrors, "email")} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
                    <FieldError message={fieldErrors.email} />
                  </div>
                  <div className="space-y-2">
                    <Label>{isEditMode ? "New Password (optional)" : "Password *"}</Label>
                    <Input
                      className={fieldClass(fieldErrors, "password")}
                      type="password"
                      placeholder={isEditMode ? "Leave blank to keep current password" : "Login password (min 6 characters)"}
                      value={form.password}
                      onChange={(e) => set("password", e.target.value)}
                    />
                    <FieldError message={fieldErrors.password} />
                  </div>
                  <div className="space-y-2">
                    <Label>{isEditMode ? "Confirm New Password" : "Confirm Password *"}</Label>
                    <Input
                      className={fieldClass(fieldErrors, "confirmPassword")}
                      type="password"
                      placeholder="Re-enter password"
                      value={form.confirmPassword}
                      onChange={(e) => set("confirmPassword", e.target.value)}
                    />
                    <FieldError message={fieldErrors.confirmPassword} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Permanent Address</Label>
                    <Textarea
                      rows={3}
                      value={form.address}
                      onChange={(e) => set("address", e.target.value)}
                      placeholder="Permanent residential address"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Temporary Address</Label>
                    <Textarea
                      rows={3}
                      value={form.temporaryAddress}
                      onChange={(e) => set("temporaryAddress", e.target.value)}
                      placeholder="Current / temporary address"
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeSection === "documents" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Documents</CardTitle>
                  <CardDescription>Identity and bank documents</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>PAN Number *</Label>
                      <Input
                        className={fieldClass(fieldErrors, "pan")}
                        maxLength={10}
                        value={form.pan}
                        onChange={(e) => set("pan", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))}
                      />
                      <FieldError message={fieldErrors.pan} />
                    </div>
                    <div className="space-y-2">
                      <Label>Aadhaar Number *</Label>
                      <Input
                        className={fieldClass(fieldErrors, "aadhaar")}
                        inputMode="numeric"
                        maxLength={12}
                        value={form.aadhaar}
                        onChange={(e) => set("aadhaar", e.target.value.replace(/\D/g, "").slice(0, 12))}
                      />
                      <FieldError message={fieldErrors.aadhaar} />
                    </div>
                    <BankNameField
                      value={form.bankName}
                      onChange={(v) => set("bankName", v)}
                      banks={banks}
                      onBanksChange={setBanks}
                      error={fieldErrors.bankName}
                      required
                    />
                    <div className="space-y-2">
                      <Label>IFSC Code *</Label>
                      <Input
                        className={fieldClass(fieldErrors, "ifscCode")}
                        maxLength={11}
                        value={form.ifscCode}
                        onChange={(e) => set("ifscCode", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11))}
                      />
                      <FieldError message={fieldErrors.ifscCode} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Account Number *</Label>
                      <Input
                        className={fieldClass(fieldErrors, "accountNumber")}
                        value={form.accountNumber}
                        onChange={(e) => set("accountNumber", e.target.value.replace(/\s/g, ""))}
                      />
                      <FieldError message={fieldErrors.accountNumber} />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {DOCUMENT_UPLOADS.map((doc) => (
                      <DocumentUploadField
                        key={doc.type}
                        label={doc.label}
                        pendingFile={pendingFiles[doc.type]}
                        existingDoc={existingDocs[doc.type]}
                        onFileSelect={(file) => handleDocFileSelect(doc.type, file)}
                        error={fieldErrors[`doc_${doc.type}`]}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row">
              {!isEditMode && (
                <Link href="/employees" className="w-full sm:w-auto">
                  <Button variant="outline" className="w-full sm:w-auto">Cancel</Button>
                </Link>
              )}
              {step > 0 && (
                <Button variant="outline" className="w-full sm:w-auto" onClick={() => setStep(step - 1)}>
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
              )}
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              {isEditMode && (
                <Button
                  variant="premium"
                  className="w-full sm:w-auto"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    "Saving..."
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save
                    </>
                  )}
                </Button>
              )}
              {step < sections.length - 1 ? (
                <Button variant={isEditMode ? "outline" : "premium"} className="w-full sm:w-auto" onClick={handleNext}>
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              ) : !isEditMode ? (
                <Button variant="premium" className="w-full sm:w-auto" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Employee
                    </>
                  )}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <ImageCropDialog
        open={profileCropOpen}
        onOpenChange={handleProfileCropClose}
        imageSrc={profileCropSrc}
        title="Profile Photo"
        onConfirm={applyProfilePhotoFile}
      />
      <FilePreviewDialog
        open={profilePreviewOpen}
        onOpenChange={setProfilePreviewOpen}
        title="Profile Photo"
        url={profilePreview}
        fileName={profilePhoto?.name || "Profile photo"}
      />
    </div>
  );
}

export default function AddEmployeePage() {
  return (
    <Suspense fallback={
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-champagne border-t-transparent" />
      </div>
    }>
      <AddEmployeeContent />
    </Suspense>
  );
}
