"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "تأكيد",
  cancelLabel = "إلغاء",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      // Trap focus in dialog
      dialogRef.current?.focus();
      // Prevent body scroll
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onCancel();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onCancel]);

  if (!open) return null;

  const variantStyles = {
    danger: "bg-red-500/10 text-red-500",
    warning: "bg-yellow-500/10 text-yellow-500",
    info: "bg-blue-500/10 text-blue-500",
  };

  const btnVariantStyles = {
    danger: "bg-red-500/20 text-red-400 hover:bg-red-500/30",
    warning: "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30",
    info: "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30",
  };

  const iconVariantStyles = {
    danger: "text-red-500",
    warning: "text-yellow-500",
    info: "text-blue-500",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        className="glass-panel-strong rounded-2xl p-6 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <div className="flex items-start gap-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${variantStyles[variant]}`}
          >
            <AlertTriangle className={`h-6 w-6 ${iconVariantStyles[variant]}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold">{title}</h3>
              <button
                onClick={onCancel}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            className="btn-ghost flex-1"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${btnVariantStyles[variant]}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
