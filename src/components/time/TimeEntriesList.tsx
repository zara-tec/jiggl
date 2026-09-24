"use client";

import * as React from "react";
import Link from "next/link";
import { format, parseISO, parse, setHours, setMinutes, startOfDay, formatISO, addDays } from "date-fns";
import { ChevronDown, ChevronRight, Copy, ExternalLink, MoreHorizontal, Play, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import type { TimeEntry } from "@/lib/types";
import { useNow } from "@/hooks/useHydrated";
import { cn, dayKey, entryDuration, formatDayLabel, formatDurationClock, formatTime, parseDuration } from "@/lib/utils";
import { DropdownMenu, MenuItem, Popover } from "@/components/ui/Popover";
import { Lozenge } from "@/components/ui/Lozenge";
import { Avatar } from "@/components/ui/Avatar";
import { BillableToggle, ProjectIssuePicker, TagsPicker } from "./pickers";

export interface TimeEntriesListProps {
  entries: TimeEntry[];
  showUser?: boolean;
  className?: string;
  emptyText?: string;
}

/** Time entries grouped by day, with similar entries grouped together. */
export function TimeEntriesList({ entries, showUser, className, emptyText = "No time entries in this period." }: TimeEntriesListProps) {
  const now = useNow(1000, entries.some((e) => !e.stop));
  const groups = React.useMemo(() => {
    const byDay = new Map<string, TimeEntry[]>();
    [...entries]
      .filter((e) => e.stop)
      .sort((a, b) => b.start.localeCompare(a.start))
      .forEach((e) => {
        const k = dayKey(e.start);
        byDay.set(k, [...(byDay.get(k) ?? []), e]);
      });
    return Array.from(byDay.entries());
  }, [entries]);

  if (groups.length === 0) return <div className={cn("rounded-ds-lg border border-dashed border-ds-border px-6 py-10 text-center text-sm text-ds-text-subtlest", className)}>{emptyText}</div>;

  return (
    <div className={cn("space-y-4", className)}>
      {groups.map(([day, list]) => {
        const total = list.reduce((a, e) => a + entryDuration(e, now), 0);
        // group similar
        const sim = new Map<string, TimeEntry[]>();
        list.forEach((e) => {
          const k = `${e.description}|${e.projectId ?? ""}|${e.issueId ?? ""}|${e.billable}|${e.userId}|${e.virtual ? "v" : "r"}`;
          sim.set(k, [...(sim.get(k) ?? []), e]);
        });
        return (
          <section key={day} className="overflow-hidden rounded-ds-lg bg-ds-surface shadow-ds-raised">
            <header className="flex h-11 items-center justify-between bg-ds-surface-sunken px-4 text-sm">
              <span className="font-semibold text-ds-text">{formatDayLabel(list[0].start)}</span>
              <span className="flex items-center gap-2 text-ds-text-subtle">
                <span className="text-xs uppercase tracking-wide text-ds-text-subtlest">Total</span>
                <span className="tabular-nums font-semibold text-ds-text">{formatDurationClock(total)}</span>
              </span>
            </header>
            <div className="divide-y divide-ds-border">
              {Array.from(sim.values()).map((grp) => (grp.length > 1 ? <GroupedRows key={grp[0].id} entries={grp} showUser={showUser} /> : <EntryRow key={grp[0].id} entry={grp[0]} showUser={showUser} />))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function GroupedRows({ entries, showUser }: { entries: TimeEntry[]; showUser?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const total = entries.reduce((a, e) => a + entryDuration(e), 0);
  const first = entries[0];
  const last = entries[entries.length - 1];
  return (
    <div>
      <EntryRow
        entry={first}
        showUser={showUser}
        groupCount={entries.length}
        groupOpen={open}
        onToggleGroup={() => setOpen((o) => !o)}
        overrideTimes={`${formatTime(last.start)} - ${formatTime(first.stop!)}`}
        overrideDuration={total}
      />
      {open && (
        <div className="bg-ds-surface-sunken/60">
          {entries.map((e) => (
            <EntryRow key={e.id} entry={e} showUser={showUser} nested />
          ))}
        </div>
      )}
    </div>
  );
}

function EntryRow({
  entry,
  showUser,
  nested,
  groupCount,
  groupOpen,
  onToggleGroup,
  overrideTimes,
  overrideDuration,
}: {
  entry: TimeEntry;
  showUser?: boolean;
  nested?: boolean;
  groupCount?: number;
  groupOpen?: boolean;
  onToggleGroup?: () => void;
  overrideTimes?: string;
  overrideDuration?: number;
}) {
  const update = useStore((s) => s.updateTimeEntry);
  const remove = useStore((s) => s.deleteTimeEntry);
  const cont = useStore((s) => s.continueEntry);
  const add = useStore((s) => s.addTimeEntry);
  const user = useStore((s) => s.users.find((u) => u.id === entry.userId));
  const issue = useStore((s) => (entry.issueId ? s.issues.find((i) => i.id === entry.issueId) : undefined));
  const allTags = useStore((s) => s.tags);
  const tags = allTags.filter((t) => entry.tagIds.includes(t.id));
  const [desc, setDesc] = React.useState(entry.description);
  React.useEffect(() => setDesc(entry.description), [entry.description]);

  const isGroup = !!groupCount && !nested;
  const duration = overrideDuration ?? entryDuration(entry);

  const patchGroup = (p: Partial<TimeEntry>) => update(entry.id, p);

  if (entry.virtual) return <VirtualRow entry={entry} showUser={showUser} nested={nested} groupCount={groupCount} groupOpen={groupOpen} onToggleGroup={onToggleGroup} overrideTimes={overrideTimes} overrideDuration={overrideDuration} />;

  return (
    <div className={cn("group/row flex h-12 items-center gap-2 px-4 hover:bg-ds-surface-hovered", nested && "pl-12")}>
      {isGroup ? (
        <button type="button" onClick={onToggleGroup} className="inline-flex h-6 min-w-6 items-center justify-center gap-0.5 rounded-ds border border-ds-border-bold px-1 text-xs font-semibold text-ds-text-subtle hover:bg-ds-neutral-subtle-hovered">
          {groupCount}
          {groupOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
      ) : (
        showUser && <Avatar user={user} size="sm" title={user?.name} />
      )}
      <input
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        onBlur={() => desc !== entry.description && patchGroup({ description: desc })}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        placeholder="Add description"
        className="h-8 min-w-0 flex-1 truncate rounded-ds border border-transparent bg-transparent px-1.5 text-sm text-ds-text hover:border-ds-border focus:border-ds-border-focused focus:outline-none placeholder:italic placeholder:text-ds-text-subtlest"
      />
      <ProjectIssuePicker projectId={entry.projectId} issueId={entry.issueId} onChange={(v) => patchGroup(v)} className="shrink-0" />
      {issue && (
        <Link href={`/browse/${issue.key}`} className="hidden shrink-0 text-ds-icon-subtle hover:text-ds-link lg:inline-flex" title={`Open ${issue.key}`}>
          <ExternalLink size={14} />
        </Link>
      )}
      <div className="flex w-32 shrink-0 items-center justify-end gap-0.5">
        <TagsPicker value={entry.tagIds} onChange={(tagIds) => patchGroup({ tagIds })} showNames={false} />
        {tags.length > 0 && <span className="hidden max-w-24 truncate text-xs text-ds-text-subtle xl:inline">{tags.map((t) => t.name).join(", ")}</span>}
        <BillableToggle value={entry.billable} onChange={(billable) => patchGroup({ billable })} />
      </div>
      <TimesEditor entry={entry} disabled={isGroup} label={overrideTimes} />
      <DurationEditor entry={entry} seconds={duration} disabled={isGroup} />
      <div className="flex w-16 shrink-0 items-center justify-end gap-0.5">
        <button type="button" onClick={() => cont(entry.id)} title="Continue" className="inline-flex size-7 items-center justify-center rounded-full text-ds-icon-subtle opacity-0 hover:bg-ds-neutral-subtle-hovered hover:text-ds-text group-hover/row:opacity-100">
          <Play size={14} fill="currentColor" />
        </button>
        <DropdownMenu
          align="end"
          trigger={({ ref, toggle, open }) => (
            <button ref={ref} type="button" onClick={toggle} className={cn("inline-flex size-7 items-center justify-center rounded-ds text-ds-icon-subtle hover:bg-ds-neutral-subtle-hovered hover:text-ds-text", open ? "opacity-100" : "opacity-0 group-hover/row:opacity-100")}>
              <MoreHorizontal size={16} />
            </button>
          )}
        >
          {({ close }) => (
            <>
              {issue && (
                <Link href={`/browse/${issue.key}`} onClick={close}>
                  <MenuItem icon={<ExternalLink />}>Open {issue.key}</MenuItem>
                </Link>
              )}
              <MenuItem
                icon={<Copy />}
                onClick={() => {
                  add({ ...entry, userId: entry.userId });
                  close();
                }}
              >
                Duplicate
              </MenuItem>
              <MenuItem
                icon={<Trash2 />}
                className="text-ds-text-danger"
                onClick={() => {
                  remove(entry.id);
                  close();
                }}
              >
                Delete
              </MenuItem>
            </>
          )}
        </DropdownMenu>
      </div>
    </div>
  );
}

function VirtualRow({ entry, showUser, nested, groupCount, groupOpen, onToggleGroup, overrideTimes, overrideDuration }: { entry: TimeEntry; showUser?: boolean; nested?: boolean; groupCount?: number; groupOpen?: boolean; onToggleGroup?: () => void; overrideTimes?: string; overrideDuration?: number }) {
  const user = useStore((s) => s.users.find((u) => u.id === entry.userId));
  const project = useStore((s) => s.projects.find((p) => p.id === entry.projectId));
  const materialize = useStore((s) => s.materializeEntry);
  const isGroup = !!groupCount && !nested;
  return (
    <div className={cn("group/row flex h-12 items-center gap-2 px-4 hover:bg-ds-surface-hovered", nested && "pl-12")}>
      {isGroup ? (
        <button type="button" onClick={onToggleGroup} className="inline-flex h-6 min-w-6 items-center justify-center gap-0.5 rounded-ds border border-ds-border-bold px-1 text-xs font-semibold text-ds-text-subtle hover:bg-ds-neutral-subtle-hovered">
          {groupCount}
          {groupOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
      ) : (
        showUser && <Avatar user={user} size="sm" title={user?.name} />
      )}
      <span className="flex min-w-0 flex-1 items-center gap-2 px-1.5 text-sm">
        <Lozenge>Allocated</Lozenge>
        <span className="truncate text-ds-text-subtle">{entry.description}</span>
        <span className="shrink-0 text-xs text-ds-text-subtlest">{entry.percent}% of the day</span>
      </span>
      {project && (
        <span className="inline-flex h-8 max-w-[260px] items-center gap-1.5 px-2 text-sm font-medium">
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: project.color }} />
          <span className="truncate" style={{ color: project.color }}>{project.name}</span>
        </span>
      )}
      <span className="w-32 shrink-0" />
      <span className="tabular-nums hidden w-[118px] shrink-0 px-1.5 text-right text-sm text-ds-text-subtlest md:inline-block">{overrideTimes ?? `${formatTime(entry.start)} - ${entry.stop ? formatTime(entry.stop) : "now"}`}</span>
      <span className="tabular-nums w-[84px] shrink-0 px-1.5 text-right text-sm font-semibold text-ds-text-subtle">{formatDurationClock(overrideDuration ?? entryDuration(entry))}</span>
      <div className="flex w-16 shrink-0 items-center justify-end">
        {!isGroup && (
          <button type="button" onClick={() => materialize(entry)} title="Convert to a real entry you can edit" className="rounded-ds px-1.5 text-xs text-ds-link opacity-0 hover:underline group-hover/row:opacity-100">
            Edit
          </button>
        )}
      </div>
    </div>
  );
}

function TimesEditor({ entry, disabled, label }: { entry: TimeEntry; disabled?: boolean; label?: string }) {
  const update = useStore((s) => s.updateTimeEntry);
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLButtonElement>(null);
  const [date, setDate] = React.useState(format(parseISO(entry.start), "yyyy-MM-dd"));
  const [from, setFrom] = React.useState(format(parseISO(entry.start), "HH:mm"));
  const [to, setTo] = React.useState(entry.stop ? format(parseISO(entry.stop), "HH:mm") : "");

  React.useEffect(() => {
    if (open) {
      setDate(format(parseISO(entry.start), "yyyy-MM-dd"));
      setFrom(format(parseISO(entry.start), "HH:mm"));
      setTo(entry.stop ? format(parseISO(entry.stop), "HH:mm") : "");
    }
  }, [open, entry.start, entry.stop]);

  const save = () => {
    const d = parse(date, "yyyy-MM-dd", new Date());
    const [fh, fm] = from.split(":").map(Number);
    const [th, tm] = to.split(":").map(Number);
    const s = setMinutes(setHours(startOfDay(d), fh), fm);
    let e = setMinutes(setHours(startOfDay(d), th), tm);
    if (e <= s) e = addDays(e, 1);
    update(entry.id, { start: formatISO(s), stop: formatISO(e) });
    setOpen(false);
  };

  return (
    <>
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn("tabular-nums hidden w-[118px] shrink-0 rounded-ds px-1.5 text-right text-sm text-ds-text-subtle md:inline-block", !disabled && "hover:bg-ds-neutral-subtle-hovered")}
      >
        {label ?? `${formatTime(entry.start)} - ${entry.stop ? formatTime(entry.stop) : "now"}`}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={ref} align="end" className="w-72 p-3">
        <div className="mb-2 grid grid-cols-2 gap-2">
          <label className="text-xs font-semibold text-ds-text-subtle">
            Start
            <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} className="ds-input mt-1 h-8 py-1" />
          </label>
          <label className="text-xs font-semibold text-ds-text-subtle">
            Stop
            <input type="time" value={to} onChange={(e) => setTo(e.target.value)} className="ds-input mt-1 h-8 py-1" />
          </label>
        </div>
        <label className="text-xs font-semibold text-ds-text-subtle">
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="ds-input mt-1 h-8 py-1" />
        </label>
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className="h-8 rounded-ds px-3 text-sm hover:bg-ds-neutral-subtle-hovered">
            Cancel
          </button>
          <button type="button" onClick={save} className="h-8 rounded-ds bg-ds-brand-bold px-3 text-sm font-medium text-white hover:bg-ds-brand-bold-hovered">
            Save
          </button>
        </div>
      </Popover>
    </>
  );
}

function DurationEditor({ entry, seconds, disabled }: { entry: TimeEntry; seconds: number; disabled?: boolean }) {
  const update = useStore((s) => s.updateTimeEntry);
  const [text, setText] = React.useState(formatDurationClock(seconds));
  const [editing, setEditing] = React.useState(false);
  React.useEffect(() => {
    if (!editing) setText(formatDurationClock(seconds));
  }, [seconds, editing]);

  const commit = () => {
    setEditing(false);
    const secs = parseDuration(text);
    if (secs === undefined || secs === seconds) return setText(formatDurationClock(seconds));
    const start = parseISO(entry.start);
    update(entry.id, { stop: formatISO(new Date(start.getTime() + secs * 1000)) });
  };

  return (
    <input
      value={text}
      disabled={disabled}
      onFocus={() => setEditing(true)}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className={cn("tabular-nums h-8 w-[84px] shrink-0 rounded-ds border border-transparent bg-transparent px-1.5 text-right text-sm font-semibold text-ds-text focus:border-ds-border-focused focus:outline-none", !disabled && "hover:border-ds-border")}
    />
  );
}
