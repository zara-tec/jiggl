"use client";

import * as React from "react";
import { format, parseISO, subDays } from "date-fns";
import type { RatePeriod } from "@/lib/types";
import { EPOCH, currentRate, today } from "@/lib/rates";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export type ApplyMode = "new" | "all" | "date";

export interface RateModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  periods: RatePeriod[] | undefined;
  /** Rate inherited when no override exists (shown as hint) */
  inherited?: number;
  currency?: string;
  /** Number of time entries that would be revalued if applied from a given date */
  affectedFrom: (applyFrom: string) => number;
  onApply: (rate: number, applyFrom: string) => void;
  onReset?: () => void;
}

/**
 * "Change rate" dialog: the new rate can apply to new entries only,
 * to every entry, or to entries from a chosen date. All three are just the
 * start date of a new rate period, so the change stays auditable.
 */
export function RateModal({ open, onClose, title, subtitle, periods, inherited, currency = "EUR", affectedFrom, onApply, onReset }: RateModalProps) {
  const cur = currentRate(periods);
  const [rate, setRate] = React.useState("");
  const [mode, setMode] = React.useState<ApplyMode>("new");
  const [date, setDate] = React.useState(() => format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setRate(cur !== undefined ? String(cur) : inherited !== undefined ? String(inherited) : "");
      setMode("new");
      setError(null);
    }
  }, [open, cur, inherited]);

  const applyFrom = mode === "new" ? today() : mode === "all" ? EPOCH : date;
  const affected = affectedFrom(applyFrom);
  const sym = currency === "USD" ? "$" : currency === "GBP" ? "£" : "€";

  const submit = () => {
    const n = Number(rate.replace(",", "."));
    if (!rate.trim() || isNaN(n) || n < 0) return setError("Enter a valid rate");
    onApply(n, applyFrom);
    onClose();
  };

  const history = [...(periods ?? [])].sort((a, b) => b.from.localeCompare(a.from));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width={520}
      footer={
        <>
          {onReset && periods && periods.length > 0 && (
            <Button appearance="subtle" className="mr-auto text-ds-text-danger" onClick={() => { onReset(); onClose(); }}>
              Remove override
            </Button>
          )}
          <Button appearance="subtle" onClick={onClose}>Cancel</Button>
          <Button appearance="primary" onClick={submit}>Apply</Button>
        </>
      }
    >
      {subtitle && <p className="mb-4 text-sm text-ds-text-subtle">{subtitle}</p>}
      <label className="mb-4 block">
        <span className="mb-1 block text-xs font-semibold text-ds-text-subtle">New rate ({sym}/h)</span>
        <input autoFocus value={rate} onChange={(e) => { setRate(e.target.value.replace(/[^\d.,]/g, "")); setError(null); }} onKeyDown={(e) => e.key === "Enter" && submit()} className="ds-input w-40" inputMode="decimal" />
        <span className="mt-1 block text-xs text-ds-text-subtlest">
          {cur !== undefined ? `Current: ${sym}${cur}/h` : inherited !== undefined ? `No override. Inherited: ${sym}${inherited}/h` : "No rate set"}
        </span>
        {error && <span className="mt-1 block text-xs text-ds-text-danger">{error}</span>}
      </label>

      <fieldset className="mb-4">
        <legend className="mb-1 text-xs font-semibold text-ds-text-subtle">Apply to</legend>
        <div className="space-y-1.5 text-sm">
          <ApplyOption checked={mode === "new"} onChange={() => setMode("new")} label="Only new time entries" hint={`From today, ${format(new Date(), "d MMM yyyy")}. Past hours keep their current value.`} />
          <ApplyOption checked={mode === "all"} onChange={() => setMode("all")} label="All time entries" hint="Retroactive: every tracked hour is revalued and the rate history is replaced." />
          <ApplyOption checked={mode === "date"} onChange={() => setMode("date")} label="Time entries from a date">
            <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setMode("date"); }} className="ds-input mt-1 h-8 w-44 py-1" />
          </ApplyOption>
        </div>
      </fieldset>

      <div className={cn("rounded-ds px-3 py-2 text-sm", affected > 0 ? "bg-ds-warning text-ds-text-warning" : "bg-ds-surface-sunken text-ds-text-subtle")}>
        {affected > 0 ? `${affected} existing time entr${affected === 1 ? "y" : "ies"} will be revalued.` : "No existing time entries are affected."}
      </div>

      {history.length > 0 && (
        <div className="mt-4">
          <div className="mb-1 text-xs font-semibold text-ds-text-subtle">History</div>
          <ul className="divide-y divide-ds-border rounded-ds border border-ds-border text-sm">
            {history.map((p) => (
              <li key={p.from} className="flex items-center justify-between px-3 py-1.5">
                <span className="text-ds-text-subtle">{p.from === EPOCH ? "From the beginning" : `From ${format(parseISO(p.from), "d MMM yyyy")}`}</span>
                <span className="tabular-nums font-semibold">{sym}{p.rate}/h</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}

function ApplyOption({ checked, onChange, label, hint, children }: { checked: boolean; onChange: () => void; label: string; hint?: string; children?: React.ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer gap-2 rounded-ds border px-3 py-2", checked ? "border-ds-border-selected bg-ds-selected" : "border-ds-border hover:bg-ds-surface-hovered")}>
      <input type="radio" checked={checked} onChange={onChange} className="mt-0.5 accent-ds-brand-bold" />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{label}</span>
        {hint && <span className="block text-xs text-ds-text-subtlest">{hint}</span>}
        {children}
      </span>
    </label>
  );
}

/** Small inline "€85/h since 1 Sep" label with a Change button */
export function RateCell({ periods, inherited, currency = "EUR", onChange, onReset, label }: { periods?: RatePeriod[]; inherited?: number; currency?: string; onChange: () => void; onReset?: () => void; label?: string }) {
  const cur = currentRate(periods);
  const sym = currency === "USD" ? "$" : currency === "GBP" ? "£" : "€";
  const since = periods?.length ? [...periods].filter((p) => p.from <= today()).sort((a, b) => b.from.localeCompare(a.from))[0] : undefined;
  return (
    <span className="inline-flex items-center gap-2">
      {cur !== undefined ? (
        <span className="tabular-nums font-semibold">
          {sym}{cur}/h
          {since && since.from !== EPOCH && <span className="ml-1 text-xs font-normal text-ds-text-subtlest">since {format(parseISO(since.from), "d MMM yy")}</span>}
          {label && <span className="ml-1 rounded-[3px] bg-ds-information px-1 text-[10px] font-bold uppercase text-ds-text-information">{label}</span>}
        </span>
      ) : inherited !== undefined ? (
        <span className="tabular-nums text-ds-text-subtle">{sym}{inherited}/h <span className="text-xs text-ds-text-subtlest">default</span></span>
      ) : (
        <span className="text-ds-text-subtlest">Not set</span>
      )}
      <button type="button" onClick={onChange} className="text-xs text-ds-link hover:underline">Change</button>
      {onReset && cur !== undefined && (
        <button type="button" onClick={onReset} className="text-xs text-ds-text-subtle hover:underline">Reset</button>
      )}
    </span>
  );
}
