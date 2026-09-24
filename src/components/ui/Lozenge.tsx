import { cn } from "@/lib/utils";

export type LozengeAppearance = "default" | "inprogress" | "success" | "removed" | "moved" | "new";

const subtle: Record<LozengeAppearance, string> = {
  default: "bg-lz-default text-lz-default-text",
  inprogress: "bg-lz-inprogress text-lz-inprogress-text",
  success: "bg-lz-success text-lz-success-text",
  removed: "bg-lz-removed text-lz-removed-text",
  moved: "bg-lz-moved text-lz-moved-text",
  new: "bg-lz-new text-lz-new-text",
};

const bold: Record<LozengeAppearance, string> = {
  default: "bg-lz-default-bold text-lz-default-bold-text",
  inprogress: "bg-lz-inprogress-bold text-lz-inprogress-bold-text",
  success: "bg-lz-success-bold text-lz-success-bold-text",
  removed: "bg-lz-removed-bold text-lz-removed-bold-text",
  moved: "bg-lz-moved-bold text-lz-moved-bold-text",
  new: "bg-lz-new-bold text-lz-new-bold-text",
};

/** Classes for a bold, button-like status control (StatusButton, OfferStatusButton) */
export function boldStatusClasses(appearance: LozengeAppearance) {
  return cn(bold[appearance], "hover:brightness-95 dark:hover:brightness-110");
}

export function Lozenge({
  appearance = "default",
  isBold,
  children,
  className,
  maxWidth = 200,
}: {
  appearance?: LozengeAppearance;
  isBold?: boolean;
  children: React.ReactNode;
  className?: string;
  maxWidth?: number;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-4 max-w-full items-center truncate rounded-[3px] px-1 text-[11px] font-bold uppercase leading-4 tracking-[0.02em]",
        isBold ? bold[appearance] : subtle[appearance],
        className,
      )}
      style={{ maxWidth }}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

export function Badge({ children, className, appearance = "default" }: { children: React.ReactNode; className?: string; appearance?: "default" | "primary" | "important" | "added" | "removed" }) {
  const map = {
    default: "bg-ds-neutral text-ds-text",
    primary: "bg-ds-brand-bold text-ds-text-on-brand",
    important: "bg-ds-danger-bold text-ds-text-on-brand",
    added: "bg-lz-success text-lz-success-text",
    removed: "bg-lz-removed text-lz-removed-text",
  };
  return (
    <span className={cn("inline-flex h-4 min-w-4 items-center justify-center rounded-lg px-1.5 text-[11px] font-semibold leading-4", map[appearance], className)}>
      {children}
    </span>
  );
}
