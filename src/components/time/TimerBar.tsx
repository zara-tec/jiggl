"use client";

import * as React from "react";
import { format, parse, setHours, setMinutes, startOfDay, addDays, formatISO } from "date-fns";
import { List, Play, Plus, Square, Timer as TimerIcon, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { useNow } from "@/hooks/useHydrated";
import { useRunningEntry } from "@/hooks/useData";
import { cn, entryDuration, formatDurationClock, parseDuration } from "@/lib/utils";
import { BillableToggle, ProjectIssuePicker, TagsPicker } from "./pickers";

export function TimerBar({ className }: { className?: string }) {
  const running = useRunningEntry();
  const draft = useStore((s) => s.ui.timerDraft);
  const setDraft = useStore((s) => s.setTimerDraft);
  const mode = useStore((s) => s.ui.timerMode);
  const setMode = useStore((s) => s.setTimerMode);
  const start = useStore((s) => s.startTimer);
  const stop = useStore((s) => s.stopTimer);
  const discard = useStore((s) => s.discardTimer);
  const updateRunning = useStore((s) => s.updateRunning);
  const addEntry = useStore((s) => s.addTimeEntry);
  const projects = useStore((s) => s.projects);
  const now = useNow(1000, !!running);

  // manual mode state
  const [date, setDate] = React.useState(() => format(new Date(), "yyyy-MM-dd"));
  const [from, setFrom] = React.useState("09:00");
  const [to, setTo] = React.useState("10:00");
  const [durationText, setDurationText] = React.useState("1:00:00");

  const manualSeconds = React.useMemo(() => {
    const d = parse(date, "yyyy-MM-dd", new Date());
    const a = parse(from, "HH:mm", d);
    let b = parse(to, "HH:mm", d);
    if (b <= a) b = addDays(b, 1);
    return Math.round((b.getTime() - a.getTime()) / 1000);
  }, [date, from, to]);

  React.useEffect(() => setDurationText(formatDurationClock(manualSeconds)), [manualSeconds]);

  const values = running
    ? { description: running.description, projectId: running.projectId, issueId: running.issueId, tagIds: running.tagIds, billable: running.billable }
    : draft;

  const patch = (p: Partial<typeof values>) => {
    if (running) updateRunning(p);
    else setDraft(p);
  };

  const onPickProject = (v: { projectId?: string; issueId?: string }) => {
    const project = projects.find((p) => p.id === v.projectId);
    const p: Partial<typeof values> = { ...v };
    if (project && !running && !draft.billable) p.billable = project.billable;
    patch(p);
  };

  const submitManual = () => {
    const d = parse(date, "yyyy-MM-dd", new Date());
    const [fh, fm] = from.split(":").map(Number);
    const startAt = setMinutes(setHours(startOfDay(d), fh), fm);
    const stopAt = new Date(startAt.getTime() + manualSeconds * 1000);
    addEntry({ ...draft, start: formatISO(startAt), stop: formatISO(stopAt) });
    setDraft({ description: "", issueId: undefined, tagIds: [] });
  };

  const applyDurationText = () => {
    const secs = parseDuration(durationText);
    if (secs === undefined) return setDurationText(formatDurationClock(manualSeconds));
    const d = parse(date, "yyyy-MM-dd", new Date());
    const a = parse(from, "HH:mm", d);
    const b = new Date(a.getTime() + secs * 1000);
    setTo(format(b, "HH:mm"));
  };

  const isManual = mode === "manual" && !running;

  return (
    <div className={cn("flex h-[66px] items-center gap-1 rounded-ds-lg bg-ds-surface px-4 shadow-[0_1px_1px_rgba(9,30,66,0.25),0_0_1px_rgba(9,30,66,0.31)]", className)}>
      <input
        value={values.description}
        onChange={(e) => patch({ description: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !running) {
            if (isManual) submitManual();
            else start();
          }
        }}
        placeholder={isManual ? "What have you done?" : "What are you working on?"}
        className="h-10 min-w-0 flex-1 bg-transparent text-[16px] text-ds-text outline-none placeholder:text-ds-text-subtlest"
      />
      <ProjectIssuePicker projectId={values.projectId} issueId={values.issueId} onChange={onPickProject} />
      <TagsPicker value={values.tagIds} onChange={(tagIds) => patch({ tagIds })} showNames={false} />
      <BillableToggle value={values.billable} onChange={(billable) => patch({ billable })} />
      <div className="mx-1 h-8 w-px bg-ds-border" />

      {isManual ? (
        <div className="flex items-center gap-1.5">
          <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-[74px] rounded-ds border border-transparent bg-transparent px-1 text-center text-sm hover:bg-ds-neutral-subtle-hovered focus:border-ds-border-focused focus:outline-none" />
          <span className="text-ds-text-subtlest">-</span>
          <input type="time" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-[74px] rounded-ds border border-transparent bg-transparent px-1 text-center text-sm hover:bg-ds-neutral-subtle-hovered focus:border-ds-border-focused focus:outline-none" />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 w-[130px] rounded-ds border border-transparent bg-transparent px-1 text-sm hover:bg-ds-neutral-subtle-hovered focus:border-ds-border-focused focus:outline-none" />
          <input
            value={durationText}
            onChange={(e) => setDurationText(e.target.value)}
            onBlur={applyDurationText}
            onKeyDown={(e) => e.key === "Enter" && applyDurationText()}
            className="tabular-nums h-8 w-[84px] rounded-ds border border-transparent bg-transparent px-1 text-right text-lg font-semibold hover:bg-ds-neutral-subtle-hovered focus:border-ds-border-focused focus:outline-none"
          />
        </div>
      ) : (
        <span className="tabular-nums w-[92px] px-1 text-right text-lg font-semibold text-ds-text">{running ? formatDurationClock(entryDuration(running, now)) : "0:00:00"}</span>
      )}

      {running ? (
        <div className="ml-2 flex items-center gap-1">
          <button type="button" onClick={stop} title="Stop" className="inline-flex size-10 items-center justify-center rounded-full bg-ds-danger-bold text-ds-text-on-brand hover:bg-ds-danger-bold-hovered">
            <Square size={14} fill="currentColor" />
          </button>
          <button type="button" onClick={discard} title="Discard" className="inline-flex size-8 items-center justify-center rounded-ds text-ds-icon-subtle hover:bg-ds-neutral-subtle-hovered hover:text-ds-text-danger">
            <Trash2 size={16} />
          </button>
        </div>
      ) : isManual ? (
        <button type="button" onClick={submitManual} title="Add time entry" className="ml-2 inline-flex size-10 items-center justify-center rounded-full bg-ds-brand-bold text-ds-text-on-brand hover:bg-ds-brand-bold-hovered">
          <Plus size={18} strokeWidth={2.5} />
        </button>
      ) : (
        <button type="button" onClick={() => start()} title="Start timer" className="ml-2 inline-flex size-10 items-center justify-center rounded-full bg-ds-brand-bold text-ds-text-on-brand hover:bg-ds-brand-bold-hovered">
          <Play size={16} fill="currentColor" className="ml-0.5" />
        </button>
      )}

      {!running && (
        <div className="ml-2 flex flex-col gap-0.5">
          <button type="button" onClick={() => setMode("timer")} title="Timer mode" className={cn("inline-flex size-5 items-center justify-center rounded-[3px]", mode === "timer" ? "bg-ds-neutral text-ds-text" : "text-ds-icon-subtle hover:text-ds-text")}>
            <TimerIcon size={13} />
          </button>
          <button type="button" onClick={() => setMode("manual")} title="Manual mode" className={cn("inline-flex size-5 items-center justify-center rounded-[3px]", mode === "manual" ? "bg-ds-neutral text-ds-text" : "text-ds-icon-subtle hover:text-ds-text")}>
            <List size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
