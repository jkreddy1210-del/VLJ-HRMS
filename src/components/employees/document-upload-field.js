"use client";

import { useRef, useState, useEffect } from "react";
import { Camera, Upload, Eye, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilePreviewDialog } from "@/components/employees/file-preview-dialog";
import { ImageCropDialog } from "@/components/employees/image-crop-dialog";
import { filePreviewUrl, isImageFile, isPdfFile } from "@/lib/file-upload";

export function DocumentUploadField({
  label,
  pendingFile,
  existingDoc,
  onFileSelect,
  error,
  allowPdf = true,
  compact = false,
}) {
  const cameraRef = useRef(null);
  const fileRef = useRef(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState(null);
  const [pendingUrl, setPendingUrl] = useState(null);

  useEffect(() => {
    if (!pendingFile) {
      setPendingUrl(null);
      return undefined;
    }
    const url = filePreviewUrl(pendingFile);
    setPendingUrl(url);
    return () => {
      if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
    };
  }, [pendingFile]);

  const viewUrl = pendingUrl || existingDoc?.url || null;
  const viewName = pendingFile?.name || existingDoc?.fileName || label;
  const canView = Boolean(viewUrl);
  const hasFile = Boolean(pendingFile || existingDoc?.url);

  const handleCameraChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCropSrc(url);
    setCropOpen(true);
  };

  const handleCropConfirm = (file) => {
    if (cropSrc?.startsWith("blob:")) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    onFileSelect(file);
  };

  const handleCropClose = (open) => {
    if (!open && cropSrc?.startsWith("blob:")) URL.revokeObjectURL(cropSrc);
    if (!open) setCropSrc(null);
    setCropOpen(open);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onFileSelect(file);
  };

  return (
    <>
      <div className={`flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between ${error ? "border-destructive" : ""} ${compact ? "p-3" : ""}`}>
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium">{label}</span>
          {pendingFile && (
            <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
              <Check className="h-3 w-3" /> {pendingFile.name}
            </p>
          )}
          {!pendingFile && existingDoc?.fileName && (
            <p className="mt-1 text-xs text-muted-foreground">Uploaded: {existingDoc.fileName}</p>
          )}
          {!pendingFile && existingDoc?.isImage && existingDoc.url && (
            <img
              src={existingDoc.url}
              alt={existingDoc.fileName}
              className="mt-2 h-12 w-12 rounded border object-cover"
            />
          )}
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleCameraChange}
          />
          <input
            ref={fileRef}
            type="file"
            accept={allowPdf ? "image/jpeg,image/jpg,image/png,application/pdf" : "image/jpeg,image/jpg,image/png"}
            className="hidden"
            onChange={handleFileChange}
          />
          <Button variant="outline" size="sm" type="button" onClick={() => cameraRef.current?.click()}>
            <Camera className="mr-1 h-3 w-3" /> Camera
          </Button>
          <Button variant="outline" size="sm" type="button" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-1 h-3 w-3" /> Upload File
          </Button>
          {canView && (
            <Button variant="ghost" size="sm" type="button" onClick={() => setPreviewOpen(true)}>
              <Eye className="mr-1 h-3 w-3" /> View
            </Button>
          )}
        </div>
      </div>

      <FilePreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={label}
        url={viewUrl}
        fileName={viewName}
      />

      <ImageCropDialog
        open={cropOpen}
        onOpenChange={handleCropClose}
        imageSrc={cropSrc}
        title={`${label} — Photo`}
        onConfirm={handleCropConfirm}
      />
    </>
  );
}

export function getDocPreviewMeta(pendingFile, existingDoc) {
  const url = pendingFile ? filePreviewUrl(pendingFile) : existingDoc?.url;
  const name = pendingFile?.name || existingDoc?.fileName;
  return { url, name, isPdf: isPdfFile(pendingFile || name) || existingDoc?.isPdf, isImage: isImageFile(pendingFile) || existingDoc?.isImage };
}
