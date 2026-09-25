"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { DropdownMenu, MenuItem } from "./Popover";

/* ---------- Tabs (underline) ---------- */
type TabItem = { id: string; label: React.ReactNode; href?: string; badge?: React.ReactNode };

const tabClass = (active: boolean) =>
  cn(
    "relative -mb-px flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap px-2 text-sm font-medium transition-colors",
    active ? "text-ds-text-selected" : "text-ds-text-subtle hover:text-ds-text",
    "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-t after:bg-ds-brand-bold after:transition-opacity",
    active ? "after:opacity-100" : "after:opacity-0",
    "hover:bg-ds-neutral-subtle-hovered rounded-t-ds",
  );

const TAB_GAP = 4;

/** The tabs that do not fit move into a trailing "More N" menu; the active tab always stays in the row. */
export function Tabs({ tabs, value, onChange, className }: { tabs: TabItem[]; value: string; onChange?: (id: string) => void; className?: string }) {
  const router = useRouter();
  const rowRef = React.useRef<HTMLDivElement>(null);
  const measureRef = React.useRef<HTMLDivElement>(null);
  const [fit, setFit] = React.useState(tabs.length);

  React.useLayoutEffect(() => {
    const row = rowRef.current;
    const measure = measureRef.current;
    if (!row || !measure) return;
    const compute = () => {
      const widths = Array.from(measure.children, (c) => (c as HTMLElement).offsetWidth);
      const more = widths.pop() ?? 0;
      const available = row.clientWidth;
      const total = widths.reduce((a, w) => a + w + TAB_GAP, -TAB_GAP);
      if (total <= available) return setFit(widths.length);
      let used = more;
      let n = 0;
      while (n < widths.length && used + TAB_GAP + widths[n] <= available) used += TAB_GAP + widths[n++];
      setFit(Math.max(1, n));
    };
    compute();
    // the copy changes size when labels or badges change
    const ro = new ResizeObserver(compute);
    ro.observe(row);
    ro.observe(measure);
    return () => ro.disconnect();
  }, []);

  const activeIndex = tabs.findIndex((t) => t.id === value);
  const visible = activeIndex >= fit ? [...tabs.slice(0, fit - 1), tabs[activeIndex]] : tabs.slice(0, fit);
  const hidden = tabs.filter((t) => !visible.includes(t));

  const render = (t: TabItem) => {
    const active = t.id === value;
    return t.href ? (
      <Link key={t.id} href={t.href} role="tab" aria-selected={active} className={tabClass(active)}>
        {t.label}
        {t.badge}
      </Link>
    ) : (
      <button key={t.id} type="button" role="tab" aria-selected={active} onClick={() => onChange?.(t.id)} className={tabClass(active)}>
        {t.label}
        {t.badge}
      </button>
    );
  };
  const moreLabel = (n: number) => (
    <>
      More <span className="rounded-lg bg-ds-neutral px-1.5 text-[11px] font-semibold text-ds-text-subtle">{n}</span>
    </>
  );

  return (
    <div ref={rowRef} className={cn("relative flex min-w-0 items-center gap-1 border-b border-ds-border", className)} role="tablist">
      {/* off-screen copy used only to measure the natural width of every tab */}
      <div aria-hidden className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden">
        <div ref={measureRef} className="flex w-max">
          {tabs.map((t) => (
            <span key={t.id} className={tabClass(false)}>
              {t.label}
              {t.badge}
            </span>
          ))}
          <span className={tabClass(false)}>{moreLabel(tabs.length)}</span>
        </div>
      </div>
      {visible.map(render)}
      {hidden.length > 0 && (
        <DropdownMenu
          align="end"
          trigger={({ ref, toggle, open }) => (
            <button ref={ref} type="button" onClick={toggle} aria-expanded={open} className={cn(tabClass(false), open && "bg-ds-neutral-subtle-hovered")}>
              {moreLabel(hidden.length)}
            </button>
          )}
        >
          {({ close }) =>
            hidden.map((t) => (
              <MenuItem
                key={t.id}
                elemAfter={t.badge}
                onClick={() => {
                  close();
                  if (t.href) router.push(t.href);
                  else onChange?.(t.id);
                }}
              >
                {t.label}
              </MenuItem>
            ))
          }
        </DropdownMenu>
      )}
    </div>
  );
}

