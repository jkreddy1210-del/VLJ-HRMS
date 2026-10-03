"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { isPdfFile } from "@/lib/file-upload";

export function FilePreviewDialog({ open, onOpenChange, title, url, fileName }) {
  const isPdf = isPdfFile(fileName) || url?.startsWith("data:application/pdf");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title || "Preview"}</DialogTitle>
        </DialogHeader>
        {!url ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nothing to preview</p>
        ) : isPdf ? (
          <div className="space-y-3">
            <iframe
              src={url}
              title={fileName || "Document preview"}
              className="h-[70vh] w-full rounded-lg border"
            />
            <Button variant="outline" className="w-full" asChild>
              <a href={url} target="_blank" rel="noopener noreferrer">
                Open in new tab
              </a>
            </Button>
          </div>
        ) : (
          <div className="flex max-h-[70vh] items-center justify-center overflow-auto rounded-lg border bg-muted/30 p-2">
            <img
              src={url}
              alt={fileName || "Preview"}
              className="max-h-[65vh] w-auto max-w-full object-contain"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
