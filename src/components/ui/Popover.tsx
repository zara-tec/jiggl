"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export interface PopoverProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  align?: "start" | "end";
  placement?: "bottom" | "top";
  className?: string;
  /** Match anchor width */
  matchWidth?: boolean;
  offset?: number;
}

/**
 * Lightweight portal popover positioned relative to an anchor element.
 * Closes on outside click and on Escape.
 */
export function Popover({ open, onClose, anchorRef, children, align = "start", placement = "bottom", className, matchWidth, offset = 4 }: PopoverProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [style, setStyle] = React.useState<React.CSSProperties>({ visibility: "hidden" });

  const update = React.useCallback(() => {
    const anchor = anchorRef.current;
    const menu = ref.current;
    if (!anchor || !menu) return;
    const r = anchor.getBoundingClientRect();
    const mh = menu.offsetHeight;
    const mw = matchWidth ? r.width : menu.offsetWidth;
    let top = placement === "bottom" ? r.bottom + offset : r.top - mh - offset;
    if (placement === "bottom" && top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - offset);
    if (placement === "top" && top < 8) top = r.bottom + offset;
    let left = align === "end" ? r.right - mw : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - mw - 8));
    setStyle({ position: "fixed", top, left, width: matchWidth ? r.width : undefined, visibility: "visible", zIndex: 1000 });
  }, [anchorRef, align, placement, matchWidth, offset]);

  React.useLayoutEffect(() => {
    if (!open) {
      setStyle({ visibility: "hidden" });
      return;
    }
    update();
    const ro = ref.current ? new ResizeObserver(update) : null;
    if (ref.current && ro) ro.observe(ref.current);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, update]);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div ref={ref} style={style} className={cn("fade-in rounded-ds bg-ds-surface-overlay shadow-ds-overlay", className)} role="dialog">
      {children}
    </div>,
    document.body,
  );
}

/* ---------- Dropdown menu building blocks ---------- */

export function DropdownMenu({
  trigger,
  children,
  align = "start",
  className,
  matchWidth,
}: {
  trigger: (p: { ref: React.RefObject<HTMLButtonElement | null>; open: boolean; toggle: () => void }) => React.ReactNode;
  children: React.ReactNode | ((p: { close: () => void }) => React.ReactNode);
  align?: "start" | "end";
  className?: string;
  matchWidth?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLButtonElement>(null);
  const close = React.useCallback(() => setOpen(false), []);
  return (
    <>
      {trigger({ ref, open, toggle: () => setOpen((o) => !o) })}
      <Popover open={open} onClose={close} anchorRef={ref} align={align} matchWidth={matchWidth} className={cn("min-w-40 py-1", className)}>
        {typeof children === "function" ? children({ close }) : children}
      </Popover>
    </>
  );
}

export function MenuItem({
  icon,
  children,
  onClick,
  description,
  isSelected,
  isDisabled,
  className,
  elemAfter,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  description?: string;
  isSelected?: boolean;
  isDisabled?: boolean;
  className?: string;
  elemAfter?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-ds-text hover:bg-ds-neutral-subtle-hovered disabled:cursor-not-allowed disabled:text-ds-text-disabled",
        isSelected && "bg-ds-selected text-ds-text-selected hover:bg-ds-selected-hovered",
        className,
      )}
    >
      {icon && <span className="inline-flex w-5 shrink-0 items-center justify-center [&>svg]:size-4">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{children}</span>
        {description && <span className="block truncate text-xs text-ds-text-subtlest">{description}</span>}
      </span>
      {elemAfter}
    </button>
  );
}

export function MenuGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      {title && <div className="ds-heading-xxs px-3 pb-1 pt-2 text-ds-text-subtlest">{title}</div>}
      {children}
    </div>
  );
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-ds-border" />;
}
