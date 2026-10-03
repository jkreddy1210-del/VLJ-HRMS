"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cropImageToFile } from "@/lib/file-upload";

export function ImageCropDialog({ open, onOpenChange, imageSrc, title, onConfirm }) {
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!open) setProcessing(false);
  }, [open]);

  const handleUse = async () => {
    if (!imageSrc) return;
    setProcessing(true);
    try {
      const file = await cropImageToFile(imageSrc, { aspect: 1 });
      onConfirm(file);
      onOpenChange(false);
    } catch {
      onOpenChange(false);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title || "Confirm Photo"}</DialogTitle>
          <DialogDescription>Adjust and use this photo. Center crop will be applied.</DialogDescription>
        </DialogHeader>
        {imageSrc && (
          <div className="overflow-hidden rounded-lg border bg-black">
            <img src={imageSrc} alt="Crop preview" className="aspect-square w-full object-cover" />
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={processing}>
            Retake
          </Button>
          <Button type="button" onClick={handleUse} disabled={!imageSrc || processing}>
            {processing ? "Processing..." : "Use Photo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
