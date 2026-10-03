import { v2 as cloudinary } from "cloudinary";

let configured = false;

function ensureCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to your .env file."
    );
  }

  if (!configured) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    configured = true;
  }
}

export function isCloudStorageConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

/**
 * Upload employee file to Cloudinary (free tier).
 * Returns a permanent HTTPS URL stored in the database.
 */
export async function uploadEmployeeFile(buffer, { employeeId, documentType, fileName, mimeType }) {
  ensureCloudinaryConfig();

  const safeType = String(documentType || "file").replace(/[^\w-]/g, "_");
  const baseName = String(fileName || "upload")
    .replace(/\.[^.]+$/, "")
    .replace(/[^\w-]/g, "_")
    .slice(0, 40);
  const publicId = `${safeType}_${Date.now()}_${baseName}`;

  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `vlj-hrms/employees/${employeeId}`,
        public_id: publicId,
        resource_type: "auto",
        overwrite: true,
        ...(mimeType?.startsWith("image/") ? { format: mimeType.split("/")[1] === "jpeg" ? "jpg" : mimeType.split("/")[1] } : {}),
      },
      (error, uploadResult) => {
        if (error) reject(error);
        else resolve(uploadResult);
      }
    );
    stream.end(buffer);
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    bytes: result.bytes,
  };
}

/** Normalize stored path — local legacy paths stay as-is; cloud URLs unchanged. */
export function resolveStoredFileUrl(filePath) {
  if (!filePath) return null;
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) return filePath;
  return filePath;
}
