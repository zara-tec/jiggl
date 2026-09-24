"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { CalendarOff, Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import type { TimeOff } from "@/lib/types";
import { TIME_OFF_KINDS } from "@/lib/allocations";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Lozenge } from "@/components/ui/Lozenge";

/** Absences (vacation, sick leave): allocated hours are skipped on these days. */
export function TimeOffSection() {
  const users = useStore((s) => s.users);
  const me = useStore((s) => s.currentUserId);
  const timeOffs = useStore((s) => s.timeOffs);
  const add = useStore((s) => s.addTimeOff);
  const remove = useStore((s) => s.removeTimeOff);
  const [open, setOpen] = React.useState(false);
  const [userId, setUserId] = React.useState(me);
  const [from, setFrom] = React.useState(format(new Date(), "yyyy-MM-dd"));
  const [to, setTo] = React.useState(format(new Date(), "yyyy-MM-dd"));
  const [kind, setKind] = React.useState<TimeOff["kind"]>("vacation");
  const [note, setNote] = React.useState("");
  const list = [...timeOffs].sort((a, b) => b.from.localeCompare(a.from));

  return (
    <section className="mt-10">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h2 className="ds-heading-md">Time off</h2>
          <p className="text-sm text-ds-text-subtle">Vacation and sick days remove allocated hours and reduce capacity.</p>
        </div>
        <Button iconBefore={<Plus />} onClick={() => setOpen(true)}>Add time off</Button>
      </div>
      <table className="w-full max-w-3xl text-sm">
        <thead>
          <tr className="text-left text-xs text-ds-text-subtle">
            <th className="border-b border-ds-border py-2 font-semibold">Member</th>
            <th className="border-b border-ds-border py-2 font-semibold">Kind</th>
            <th className="border-b border-ds-border py-2 font-semibold">From</th>
            <th className="border-b border-ds-border py-2 font-semibold">To</th>
            <th className="border-b border-ds-border py-2 font-semibold">Note</th>
            <th className="w-10 border-b border-ds-border py-2" />
          </tr>
        </thead>
        <tbody>
          {list.map((t) => {
            const u = users.find((x) => x.id === t.userId);
            return (
              <tr key={t.id}>
                <td className="border-b border-ds-border py-2 pr-3"><span className="flex items-center gap-2"><Avatar user={u} size="xs" /> {u?.name}</span></td>
                <td className="border-b border-ds-border py-2 pr-3"><Lozenge appearance={t.kind === "sick" ? "removed" : t.kind === "vacation" ? "inprogress" : "default"}>{TIME_OFF_KINDS.find((k) => k.id === t.kind)?.name}</Lozenge></td>
                <td className="border-b border-ds-border py-2 pr-3 text-ds-text-subtle">{format(parseISO(t.from), "d MMM yyyy")}</td>
                <td className="border-b border-ds-border py-2 pr-3 text-ds-text-subtle">{format(parseISO(t.to), "d MMM yyyy")}</td>
                <td className="border-b border-ds-border py-2 pr-3 text-ds-text-subtle">{t.note}</td>
                <td className="border-b border-ds-border py-2 text-center"><button type="button" onClick={() => remove(t.id)} className="inline-flex size-6 items-center justify-center rounded-ds text-ds-icon-subtle hover:bg-ds-neutral-hovered hover:text-ds-text-danger" aria-label="Remove"><Trash2 size={14} /></button></td>
              </tr>
            );
          })}
          {list.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-ds-text-subtlest"><CalendarOff size={16} className="mr-1 inline" /> No time off recorded.</td></tr>}
        </tbody>
      </table>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add time off"
        width={460}
        footer={
          <>
            <Button appearance="subtle" onClick={() => setOpen(false)}>Cancel</Button>
            <Button appearance="primary" disabled={!from || !to || to < from} onClick={() => { add({ userId, from, to, kind, note: note.trim() || undefined }); setOpen(false); setNote(""); }}>Add</Button>
          </>
        }
      >
        <label className="mb-4 block"><span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Member</span><Select value={userId} onChange={(v) => v && setUserId(v)} options={users.map((u) => ({ value: u.id, label: u.name, icon: <Avatar user={u} size="xs" /> }))} /></label>
        <div className="grid grid-cols-2 gap-4">
          <label className="mb-4 block"><span className="mb-1 block text-xs font-semibold text-ds-text-subtle">From</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="ds-input" /></label>
          <label className="mb-4 block"><span className="mb-1 block text-xs font-semibold text-ds-text-subtle">To</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="ds-input" /></label>
        </div>
        <label className="mb-4 block"><span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Kind</span><Select value={kind} onChange={(v) => v && setKind(v as TimeOff["kind"])} searchable={false} options={TIME_OFF_KINDS.map((k) => ({ value: k.id, label: k.name }))} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Note</span><input value={note} onChange={(e) => setNote(e.target.value)} className="ds-input" placeholder="Optional" /></label>
      </Modal>
    </section>
  );
}

/** Workspace holidays (Settings): no allocation is generated on these days. */
export function HolidaysSection() {
  const holidays = useStore((s) => s.holidays);
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const add = useStore((s) => s.addHoliday);
  const remove = useStore((s) => s.removeHoliday);
  const [date, setDate] = React.useState("");
  const [name, setName] = React.useState("");
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return (
    <section>
      <h2 className="ds-heading-md mb-1">Working days and holidays</h2>
      <p className="mb-3 text-sm text-ds-text-subtle">Allocations only book hours on working days. Time off is managed per member on the Team page.</p>
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
      <div className="flex max-w-xl items-center gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="ds-input h-8 w-40 py-1" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Holiday name" className="ds-input h-8 py-1" onKeyDown={(e) => { if (e.key === "Enter" && date) { add({ date, name: name || "Holiday" }); setName(""); setDate(""); } }} />
        <Button appearance="primary" iconBefore={<Plus />} disabled={!date} onClick={() => { add({ date, name: name || "Holiday" }); setName(""); setDate(""); }}>Add</Button>
      </div>
      <ul className="mt-3 grid max-w-3xl grid-cols-2 gap-x-6 gap-y-1 text-sm md:grid-cols-3">
        {[...holidays].sort((a, b) => a.date.localeCompare(b.date)).map((h) => (
          <li key={h.id} className="group/h flex items-center justify-between rounded-ds px-2 py-1 hover:bg-ds-surface-hovered">
            <span><span className="tabular-nums text-ds-text-subtle">{format(parseISO(h.date), "EEE d MMM yyyy")}</span> · {h.name}</span>
            <button type="button" onClick={() => remove(h.id)} className="text-ds-icon-subtle opacity-0 hover:text-ds-text-danger group-hover/h:opacity-100" aria-label="Remove"><Trash2 size={14} /></button>
          </li>
        ))}
      </ul>
    </section>
  );
}
