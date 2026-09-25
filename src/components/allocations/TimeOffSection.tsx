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
import { pickable } from "@/lib/team";

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
        <label className="mb-4 block"><span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Member</span><Select value={userId} onChange={(v) => v && setUserId(v)} options={pickable(users, userId).map((u) => ({ value: u.id, label: u.name, icon: <Avatar user={u} size="xs" /> }))} /></label>
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
export { HolidaysSection } from "./HolidaysSection";
