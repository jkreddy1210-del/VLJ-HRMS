import { formatExperienceSummary } from "@/lib/employee-category";
import { computeDisplayStatus, formatDbStatus } from "@/lib/employee-status";
import { profilePhotoToDataUri, resolveEmployeePhoto } from "@/lib/profile-photo";

function parsePayslipUrls(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function mapEmployee(emp, onLeaveIds = null) {
  const payslipUrls = parsePayslipUrls(emp.payslipUrls);
  const isOnLeaveToday = onLeaveIds ? onLeaveIds.has(emp.id) : false;
  const displayStatus = computeDisplayStatus(emp.status, isOnLeaveToday);
  const profile_photo = profilePhotoToDataUri(emp.profilePhoto);

  return {
    id: String(emp.id),
    employeeCode: emp.employeeCode,
    firstName: emp.firstName,
    lastName: emp.lastName,
    name: emp.fullName,
    profile_photo,
    photo: resolveEmployeePhoto(emp),
    dob: emp.dob?.toISOString().split("T")[0],
    gender: emp.gender,
    bloodGroup: emp.bloodGroup,
    motherName: emp.motherName,
    fatherName: emp.fatherName,
    maritalStatus: emp.maritalStatus,
    spouseName: emp.spouseName,
    religion: emp.religion,
    nationality: emp.nationality,
    mobile: emp.mobile,
    alternateMobile: emp.alternateMobile,
    email: emp.email,
    address: emp.address,
    temporaryAddress: emp.temporaryAddress,
    department: emp.department?.departmentName,
    departmentId: emp.departmentId,
    designation: emp.designation?.designationName,
    designationId: emp.designationId,
    reportingManager: emp.reportingManager?.fullName || null,
    reportingManagerId: emp.reportingManagerId,
    roleId: emp.roleId,
    roleName: emp.role?.roleName?.replace("_", " "),
    joiningDate: emp.joiningDate?.toISOString().split("T")[0],
    employmentType: emp.employmentType?.replace("_", " "),
    employmentTypeValue: emp.employmentType,
    status: displayStatus,
    statusValue: emp.status,
    employmentStatus: formatDbStatus(emp.status),
    isOnLeaveToday,
    emergencyContact: emp.emergencyContact,
    bankName: emp.bankName,
    accountNumber: emp.accountNumber,
    ifscCode: emp.ifscCode,
    pan: emp.pan,
    aadhaar: emp.aadhaar,
    employeeCategory: emp.employeeCategory,
    experienceSummary: formatExperienceSummary(emp),
    qualification: emp.qualification,
    specialization: emp.specialization,
    skills: emp.skills,
    collegeName: emp.collegeName,
    graduationYear: emp.graduationYear,
    cgpa: emp.cgpa,
    internshipDetails: emp.internshipDetails,
    certifications: emp.certifications,
    totalExperienceYears: emp.totalExperienceYears,
    totalExperienceMonths: emp.totalExperienceMonths,
    previousCompany: emp.previousCompany,
    previousDesignation: emp.previousDesignation,
    previousCtc: emp.previousCtc != null ? Number(emp.previousCtc) : null,
    expectedCtc: emp.expectedCtc != null ? Number(emp.expectedCtc) : null,
    lastWorkingDate: emp.lastWorkingDate?.toISOString().split("T")[0] || null,
    noticePeriod: emp.noticePeriod,
    relevantExperience: emp.relevantExperience,
    experienceLetterUrl: emp.experienceLetterUrl,
    relievingLetterUrl: emp.relievingLetterUrl,
    payslipUrls,
  };
}