/* ---------- Toggle ---------- */
export function Toggle({ checked, onChange, label, size = "regular" }: { checked: boolean; onChange: (v: boolean) => void; label?: string; size?: "regular" | "large" }) {
  const w = size === "large" ? 40 : 32;
  const h = size === "large" ? 20 : 16;
  const knob = h - 4;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={() => onChange(!checked)}
      className={cn("relative shrink-0 rounded-full transition-colors", checked ? "bg-ds-success-bold" : "bg-ds-border-bold hover:bg-ds-icon-subtle")}
      style={{ width: w, height: h }}
    >
      <span
        className="absolute top-0.5 rounded-full bg-white transition-all"
        style={{ width: knob, height: knob, left: checked ? w - knob - 2 : 2 }}
      />
    </button>
  );
}

/* ---------- Checkbox ---------- */
export function Checkbox({ checked, onChange, label, className }: { checked: boolean; onChange: (v: boolean) => void; label?: React.ReactNode; className?: string }) {
  return (
    <label className={cn("inline-flex cursor-pointer select-none items-center gap-2 text-sm", className)}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-ds-brand-bold" />
      {label}
    </label>
  );
}

/* ---------- Progress bar ---------- */
export function ProgressBar({ segments, className, height = 6 }: { segments: { value: number; color: string; label?: string }[]; className?: string; height?: number }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  return (
    <div className={cn("flex w-full overflow-hidden rounded-full bg-ds-track", className)} style={{ height }}>
      {segments.map((s, i) => (
        <div key={i} title={s.label} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} className="h-full transition-all" />
      ))}
    </div>
  );
}

/* ---------- Empty state ---------- */
export function EmptyState({ icon, title, description, action, className }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      {icon && <div className="mb-4 text-ds-icon-subtle [&>svg]:size-12">{icon}</div>}
      <div className="ds-heading-md">{title}</div>
      {description && <p className="mt-1 max-w-md text-sm text-ds-text-subtle">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------- Section message ---------- */
export function SectionMessage({ appearance = "information", title, children }: { appearance?: "information" | "warning" | "error" | "success" | "discovery"; title?: string; children: React.ReactNode }) {
  const map = {
    information: "bg-ds-information border-l-ds-information-bold",
    warning: "bg-ds-warning border-l-ds-warning-bold",
    error: "bg-ds-danger border-l-ds-danger-bold",
    success: "bg-ds-success border-l-ds-success-bold",
    discovery: "bg-ds-discovery border-l-ds-discovery-bold",
  };
  return (
    <div className={cn("rounded-ds border-l-[3px] px-4 py-3 text-sm", map[appearance])}>
      {title && <div className="mb-1 font-semibold">{title}</div>}
      {children}
    </div>
  );
}

/* ---------- Page header ---------- */
export function PageHeader({
  breadcrumbs,
  title,
  actions,
  children,
  className,
}: {
  breadcrumbs?: { label: string; href?: string }[];
  title: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("shrink-0 px-page pt-5", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="mb-1 flex items-center gap-1 text-sm text-ds-text-subtle">
          {breadcrumbs.map((b, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="text-ds-text-subtlest">/</span>}
              {b.href ? (
                <Link href={b.href} className="rounded-ds px-0.5 hover:text-ds-link hover:underline">
                  {b.label}
                </Link>
              ) : (
                <span>{b.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="ds-heading-xl flex min-w-0 items-center gap-2">{title}</h1>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

/* ---------- Inline text edit ---------- */
export function InlineEdit({
  value,
  onSave,
  placeholder,
  className,
  inputClassName,
  multiline,
  as: As = "div",
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  multiline?: boolean;
  as?: "div" | "h1" | "span";
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => setDraft(value), [value]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() !== value) onSave(draft.trim());
  };

  if (editing) {
    const common = {
      autoFocus: true,
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
        if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          commit();
        }
      },
      className: cn("ds-input", inputClassName),
      placeholder,
    };
    return multiline ? <textarea rows={6} {...common} /> : <input {...common} />;
  }
  return (
    <As
      onClick={() => setEditing(true)}
      className={cn("ds-inline-edit cursor-text whitespace-pre-wrap", !value && "text-ds-text-subtlest", className)}
    >
      {value || placeholder}
    </As>
  );
}

/* ---------- Tooltip ---------- */
export function Tooltip({ content, children, className }: { content: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("group/tt relative inline-flex", className)}>
      {children}
      <span className="pointer-events-none absolute left-1/2 top-full z-[1100] mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded-ds bg-ds-tooltip px-2 py-1 text-xs text-ds-tooltip-text group-hover/tt:block">
        {content}
      </span>
    </span>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-[3px] border border-ds-border bg-ds-surface-sunken px-1 font-sans text-[11px] text-ds-text-subtle">{children}</kbd>;
}
