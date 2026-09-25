"use client";

import { Check, ChevronDown, Columns3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, MenuItem } from "./Popover";

/** Filter-style chip listing the optional columns of a table; each item toggles one. */
export function ColumnsChip({ columns, shown, onToggle, className }: { columns: { id: string; label: string; description?: string }[]; shown: string[]; onToggle: (id: string) => void; className?: string }) {
  const active = columns.filter((c) => shown.includes(c.id));
  return (
    <DropdownMenu
      trigger={({ ref, toggle, open }) => (
        <button
          ref={ref}
          type="button"
          onClick={toggle}
          className={cn("inline-flex h-8 shrink-0 items-center gap-1 rounded-ds bg-ds-neutral px-2 text-sm font-medium text-ds-text hover:bg-ds-neutral-hovered focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-border-focused", open && "bg-ds-neutral-hovered", className)}
        >
          <Columns3 size={14} className="text-ds-icon" />
          {active.length ? (
            <>
              <span className="font-normal text-ds-text-subtle">Columns:</span> {active.map((c) => c.label).join(", ")}
            </>
          ) : (
            "Columns"
          )}
          <ChevronDown size={14} className={cn("text-ds-icon transition-transform", open && "rotate-180")} />
        </button>
      )}
    >
      {columns.map((c) => {
        const on = shown.includes(c.id);
        return (
          <MenuItem key={c.id} isSelected={on} onClick={() => onToggle(c.id)} description={c.description} icon={on ? <Check /> : <span />}>
            {c.label}
          </MenuItem>
        );
      })}
    </DropdownMenu>
  );
}
