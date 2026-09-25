"use client";

import * as React from "react";
import { use } from "react";
import { addDays, differenceInCalendarDays, eachWeekOfInterval, format, isToday, parseISO, startOfDay, startOfWeek, subDays } from "date-fns";
import { ChevronDown, ChevronRight, FileText, Plus } from "lucide-react";
import Link from "next/link";
import { OPEN_OFFER_STATUSES } from "@/lib/offers";
import { Lozenge } from "@/components/ui/Lozenge";
import { useStore } from "@/lib/store";
import { useProjectByKey, useProjectIssues } from "@/hooks/useData";
import type { Issue } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { IssueTypeIcon, STATUS_META, epicColor } from "@/components/issues/icons";
import { IssueModal } from "@/components/issues/IssueView";

const DAY_W = 28;

export default function TimelinePage({ params }: PageProps<"/projects/[key]/timeline">) {
  const { key } = use(params);
  const project = useProjectByKey(key);
  const issues = useProjectIssues(project?.id);
  const users = useStore((s) => s.users);
  const offers = useStore((s) => s.offers);
  const openCreate = useStore((s) => s.openCreateIssue);
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [openIssueId, setOpenIssueId] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const today = startOfDay(new Date());
  const rangeStart = startOfWeek(subDays(today, 28), { weekStartsOn: 1 });
  const rangeEnd = addDays(rangeStart, 7 * 16);
  const totalDays = differenceInCalendarDays(rangeEnd, rangeStart);
  const weeks = eachWeekOfInterval({ start: rangeStart, end: rangeEnd }, { weekStartsOn: 1 });

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = Math.max(0, differenceInCalendarDays(today, rangeStart) * DAY_W - 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!project) return null;

  const span = (i: Issue, kids: Issue[]) => {
    const starts = [i.startDate, ...kids.map((k) => k.startDate ?? k.createdAt)].filter(Boolean).map((d) => parseISO(d!));
    const ends = [i.dueDate, ...kids.map((k) => k.dueDate ?? k.resolvedAt)].filter(Boolean).map((d) => parseISO(d!));
    const s = starts.length ? new Date(Math.min(...starts.map((d) => d.getTime()))) : parseISO(i.createdAt);
    const e = ends.length ? new Date(Math.max(...ends.map((d) => d.getTime()))) : addDays(s, 14);
    return { s: startOfDay(s), e: startOfDay(e < s ? addDays(s, 1) : e) };
  };

  const epics = issues.filter((i) => i.type === "epic");
  const orphans = issues.filter((i) => i.type !== "epic" && i.type !== "subtask" && (!i.parentId || !epics.some((e) => e.id === i.parentId)));

  const rows: { issue: Issue; depth: number; s: Date; e: Date; color: string }[] = [];
  epics.forEach((e) => {
    const kids = issues.filter((i) => i.parentId === e.id);
    const { s, e: end } = span(e, kids);
    rows.push({ issue: e, depth: 0, s, e: end, color: epicColor(e.id) });
    if (expanded[e.id]) {
      kids.forEach((k) => {
        const ks = span(k, []);
        rows.push({ issue: k, depth: 1, s: ks.s, e: ks.e, color: STATUS_META[k.status].color });
      });
    }
  });
  orphans.forEach((k) => {
    const ks = span(k, []);
    rows.push({ issue: k, depth: 0, s: ks.s, e: ks.e, color: STATUS_META[k.status].color });
  });

  const left = (d: Date) => Math.max(0, differenceInCalendarDays(d, rangeStart)) * DAY_W;

  // Planned lines from open offers (not yet converted): shown as dashed bars
  const planned = offers
    .filter((o) => o.projectId === project.id && OPEN_OFFER_STATUSES.includes(o.status))
    .flatMap((o) =>
      o.lines
        .filter((l) => !l.issueId && l.plannedStart && l.plannedEnd)
        .map((l) => ({ id: l.id, offer: o, line: l, s: startOfDay(parseISO(l.plannedStart!)), e: startOfDay(parseISO(l.plannedEnd!)) })),
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 px-page pb-3 pt-4">
        <span className="text-xs text-ds-text-subtlest">Epics and their child work items across time. Dashed bars are planned lines from open offers, not yet converted into work.</span>
        <div className="ml-auto flex items-center gap-2">
          <Button appearance="subtle" onClick={() => scrollRef.current?.scrollTo({ left: Math.max(0, differenceInCalendarDays(today, rangeStart) * DAY_W - 300), behavior: "smooth" })}>Today</Button>
          <Button appearance="primary" iconBefore={<Plus />} onClick={() => openCreate({ projectId: project.id, type: "epic" })}>Create epic</Button>
        </div>
      </div>
      <div className="mx-[var(--page-gutter)] mb-6 flex min-h-0 flex-1 overflow-hidden rounded-ds-md border border-ds-border">
        {/* left list */}
        <div className="w-44 shrink-0 border-r border-ds-border bg-ds-surface sm:w-80">
          <div className="flex h-12 items-center border-b border-ds-border px-3 text-xs font-semibold text-ds-text-subtle">Work item</div>
          <div className="overflow-hidden">
            {rows.map((r) => (
              <div key={r.issue.id} className="flex h-10 items-center gap-1.5 border-b border-ds-border px-2 text-sm hover:bg-ds-surface-hovered" style={{ paddingLeft: 8 + r.depth * 20 }}>
                {r.issue.type === "epic" ? (
                  <button type="button" onClick={() => setExpanded((x) => ({ ...x, [r.issue.id]: !x[r.issue.id] }))} className="inline-flex size-5 items-center justify-center rounded-ds text-ds-icon hover:bg-ds-neutral-hovered">
                    {expanded[r.issue.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                ) : (
                  <span className="w-5" />
                )}
                <IssueTypeIcon type={r.issue.type} size={14} />
                <button type="button" onClick={() => setOpenIssueId(r.issue.id)} className="min-w-0 flex-1 truncate text-left hover:underline">{r.issue.summary}</button>
                <Avatar user={users.find((u) => u.id === r.issue.assigneeId)} size="xs" />
              </div>
            ))}
            {planned.map((p) => (
              <div key={p.id} className="flex h-10 items-center gap-1.5 border-b border-ds-border px-2 text-sm hover:bg-ds-surface-hovered">
                <span className="w-5" />
                <FileText size={14} className="shrink-0 text-ds-icon-subtle" />
                <Link href={`/projects/${project.key}/offers/${p.offer.id}`} className="min-w-0 flex-1 truncate text-ds-text-subtle hover:underline">{p.line.description || `Line ${p.line.order}`}</Link>
                <Lozenge appearance="new">{p.offer.number}</Lozenge>
              </div>
            ))}
            {rows.length === 0 && planned.length === 0 && <div className="px-3 py-6 text-sm text-ds-text-subtlest">No epics yet. Create one to plan on the timeline.</div>}
          </div>
        </div>
        {/* chart */}
        <div ref={scrollRef} className="relative min-w-0 flex-1 overflow-auto bg-ds-surface">
          <div style={{ width: totalDays * DAY_W }} className="relative">
            <div className="sticky top-0 z-10 flex h-12 border-b border-ds-border bg-ds-surface">
              {weeks.map((w) => (
                <div key={w.toISOString()} className="shrink-0 border-r border-ds-border px-2 py-1 text-[11px] text-ds-text-subtlest" style={{ width: DAY_W * 7 }}>
                  <div className="font-semibold text-ds-text-subtle">{format(w, "MMM")}</div>
                  <div>{format(w, "d")} – {format(addDays(w, 6), "d")}</div>
                </div>
              ))}
            </div>
            {/* weekend shading */}
            {Array.from({ length: totalDays }).map((_, i) => {
              const d = addDays(rangeStart, i);
              const we = d.getDay() === 0 || d.getDay() === 6;
              return we ? <div key={i} className="absolute bottom-0 top-12 bg-ds-surface-sunken" style={{ left: i * DAY_W, width: DAY_W }} /> : null;
            })}
            {/* today */}
            <div className="absolute bottom-0 top-12 z-[5] w-px bg-ds-danger-bold" style={{ left: differenceInCalendarDays(today, rangeStart) * DAY_W + DAY_W / 2 }}>
              <span className="absolute -left-4 -top-1 rounded-full bg-ds-danger-bold px-1 text-[9px] font-bold text-ds-text-on-brand">Today</span>
            </div>
            {rows.map((r) => {
              const l = left(r.s);
              const w = Math.max(DAY_W, (differenceInCalendarDays(r.e, r.s) + 1) * DAY_W);
              return (
                <div key={r.issue.id} className="relative h-10 border-b border-ds-border">
                  <button
                    type="button"
                    onClick={() => setOpenIssueId(r.issue.id)}
                    title={`${r.issue.key}: ${format(r.s, "d MMM")} – ${format(r.e, "d MMM")}`}
                    className={cn("absolute top-2 flex h-6 items-center truncate rounded-[4px] px-2 text-xs font-medium hover:brightness-95", r.issue.type === "epic" ? "text-white" : "text-ds-text-on-brand", r.depth > 0 && "top-2.5 h-5 opacity-90")}
                    style={{ left: l, width: w, background: r.color }}
                  >
                    <span className="truncate">{r.issue.summary}</span>
                  </button>
                </div>
              );
            })}
            {planned.map((p) => {
              const l = left(p.s);
              const w = Math.max(DAY_W, (differenceInCalendarDays(p.e, p.s) + 1) * DAY_W);
              return (
                <div key={p.id} className="relative h-10 border-b border-ds-border">
                  <Link
                    href={`/projects/${project.key}/offers/${p.offer.id}`}
                    title={`Planned in ${p.offer.number}: ${format(p.s, "d MMM")} – ${format(p.e, "d MMM")} · ${p.line.hours}h`}
                    className="absolute top-2 flex h-6 items-center truncate rounded-[4px] border-2 border-dashed border-ds-accent-purple-text bg-ds-accent-purple-subtler px-2 text-xs font-medium text-ds-accent-purple-text hover:brightness-95"
                    style={{ left: l, width: w }}
                  >
                    <span className="truncate">{p.line.description || `Line ${p.line.order}`} · {p.line.hours}h</span>
                  </Link>
                </div>
              );
            })}
            {Array.from({ length: totalDays }).map((_, i) => (isToday(addDays(rangeStart, i)) ? null : null))}
          </div>
        </div>
      </div>
      <IssueModal issueId={openIssueId} onClose={() => setOpenIssueId(null)} />
    </div>
  );
}
