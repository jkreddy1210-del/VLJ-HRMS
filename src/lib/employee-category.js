import { EMPLOYEE_CATEGORIES } from "@/lib/lookups";

const VALID_CATEGORIES = EMPLOYEE_CATEGORIES.map((c) => c.value);

const FRESHER_NULL_FIELDS = {
  totalExperienceYears: null,
  totalExperienceMonths: null,
  previousCompany: null,
  previousDesignation: null,
  previousCtc: null,
  expectedCtc: null,
  lastWorkingDate: null,
  noticePeriod: null,
  relevantExperience: null,
  experienceLetterUrl: null,
  relievingLetterUrl: null,
  payslipUrls: null,
};

function parseDecimal(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function parseIntOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = parseInt(value, 10);
  return Number.isNaN(num) ? null : num;
}

function validateEducationFields(body, errors) {
  if (!body.qualification?.trim()) {
    errors.push("Highest Qualification is required.");
  }
  if (!body.collegeName?.trim()) {
    errors.push("College / University is required.");
  }
  if (!body.graduationYear) {
    errors.push("Graduation Year is required.");
  } else {
    const year = parseInt(body.graduationYear, 10);
    if (Number.isNaN(year) || year < 1950 || year > new Date().getFullYear() + 1) {
      errors.push("Enter a valid Graduation Year (1950 to current year).");
    }
  }
}

export function validateEmployeeCategory(body) {
  const category = body.employeeCategory;
  const errors = [];

  if (!category) {
    errors.push("Employee Category is required");
    return { valid: false, errors };
  }
  if (!VALID_CATEGORIES.includes(category)) {
    errors.push("Invalid Employee Category");
    return { valid: false, errors };
  }

  validateEducationFields(body, errors);

  if (category === "Experienced") {
    const years = parseIntOrNull(body.totalExperienceYears);
    const months = parseIntOrNull(body.totalExperienceMonths);
    if (years === null && months === null) {
      errors.push("Total Experience (Years or Months) is required");
    }
    if (months !== null && (months < 0 || months > 11)) {
      errors.push("Experience months must be between 0 and 11");
    }
    if (!body.previousCompany?.trim()) errors.push("Previous Company Name is required");
    if (!body.previousDesignation?.trim()) errors.push("Previous Designation is required");
    const prevCtc = parseDecimal(body.previousCtc);
    if (prevCtc === null) errors.push("Previous CTC is required");
  }

  return { valid: errors.length === 0, errors };
}

export function buildCategoryData(body) {
  const category = body.employeeCategory;
  const education = {
    qualification: body.qualification?.trim() || null,
    specialization: body.specialization?.trim() || null,
    skills: body.skills?.trim() || null,
    collegeName: body.collegeName?.trim() || null,
    graduationYear: parseIntOrNull(body.graduationYear),
    cgpa: body.cgpa?.trim() || null,
    internshipDetails: body.internshipDetails?.trim() || null,
    certifications: body.certifications?.trim() || null,
  };

  if (category === "Fresher") {
    return {
      employeeCategory: category,
      ...education,
      ...FRESHER_NULL_FIELDS,
    };
  }

  return {
    employeeCategory: category,
    ...education,
    totalExperienceYears: parseIntOrNull(body.totalExperienceYears) ?? 0,
    totalExperienceMonths: parseIntOrNull(body.totalExperienceMonths) ?? 0,
    previousCompany: body.previousCompany?.trim() || null,
    previousDesignation: body.previousDesignation?.trim() || null,
    previousCtc: parseDecimal(body.previousCtc),
    expectedCtc: parseDecimal(body.expectedCtc),
    lastWorkingDate: body.lastWorkingDate ? new Date(body.lastWorkingDate) : null,
    noticePeriod: body.noticePeriod?.trim() || null,
    relevantExperience: body.relevantExperience?.trim() || null,
    experienceLetterUrl: body.experienceLetterUrl || null,
    relievingLetterUrl: body.relievingLetterUrl || null,
    payslipUrls: body.payslipUrls || null,
  };
}

export function formatExperienceSummary(emp) {
  if (emp.employeeCategory === "Fresher") return "Fresher";
  const y = emp.totalExperienceYears ?? 0;
  const m = emp.totalExperienceMonths ?? 0;
  if (!y && !m) return "—";
  const parts = [];
  if (y) parts.push(`${y}y`);
  if (m) parts.push(`${m}m`);
  return parts.join(" ");
}
