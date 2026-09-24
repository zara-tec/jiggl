"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "./Button";

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 600,
  className,
  bodyClassName,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
  className?: string;
  bodyClassName?: string;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[900] flex items-start justify-center overflow-y-auto bg-ds-overlay p-6 pt-[8vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal
        className={cn("fade-in flex max-h-[84vh] w-full flex-col rounded-ds-lg bg-ds-surface-overlay shadow-ds-overlay", className)}
        style={{ maxWidth: width }}
      >
        {title && (
          <div className="flex items-center justify-between px-6 pb-2 pt-5">
            <h2 className="ds-heading-lg">{title}</h2>
            <IconButton icon={<X />} label="Close" onClick={onClose} />
          </div>
        )}
        <div className={cn("min-h-0 flex-1 overflow-y-auto px-6 py-3", bodyClassName)}>{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 px-6 pb-5 pt-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
