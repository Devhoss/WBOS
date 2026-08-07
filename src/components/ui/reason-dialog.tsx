"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ReasonDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  label?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  required?: boolean;
  placeholder?: string;
  onConfirm: (reason: string) => void;
};

export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  label = "Reason",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  busy = false,
  required = false,
  placeholder,
  onConfirm,
}: ReasonDialogProps) {
  const [value, setValue] = useState("");

  const trimmed = value.trim();
  const canConfirm = !required || trimmed.length > 0;

  function submit() {
    if (!canConfirm || busy) return;
    onConfirm(trimmed);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy && !next) return;
        if (!next) setValue("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md" closeDisabled={busy}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="space-y-2">
          <label htmlFor="reason-dialog-input" className="text-sm font-medium">
            {label}
            {required ? <span className="ml-1 text-destructive">*</span> : null}
          </label>
          <textarea
            id="reason-dialog-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={placeholder ?? (required ? "Required" : "Optional")}
            rows={3}
            autoFocus
            className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-60"
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <button
              type="button"
              disabled={busy}
              className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium transition hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-60"
            >
              {cancelLabel}
            </button>
          </DialogClose>
          <button
            type="button"
            disabled={busy || !canConfirm}
            onClick={submit}
            className={cn(
              "inline-flex h-9 items-center justify-center gap-2 rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground transition hover:bg-destructive/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50 disabled:opacity-60",
            )}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
