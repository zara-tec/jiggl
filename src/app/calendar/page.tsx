"use client";

import * as React from "react";
import { addDays, addWeeks, differenceInMinutes, format, formatISO, isSameDay, isToday, parseISO, startOfDay, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, List, CalendarDays, Trash2, Play } from "lucide-react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { useNow } from "@/hooks/useHydrated";
import type { TimeEntry } from "@/lib/types";
import { cn, entryDuration, formatDurationClock, formatTime } from "@/lib/utils";
import { PageHeader } from "@/components/ui/misc";
import { Button, IconButton } from "@/components/ui/Button";
import { Popover } from "@/components/ui/Popover";
import { Lozenge } from "@/components/ui/Lozenge";
import { TimerBar } from "@/components/time/TimerBar";
import { BillableToggle, ProjectIssuePicker, TagsPicker } from "@/components/time/pickers";
import { useEffectiveEntries } from "@/hooks/useData";

const HOUR_H = 48;

export default function CalendarPage() {
  const me = useStore((s) => s.currentUserId);
  const entries = useEffectiveEntries({ includeFuture: true });
  const projects = useStore((s) => s.projects);
  const add = useStore((s) => s.addTimeEntry);
  const update = useStore((s) => s.updateTimeEntry);
  const now = useNow(30000, true);
  const [weekStart, setWeekStart] = React.useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selected, setSelected] = React.useState<{ id: string; el: HTMLElement } | null>(null);
  const [drag, setDrag] = React.useState<{ day: Date; from: number; to: number } | null>(null);
  const [dragMove, setDragMove] = React.useState<{ id: string; day: Date; offsetMin: number; startMin: number } | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const anchorRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = HOUR_H * 7.5;
  }, []);

  const days = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
  const mine = entries.filter((e) => e.userId === me);
  const weekEntries = mine.filter((e) => parseISO(e.start) >= weekStart && parseISO(e.start) < addDays(weekStart, 7));
  const weekTotal = weekEntries.reduce((a, e) => a + entryDuration(e, now), 0);

  const minutesFromEvent = (e: React.MouseEvent, col: HTMLElement) => {
    const rect = col.getBoundingClientRect();
    const y = e.clientY - rect.top;
    return Math.max(0, Math.min(24 * 60, Math.round(((y / HOUR_H) * 60) / 15) * 15));
  };

  const onColMouseDown = (e: React.MouseEvent<HTMLDivElement>, day: Date) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("[data-entry]")) return;
    const m = minutesFromEvent(e, e.currentTarget);
    setDrag({ day, from: m, to: m + 30 });
  };
  const onColMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (drag) {
      const m = minutesFromEvent(e, e.currentTarget);
      setDrag((d) => (d ? { ...d, to: Math.max(d.from + 15, m) } : d));
    } else if (dragMove) {
      const m = minutesFromEvent(e, e.currentTarget);
      setDragMove((d) => (d ? { ...d, startMin: Math.max(0, m - d.offsetMin) } : d));
    }
  };
  const finishDrag = () => {
    if (drag) {
      const s = new Date(startOfDay(drag.day).getTime() + drag.from * 60000);
      const e = new Date(startOfDay(drag.day).getTime() + drag.to * 60000);
      add({ description: "", tagIds: [], billable: false, start: formatISO(s), stop: formatISO(e) });
      setDrag(null);
    }
    if (dragMove) {
      const entry = entries.find((x) => x.id === dragMove.id && !x.virtual);
      if (entry && entry.stop) {
        const len = differenceInMinutes(parseISO(entry.stop), parseISO(entry.start));
        const s = new Date(startOfDay(dragMove.day).getTime() + dragMove.startMin * 60000);
        update(entry.id, { start: formatISO(s), stop: formatISO(new Date(s.getTime() + len * 60000)) });
      }
      setDragMove(null);
    }
  };

  const nowMin = now.getHours() * 60 + now.getMinutes();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Calendar"
        actions={
          <div className="flex items-center rounded-ds bg-ds-neutral p-0.5">
            <Link href="/timer" className="inline-flex h-7 items-center gap-1 rounded-[2px] px-2 text-xs font-medium text-ds-text-subtle hover:text-ds-text"><List size={14} /> List</Link>
            <span className="inline-flex h-7 items-center gap-1 rounded-[2px] bg-ds-surface px-2 text-xs font-medium shadow-ds-raised"><CalendarDays size={14} /> Calendar</span>
          </div>
        }
      />
      <div className="px-page pt-4">
        <TimerBar />
      </div>
      <div className="flex flex-wrap items-center gap-2 px-page pb-2 pt-4">
        <IconButton icon={<ChevronLeft />} label="Previous week" onClick={() => setWeekStart((w) => addWeeks(w, -1))} />
        <IconButton icon={<ChevronRight />} label="Next week" onClick={() => setWeekStart((w) => addWeeks(w, 1))} />
        <Button appearance="subtle" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>Today</Button>
        <span className="ds-heading-sm ml-2">{format(weekStart, "d MMM")} – {format(addDays(weekStart, 6), "d MMM yyyy")}</span>
        <span className="ml-auto text-sm text-ds-text-subtle">Week total <span className="tabular-nums font-semibold text-ds-text">{formatDurationClock(weekTotal)}</span></span>
      </div>
      {/* seven days need about 640px: narrower screens scroll the week sideways, header and hours together */}
      <div className="mx-[var(--page-gutter)] mb-6 flex min-h-0 flex-1 flex-col overflow-x-auto overflow-y-hidden rounded-ds-md border border-ds-border">
        <div className="grid min-w-[640px] shrink-0 grid-cols-[56px_repeat(7,1fr)] border-b border-ds-border bg-ds-surface">
          <div />
          {days.map((d) => {
            const dayList = mine.filter((e) => isSameDay(parseISO(e.start), d));
            const t = dayList.filter((e) => !e.virtual).reduce((a, e) => a + entryDuration(e, now), 0);
            const al = dayList.filter((e) => e.virtual).reduce((a, e) => a + entryDuration(e, now), 0);
            return (
              <div key={d.toISOString()} className={cn("border-l border-ds-border px-2 py-2 text-center", isToday(d) && "bg-ds-selected")}>
                <div className="text-[11px] uppercase text-ds-text-subtlest">{format(d, "EEE")}</div>
                <div className={cn("text-lg font-semibold leading-6", isToday(d) ? "text-ds-text-selected" : "text-ds-text")}>{format(d, "d")}</div>
                <div className="tabular-nums text-[11px] text-ds-text-subtle">{t ? formatDurationClock(t) : ""}{al ? <span className="text-ds-text-subtlest">{t ? " + " : ""}{formatDurationClock(al)} alloc.</span> : ""}</div>
              </div>
            );
          })}
        </div>
        <div ref={scrollRef} className="relative min-h-0 min-w-[640px] flex-1 overflow-y-auto select-none" onMouseUp={finishDrag} onMouseLeave={finishDrag}>
          <div className="grid grid-cols-[56px_repeat(7,1fr)]" style={{ height: HOUR_H * 24 }}>
            <div className="relative">
              {Array.from({ length: 24 }).map((_, h) => (
                <div key={h} className="absolute right-2 -translate-y-1/2 text-[10px] text-ds-text-subtlest" style={{ top: h * HOUR_H }}>{h === 0 ? "" : `${String(h).padStart(2, "0")}:00`}</div>
              ))}
            </div>
            {days.map((d) => {
              const dayEntries = mine.filter((e) => isSameDay(parseISO(e.start), d));
              const virtuals = dayEntries.filter((e) => e.virtual);
              const overlaps = (x: TimeEntry, y: TimeEntry) => parseISO(x.start) < parseISO(y.stop ?? now.toISOString()) && parseISO(y.start) < parseISO(x.stop ?? now.toISOString());
              return (
                <div key={d.toISOString()} className={cn("relative border-l border-ds-border", isToday(d) && "bg-ds-selected/40")} onMouseDown={(e) => onColMouseDown(e, d)} onMouseMove={onColMouseMove}>
                  {Array.from({ length: 24 }).map((_, h) => (
                    <div key={h} className="absolute inset-x-0 border-t border-ds-border" style={{ top: h * HOUR_H }} />
                  ))}
                  {dayEntries.map((e) => {
                    const s = parseISO(e.start);
                    const startMin = dragMove?.id === e.id ? dragMove.startMin : s.getHours() * 60 + s.getMinutes();
                    const len = Math.max(15, Math.round(entryDuration(e, now) / 60));
                    const p = projects.find((x) => x.id === e.projectId);
                    const running = !e.stop;
                    const besideVirtual = !e.virtual && virtuals.some((v) => overlaps(v, e));
                    return (
                      <button
                        key={e.id}
                        data-entry
                        type="button"
                        onMouseDown={(ev) => {
                          if (running || !e.stop || e.virtual) return;
                          ev.stopPropagation();
                          const col = ev.currentTarget.parentElement as HTMLElement;
                          const m = minutesFromEvent(ev, col);
                          setDragMove({ id: e.id, day: d, offsetMin: m - startMin, startMin });
                        }}
                        onClick={(ev) => {
                          anchorRef.current = ev.currentTarget;
                          setSelected({ id: e.id, el: ev.currentTarget });
                        }}
                        className={cn("absolute overflow-hidden rounded-[4px] border-l-[3px] px-1.5 py-0.5 text-left text-[11px] leading-4 shadow-sm hover:brightness-95", running && "timer-pulse", e.virtual && "border border-dashed border-l-[3px] border-l-solid")}
                        style={{ left: e.virtual ? "58%" : 4, right: e.virtual ? 4 : besideVirtual ? "44%" : 4, top: (startMin / 60) * HOUR_H, height: Math.max(18, (len / 60) * HOUR_H - 2), background: e.virtual ? `repeating-linear-gradient(135deg, ${p ? p.color + "18" : "var(--ds-chart-track)"} 0 6px, transparent 6px 12px)` : p ? `${p.color}22` : "var(--ds-chart-track)", borderColor: p?.color ?? "var(--ds-chart-gray)", color: "var(--ds-text)" }}
                        title={`${e.description || "(no description)"} · ${formatTime(e.start)} – ${e.stop ? formatTime(e.stop) : "now"}`}
                      >
                        <div className="truncate font-semibold">{e.virtual && <span className="mr-1 rounded-[2px] bg-ds-neutral px-1 text-[9px] font-bold uppercase text-ds-text-subtle">Allocated</span>}{e.description || <span className="italic text-ds-text-subtlest">(no description)</span>}</div>
                        {len >= 30 && <div className="truncate text-ds-text-subtle">{p?.name ?? "No project"} · {formatDurationClock(entryDuration(e, now))}</div>}
                      </button>
                    );
                  })}
                  {drag && isSameDay(drag.day, d) && (
                    <div className="pointer-events-none absolute left-1 right-1 rounded-[4px] bg-ds-brand-bold/20 ring-1 ring-ds-brand-bold" style={{ top: (drag.from / 60) * HOUR_H, height: ((drag.to - drag.from) / 60) * HOUR_H }}>
                      <span className="px-1 text-[10px] font-semibold text-ds-text-selected">{formatDurationClock((drag.to - drag.from) * 60)}</span>
                    </div>
                  )}
                  {isToday(d) && (
                    <div className="pointer-events-none absolute inset-x-0 z-10 h-px bg-ds-danger-bold" style={{ top: (nowMin / 60) * HOUR_H }}>
                      <span className="absolute -left-1 -top-1 size-2 rounded-full bg-ds-danger-bold" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {selected && <EntryPopover entry={entries.find((e) => e.id === selected.id)} anchorRef={anchorRef} onClose={() => setSelected(null)} />}
    </div>
  );
}

function EntryPopover({ entry, anchorRef, onClose }: { entry?: TimeEntry; anchorRef: React.RefObject<HTMLElement | null>; onClose: () => void }) {
  const update = useStore((s) => s.updateTimeEntry);
  const remove = useStore((s) => s.deleteTimeEntry);
  const cont = useStore((s) => s.continueEntry);
  const materialize = useStore((s) => s.materializeEntry);
  const projectName = useStore((s) => s.projects.find((p) => p.id === entry?.projectId)?.name);
  const [desc, setDesc] = React.useState(entry?.description ?? "");
  const [from, setFrom] = React.useState(entry ? format(parseISO(entry.start), "HH:mm") : "");
  const [to, setTo] = React.useState(entry?.stop ? format(parseISO(entry.stop), "HH:mm") : "");
  if (!entry) return null;
  if (entry.virtual) {
    return (
      <Popover open onClose={onClose} anchorRef={anchorRef} className="w-80 p-3" align="start">
        <div className="mb-1 flex items-center gap-2"><Lozenge>Allocated</Lozenge><span className="text-sm font-semibold">{entry.percent}% of the day</span></div>
        <p className="text-sm text-ds-text-subtle">{projectName ?? "Project"} books {formatDurationClock(entryDuration(entry))} of your time automatically. Convert it into a real entry to adjust this day.</p>
        <div className="mt-3 flex items-center justify-end gap-2">
          <Button appearance="subtle" onClick={onClose}>Close</Button>
          <Button appearance="primary" onClick={() => { materialize(entry); onClose(); }}>Convert to entry</Button>
        </div>
      </Popover>
    );
  }
  const patch = (p: Partial<TimeEntry>) => update(entry.id, p);
  const saveTimes = () => {
    const d = startOfDay(parseISO(entry.start));
    const [fh, fm] = from.split(":").map(Number);
    const [th, tm] = to.split(":").map(Number);
    const s = new Date(d.getTime() + (fh * 60 + fm) * 60000);
    let e = new Date(d.getTime() + (th * 60 + tm) * 60000);
    if (e <= s) e = addDays(e, 1);
    patch({ start: formatISO(s), stop: formatISO(e) });
  };
  return (
    <Popover open onClose={onClose} anchorRef={anchorRef} className="w-80 p-3" align="start">
      <input value={desc} onChange={(e) => setDesc(e.target.value)} onBlur={() => desc !== entry.description && patch({ description: desc })} placeholder="Add description" className="ds-input mb-2 h-8 py-1" autoFocus />
      <div className="mb-2 flex items-center gap-1">
        <ProjectIssuePicker projectId={entry.projectId} issueId={entry.issueId} onChange={(v) => patch(v)} />
        <TagsPicker value={entry.tagIds} onChange={(tagIds) => patch({ tagIds })} showNames={false} />
        <BillableToggle value={entry.billable} onChange={(billable) => patch({ billable })} />
      </div>
      <div className="mb-3 flex items-center gap-2 text-sm">
        <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} onBlur={saveTimes} className="ds-input h-8 w-24 py-1" />
        <span className="text-ds-text-subtlest">–</span>
        <input type="time" value={to} onChange={(e) => setTo(e.target.value)} onBlur={saveTimes} disabled={!entry.stop} className="ds-input h-8 w-24 py-1" />
        <span className="tabular-nums ml-auto font-semibold">{formatDurationClock(entryDuration(entry))}</span>
      </div>
      <div className="flex items-center justify-between">
        <Button appearance="subtle" iconBefore={<Trash2 />} className="text-ds-text-danger" onClick={() => { remove(entry.id); onClose(); }}>Delete</Button>
        <Button iconBefore={<Play />} onClick={() => { cont(entry.id); onClose(); }}>Continue</Button>
      </div>
    </Popover>
  );
}
