"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import type { HolidayKind } from "@/lib/types";
import { HOLIDAY_KINDS, holidayDays, holidayEnd, sortHolidays } from "@/lib/holidays";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Lozenge } from "@/components/ui/Lozenge";

/** Settings → working days, public holidays and company closures (the time off of everybody) */
export function HolidaysSection() {
  const holidays = useStore((s) => s.holidays);
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const add = useStore((s) => s.addHoliday);
  const remove = useStore((s) => s.removeHoliday);
  const [date, setDate] = React.useState("");
  const [to, setTo] = React.useState("");
  const [name, setName] = React.useState("");
  const [kind, setKind] = React.useState<HolidayKind>("holiday");
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const valid = !!date && (!to || to >= date);
  const submit = () => {
    if (!valid) return;
    add({ date, to: to && to > date ? to : undefined, name: name || (kind === "closure" ? "Company closure" : "Holiday"), kind });
    setName("");
    setDate("");
    setTo("");
  };
  const fmt = (iso: string) => format(parseISO(iso), "EEE d MMM yyyy");

  return (
    <section>
      <h2 className="ds-heading-md mb-1">Working days, holidays and closures</h2>
      <p className="mb-3 text-sm text-ds-text-subtle">Days off for everybody: allocations book no hours, dependent offer lines are scheduled around them. Personal time off is managed per member on the Team page.</p>
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {[1, 2, 3, 4, 5, 6, 0].map((d) => {
          const on = settings.workDays.includes(d);
          return (
            <button key={d} type="button" onClick={() => updateSettings({ workDays: on ? settings.workDays.filter((x) => x !== d) : [...settings.workDays, d] })} className={`h-8 rounded-ds px-3 text-sm font-medium ${on ? "bg-ds-selected text-ds-text-selected" : "bg-ds-neutral text-ds-text-subtle hover:bg-ds-neutral-hovered"}`}>
              {days[d]}
            </button>
          );
        })}
        <label className="ml-4 flex items-center gap-2 text-sm text-ds-text-subtle">
          Day starts at <input type="time" value={settings.dayStart} onChange={(e) => updateSettings({ dayStart: e.target.value || "09:00" })} className="ds-input h-8 w-28 py-1" />
        </label>
      </div>
      <div className="flex max-w-3xl flex-wrap items-center gap-2">
        <Select value={kind} onChange={(v) => v && setKind(v as HolidayKind)} searchable={false} appearance="chip" chipLabel="Type" options={HOLIDAY_KINDS.map((k) => ({ value: k.id, label: k.name, description: k.description }))} menuClassName="w-72" />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="ds-input h-8 w-40 py-1" aria-label="First day" />
        <span className="text-xs text-ds-text-subtlest">to</span>
        <input type="date" value={to} min={date || undefined} onChange={(e) => setTo(e.target.value)} className="ds-input h-8 w-40 py-1" aria-label="Last day (optional)" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "closure" ? "Closure name" : "Holiday name"} className="ds-input h-8 w-48 py-1" onKeyDown={(e) => e.key === "Enter" && submit()} />
        <Button appearance="primary" iconBefore={<Plus />} disabled={!valid} onClick={submit}>Add</Button>
      </div>
      <ul className="mt-3 max-w-3xl divide-y divide-ds-border text-sm">
        {sortHolidays(holidays).map((h) => {
          const n = holidayDays(h);
          return (
            <li key={h.id} className="group/h flex items-center gap-3 px-2 py-1.5 hover:bg-ds-surface-hovered">
              <span className="w-72 shrink-0 whitespace-nowrap tabular-nums text-ds-text-subtle">{n > 1 ? `${fmt(h.date)} → ${fmt(holidayEnd(h))}` : fmt(h.date)}</span>
              <span className="min-w-0 flex-1 truncate">{h.name}</span>
              {h.kind === "closure" && <Lozenge appearance="moved">Closure</Lozenge>}
              <span className="w-14 shrink-0 text-right text-xs text-ds-text-subtlest">{n > 1 ? `${n} days` : ""}</span>
              <button type="button" onClick={() => remove(h.id)} className="text-ds-icon-subtle opacity-0 hover:text-ds-text-danger group-hover/h:opacity-100" aria-label="Remove"><Trash2 size={14} /></button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
