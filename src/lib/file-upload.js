export const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;

export const IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png"];
export const DOC_TYPES = [...IMAGE_TYPES, "application/pdf"];

export function validateUploadFile(file, { allowPdf = true } = {}) {
  if (!file) return { valid: false, message: "No file selected" };
  if (file.size > MAX_UPLOAD_SIZE) {
    return { valid: false, message: "File must be under 5MB" };
  }
  const allowed = allowPdf ? DOC_TYPES : IMAGE_TYPES;
  if (!allowed.includes(file.type)) {
    return allowPdf
      ? { valid: false, message: "Only JPG, PNG, and PDF files are allowed" }
      : { valid: false, message: "Only JPG and PNG photos are allowed" };
  }
  return { valid: true };
}

export function isPdfFile(fileOrMime) {
  if (!fileOrMime) return false;
  if (typeof fileOrMime === "string") {
    return fileOrMime === "application/pdf" || fileOrMime.toLowerCase().endsWith(".pdf");
  }
  return fileOrMime.type === "application/pdf" || fileOrMime.name?.toLowerCase().endsWith(".pdf");
}

export function isImageFile(fileOrMime) {
  if (!fileOrMime) return false;
  if (typeof fileOrMime === "string") {
    return fileOrMime.startsWith("image/") || /\.(jpe?g|png)$/i.test(fileOrMime);
  }
  return IMAGE_TYPES.includes(fileOrMime.type) || fileOrMime.type?.startsWith("image/");
}

export function filePreviewUrl(file) {
  if (!file) return null;
  if (typeof file === "string") return file;
  return URL.createObjectURL(file);
}

export async function cropImageToFile(imageSrc, { aspect = 1, quality = 0.85, maxSize = 1600 } = {}) {
  const img = await loadImage(imageSrc);
  const size = Math.min(img.width, img.height);
  let cropW = size;
  let cropH = size;
  if (aspect > 1) {
    cropH = size / aspect;
  } else if (aspect < 1) {
    cropW = size * aspect;
  }
  const sx = (img.width - cropW) / 2;
  const sy = (img.height - cropH) / 2;

  const scale = Math.min(1, maxSize / Math.max(cropW, cropH));
  const outW = Math.max(1, Math.round(cropW * scale));
  const outH = Math.max(1, Math.round(cropH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process image");
  ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, outW, outH);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("Could not save image");
  return new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}
