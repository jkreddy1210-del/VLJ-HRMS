export function bufferToDataUri(buffer, mimeType) {
  if (!buffer) return null;
  const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (!data.length) return null;
  const mime = mimeType || "application/octet-stream";
  return `data:${mime};base64,${data.toString("base64")}`;
}

export function resolveDocumentUrl(doc) {
  if (!doc) return null;
  const fromBlob = bufferToDataUri(doc.fileData, doc.mimeType);
  if (fromBlob) return fromBlob;
  if (doc.filePath?.startsWith("http://") || doc.filePath?.startsWith("https://")) {
    return doc.filePath;
  }
  if (doc.filePath?.startsWith("data:")) return doc.filePath;
  return null;
}

export function mapEmployeeDocument(doc) {
  const url = resolveDocumentUrl(doc);
  const isPdf =
    doc.mimeType === "application/pdf" ||
    doc.fileName?.toLowerCase().endsWith(".pdf");

  return {
    id: doc.id,
    documentType: doc.documentType,
    name: doc.documentType.replace(/_/g, " "),
    fileName: doc.fileName,
    mimeType: doc.mimeType || null,
    url,
    isPdf,
    isImage: Boolean(url && !isPdf && doc.mimeType?.startsWith("image/")),
  };
}

export function mapDocumentsByType(documents = []) {
  const byType = {};
  for (const doc of documents) {
    const mapped = mapEmployeeDocument(doc);
    if (doc.documentType === "Payslip") {
      if (!byType.Payslip) byType.Payslip = [];
      byType.Payslip.push(mapped);
    } else {
      byType[doc.documentType] = mapped;
    }
  }
  return byType;
}
