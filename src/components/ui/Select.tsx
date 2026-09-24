"use client";

import * as React from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover } from "./Popover";

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  description?: string;
  group?: string;
  keywords?: string;
}

export interface SelectProps<T extends string = string> {
  value?: T | null;
  options: SelectOption<T>[];
  onChange: (value: T | null) => void;
  placeholder?: string;
  placeholderIcon?: React.ReactNode;
  searchable?: boolean;
  clearable?: boolean;
  /** subtle = borderless button (detail panel), default = bordered field, inline = text only, chip = filter chip */
  appearance?: "default" | "subtle" | "inline" | "chip";
  /** Filter name shown on a chip ("Assignee"), rendered as "Assignee: value" when a value is selected */
  chipLabel?: string;
  className?: string;
  menuClassName?: string;
  width?: number | string;
  isDisabled?: boolean;
  /** Custom trigger renderer */
  renderTrigger?: (p: { selected?: SelectOption<T>; open: boolean }) => React.ReactNode;
  align?: "start" | "end";
  onCreate?: (label: string) => void;
  createLabel?: (q: string) => string;
  autoFocus?: boolean;
  compact?: boolean;
}

export function Select<T extends string = string>({
  value,
  options,
  onChange,
  placeholder = "Select",
  placeholderIcon,
  searchable = true,
  clearable,
  appearance = "default",
  className,
  menuClassName,
  width,
  isDisabled,
  renderTrigger,
  align = "start",
  onCreate,
  createLabel,
  compact,
  chipLabel,
}: SelectProps<T>) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [active, setActive] = React.useState(0);
  const ref = React.useRef<HTMLButtonElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const selected = options.find((o) => o.value === value);

  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options;
    return options.filter((o) => (o.label + " " + (o.keywords ?? "") + " " + (o.description ?? "")).toLowerCase().includes(s));
  }, [q, options]);

  React.useEffect(() => {
    if (open) {
      setQ("");
      setActive(Math.max(0, options.findIndex((o) => o.value === value)));
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open, options, value]);

  const choose = (v: T | null) => {
    onChange(v);
    setOpen(false);
  };

  const canCreate = onCreate && q.trim() && !options.some((o) => o.label.toLowerCase() === q.trim().toLowerCase());

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(filtered.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[active]) choose(filtered[active].value);
      else if (canCreate) {
        onCreate!(q.trim());
        setOpen(false);
      }
    }
  };

  const groups = React.useMemo(() => {
    const map = new Map<string | undefined, { o: SelectOption<T>; idx: number }[]>();
    filtered.forEach((o, idx) => {
      const arr = map.get(o.group) ?? [];
      arr.push({ o, idx });
      map.set(o.group, arr);
    });
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <>
      <button
        ref={ref}
        type="button"
        disabled={isDisabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "group/select inline-flex items-center gap-1.5 rounded-ds text-left text-sm transition-colors disabled:cursor-not-allowed",
          appearance === "default" &&
            "h-8 w-full border-2 border-ds-border-input bg-ds-input px-2 hover:bg-ds-surface-sunken focus-visible:border-ds-border-focused focus-visible:outline-none",
          appearance === "subtle" && "min-h-8 w-full px-1.5 py-1 hover:bg-ds-neutral-subtle-hovered focus-visible:outline-2 focus-visible:outline-ds-border-focused",
          appearance === "inline" && "h-6 px-1 hover:bg-ds-neutral-subtle-hovered",
          appearance === "chip" && "h-8 shrink-0 bg-ds-neutral px-2 font-medium text-ds-text hover:bg-ds-neutral-hovered focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-border-focused",
          compact && "h-6 px-1.5 text-xs",
          open && appearance === "default" && "border-ds-border-focused",
          open && appearance === "subtle" && "bg-ds-neutral-subtle-hovered",
          open && appearance === "chip" && "bg-ds-neutral-hovered",
          className,
        )}
        style={{ width }}
      >
        {renderTrigger ? (
          renderTrigger({ selected, open })
        ) : appearance === "chip" ? (
          <>
            {selected?.icon && <span className="inline-flex shrink-0 items-center [&>svg]:size-4">{selected.icon}</span>}
            <span className="truncate">
              {selected ? (
                <>
                  <span className="font-normal text-ds-text-subtle">{chipLabel ?? placeholder}:</span> {selected.label}
                </>
              ) : (
                chipLabel ?? placeholder
              )}
            </span>
            <ChevronDown size={16} className={cn("shrink-0 text-ds-icon transition-transform", open && "rotate-180")} />
          </>
        ) : (
          <>
            {selected?.icon ? (
              <span className="inline-flex shrink-0 items-center [&>svg]:size-4">{selected.icon}</span>
            ) : placeholderIcon ? (
              <span className="inline-flex shrink-0 items-center [&>svg]:size-4">{placeholderIcon}</span>
            ) : null}
            <span className={cn("min-w-0 flex-1 truncate", !selected && "text-ds-text-subtlest")}>{selected?.label ?? placeholder}</span>
            {appearance === "default" && <ChevronDown size={16} className="shrink-0 text-ds-icon" />}
          </>
        )}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={ref} align={align} className={cn("w-64 py-1", menuClassName)}>
        {searchable && (
          <div className="relative px-2 pb-1 pt-1.5">
            <Search size={14} className="pointer-events-none absolute left-4 top-[15px] text-ds-icon-subtle" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Search"
              className="ds-input h-8 py-1 pl-7 pr-2 text-sm"
            />
          </div>
        )}
        <div className="max-h-72 overflow-y-auto py-1" role="listbox">
          {clearable && !q && (
            <button
              type="button"
              onClick={() => choose(null)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-ds-text-subtle hover:bg-ds-neutral-subtle-hovered"
            >
              <span className="inline-flex w-4 justify-center">
                <X size={14} />
              </span>
              {placeholder}
            </button>
          )}
          {groups.map(([group, opts]) => (
            <div key={group ?? "_"}>
              {group && <div className="ds-heading-xxs px-3 pb-1 pt-2 text-ds-text-subtlest">{group}</div>}
              {opts.map(({ o, idx }) => {
                const isSel = o.value === value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={isSel}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => choose(o.value)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm",
                      idx === active ? "bg-ds-neutral-subtle-hovered" : "",
                      isSel && "text-ds-text-selected",
                    )}
                  >
                    {o.icon && <span className="inline-flex w-5 shrink-0 items-center justify-center [&>svg]:size-4">{o.icon}</span>}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{o.label}</span>
                      {o.description && <span className="block truncate text-xs text-ds-text-subtlest">{o.description}</span>}
                    </span>
                    {isSel && <Check size={16} className="shrink-0 text-ds-icon-brand" />}
                  </button>
                );
              })}
            </div>
          ))}
          {filtered.length === 0 && !canCreate && <div className="px-3 py-2 text-sm text-ds-text-subtlest">No matches</div>}
          {canCreate && (
            <button
              type="button"
              onClick={() => {
                onCreate!(q.trim());
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-ds-link hover:bg-ds-neutral-subtle-hovered"
            >
              {createLabel ? createLabel(q.trim()) : `Create "${q.trim()}"`}
            </button>
          )}
        </div>
      </Popover>
    </>
  );
}
