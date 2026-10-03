import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  canManageEmployees,
  hasFullAccess,
  forbiddenResponse,
} from "@/lib/auth-server";
import { profilePhotoToDataUri } from "@/lib/profile-photo";
import { mapEmployeeDocument } from "@/lib/document-mapper";

const ALLOWED_TYPES = [
  "PAN",
  "Aadhaar",
  "Bank_Passbook",
  "Offer_Letter",
  "Agreement",
  "Experience_Letter",
  "Relieving_Letter",
  "Payslip",
  "Other",
];
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
const PHOTO_MIME = ["image/jpeg", "image/jpg", "image/png"];

function canUploadDocument(user, employeeId, documentType) {
  if (canManageEmployees(user) || hasFullAccess(user)) return true;
  const isOwn = user.id === employeeId || user.employeeId === employeeId;
  if (!isOwn || !user.permissions?.includes("Edit Profile")) return false;
  return documentType === "Other";
}

export async function POST(request, { params }) {
  const { user, error } = await requireAuth(request);
  if (error) return error;

  const employeeId = parseInt(params.id, 10);
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) {
    return Response.json({ error: "Employee not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const documentType = String(formData.get("documentType") || "");

  if (!canUploadDocument(user, employeeId, documentType)) {
    return forbiddenResponse();
  }

  if (!file || typeof file === "string") {
    return Response.json({ error: "File is required" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(documentType)) {
    return Response.json({ error: "Invalid document type" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return Response.json({ error: "File must be under 5MB" }, { status: 400 });
  }

  const isPhotoUpload = documentType === "Other";
  if (isPhotoUpload && !PHOTO_MIME.includes(file.type)) {
    return Response.json({ error: "Profile photo must be JPG or PNG" }, { status: 400 });
  }
  if (!isPhotoUpload && !ALLOWED_MIME.includes(file.type)) {
    return Response.json({ error: "Only JPG, PNG, and PDF files are allowed" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (isPhotoUpload) {
    const updated = await prisma.employee.update({
      where: { id: employeeId },
      data: {
        profilePhoto: buffer,
        updatedBy: user.id,
      },
    });

    const profile_photo = profilePhotoToDataUri(updated.profilePhoto, file.type);

    return Response.json({
      document: {
        name: "Other",
        fileName: file.name,
        url: profile_photo,
      },
      profile_photo,
    });
  }

  const docData = {
    fileName: file.name,
    mimeType: file.type,
    fileData: buffer,
    filePath: null,
    updatedBy: user.id,
  };

  let doc;
  if (documentType === "Payslip") {
    const payslipCount = await prisma.employeeDocument.count({
      where: { employeeId, documentType: "Payslip" },
    });
    if (payslipCount >= 3) {
      const oldest = await prisma.employeeDocument.findFirst({
        where: { employeeId, documentType: "Payslip" },
        orderBy: { uploadedAt: "asc" },
      });
      if (oldest) {
        await prisma.employeeDocument.delete({ where: { id: oldest.id } });
      }
    }
    doc = await prisma.employeeDocument.create({
      data: {
        employeeId,
        documentType,
        ...docData,
        createdBy: user.id,
      },
    });
  } else {
    const existing = await prisma.employeeDocument.findFirst({
      where: { employeeId, documentType },
    });
    doc = existing
      ? await prisma.employeeDocument.update({
          where: { id: existing.id },
          data: docData,
        })
      : await prisma.employeeDocument.create({
          data: {
            employeeId,
            documentType,
            ...docData,
            createdBy: user.id,
          },
        });
  }

  const mapped = mapEmployeeDocument(doc);

  return Response.json({
    document: mapped,
  });
}
