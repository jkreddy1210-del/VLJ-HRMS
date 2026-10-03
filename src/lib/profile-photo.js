const PHOTO_MIME = ["image/jpeg", "image/jpg", "image/png"];
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

export { PHOTO_MIME, MAX_PHOTO_SIZE };

/** Detect JPEG/PNG from magic bytes when mime type is missing. */
export function detectImageMime(buffer) {
  if (!buffer || buffer.length < 4) return "image/jpeg";
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  return "image/jpeg";
}

/** Convert stored DB value to a data URI for API responses and <img src>. */
export function profilePhotoToDataUri(value, mimeType) {
  if (!value) return null;

  if (Buffer.isBuffer(value)) {
    const mime = mimeType || detectImageMime(value);
    return `data:${mime};base64,${value.toString("base64")}`;
  }

  if (typeof value === "string") {
    if (value.startsWith("data:")) return value;
    if (value.startsWith("http://") || value.startsWith("https://")) return value;
    if (value.startsWith("/")) return null;
    const mime = mimeType || "image/jpeg";
    return `data:${mime};base64,${value}`;
  }

  if (value instanceof Uint8Array) {
    return profilePhotoToDataUri(Buffer.from(value), mimeType);
  }

  return null;
}

export function defaultAvatarUrl(employeeCode) {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${employeeCode}`;
}

export function resolveEmployeePhoto(employee) {
  const dataUri = profilePhotoToDataUri(employee?.profilePhoto);
  if (dataUri) return dataUri;
  return defaultAvatarUrl(employee?.employeeCode || "employee");
}

export function validateProfilePhotoFile(file) {
  if (!file || typeof file === "string") {
    return { valid: false, error: "File is required" };
  }
  if (file.size > MAX_PHOTO_SIZE) {
    return { valid: false, error: "Photo must be under 5MB" };
  }
  if (!PHOTO_MIME.includes(file.type)) {
    return { valid: false, error: "Profile photo must be JPG or PNG" };
  }
  return { valid: true };
}
