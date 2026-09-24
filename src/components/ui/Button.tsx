"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type ButtonAppearance = "default" | "primary" | "subtle" | "link" | "subtle-link" | "danger" | "warning" | "discovery";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  appearance?: ButtonAppearance;
  spacing?: "default" | "compact" | "none";
  iconBefore?: React.ReactNode;
  iconAfter?: React.ReactNode;
  isSelected?: boolean;
  shouldFitContainer?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}

const base =
  "inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-ds font-medium transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-border-focused disabled:cursor-not-allowed disabled:text-ds-text-disabled disabled:bg-ds-neutral";

const appearances: Record<ButtonAppearance, string> = {
  default: "bg-ds-neutral text-ds-text hover:bg-ds-neutral-hovered active:bg-ds-neutral-pressed",
  primary: "bg-ds-brand-bold text-ds-text-on-brand hover:bg-ds-brand-bold-hovered active:bg-ds-brand-bold-pressed",
  subtle: "bg-transparent text-ds-text hover:bg-ds-neutral-subtle-hovered active:bg-ds-neutral-subtle-pressed",
  link: "bg-transparent text-ds-link hover:underline px-0",
  "subtle-link": "bg-transparent text-ds-text-subtle hover:underline hover:text-ds-text px-0",
  danger: "bg-ds-danger-bold text-ds-text-on-brand hover:bg-ds-danger-bold-hovered",
  warning: "bg-ds-warning-bold text-lz-moved-bold-text hover:brightness-95",
  discovery: "bg-ds-discovery-bold text-ds-text-on-brand hover:brightness-95",
};

const selected = "bg-ds-neutral-bold text-ds-text-inverse hover:bg-ds-neutral-bold hover:text-ds-text-inverse";

export function Button({
  appearance = "default",
  spacing = "default",
  iconBefore,
  iconAfter,
  isSelected,
  shouldFitContainer,
  className,
  children,
  ref,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        base,
        isSelected ? selected : appearances[appearance],
        spacing === "default" && "h-8 px-3 text-sm",
        spacing === "compact" && "h-6 px-2 text-xs",
        spacing === "none" && "h-auto p-0",
        (appearance === "link" || appearance === "subtle-link") && "h-auto px-0",
        shouldFitContainer && "w-full",
        !children && (iconBefore || iconAfter) && spacing === "default" && "w-8 px-0",
        !children && (iconBefore || iconAfter) && spacing === "compact" && "w-6 px-0",
        className,
      )}
      {...rest}
    >
      {iconBefore && <span className="inline-flex shrink-0 items-center [&>svg]:size-4">{iconBefore}</span>}
      {children && <span className="truncate">{children}</span>}
      {iconAfter && <span className="inline-flex shrink-0 items-center [&>svg]:size-4">{iconAfter}</span>}
    </button>
  );
}

export function IconButton({
  icon,
  label,
  className,
  isSelected,
  spacing = "default",
  appearance = "subtle",
  ref,
  ...rest
}: Omit<ButtonProps, "children" | "iconBefore" | "iconAfter"> & { icon: React.ReactNode; label: string }) {
  return (
    <Button
      ref={ref}
      appearance={appearance}
      spacing={spacing}
      isSelected={isSelected}
      iconBefore={icon}
      aria-label={label}
      title={label}
      className={cn(spacing === "default" ? "w-8 px-0" : "w-6 px-0", className)}
      {...rest}
    />
  );
}
