"use client";

import * as React from "react";
import Link from "next/link";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { useStore } from "@/lib/store";
import { useNow } from "@/hooks/useHydrated";
import { entryDuration, formatDurationShort, inRange, relativeTime, weekRange } from "@/lib/utils";
import { Page } from "@/components/layout/AppShell";
import { PageHeader, ProgressBar } from "@/components/ui/misc";
import { Avatar, ProjectAvatar } from "@/components/ui/Avatar";
import { IssueTypeIcon, PriorityIcon, StatusLozenge } from "@/components/issues/icons";
import { ChartCard, HBars, StatTile } from "@/components/reports/charts";
import { IssueModal } from "@/components/issues/IssueView";
import { useEffectiveEntries } from "@/hooks/useData";

export default function DashboardsPage() {
  const issues = useStore((s) => s.issues);
  const projects = useStore((s) => s.projects);
  const sprints = useStore((s) => s.sprints);
  const users = useStore((s) => s.users);
  const entries = useEffectiveEntries();
  const me = useStore((s) => s.currentUserId);
  const now = useNow(1000, entries.some((e) => !e.stop));
  const [openIssueId, setOpenIssueId] = React.useState<string | null>(null);

  const assigned = issues.filter((i) => i.assigneeId === me && i.status !== "done").sort((a, b) => a.priority.localeCompare(b.priority));
  const { start, end } = weekRange(now);
  const week = entries.filter((e) => inRange(e.start, start, end));
  const weekTotal = week.reduce((a, e) => a + entryDuration(e, now), 0);
  const myWeek = week.filter((e) => e.userId === me).reduce((a, e) => a + entryDuration(e, now), 0);
  const perProject = projects.map((p) => ({ id: p.id, label: <><ProjectAvatar name={p.name} color={p.color} size={14} /> <span className="truncate">{p.name}</span></>, value: week.filter((e) => e.projectId === p.id).reduce((a, e) => a + entryDuration(e, now), 0), color: p.color })).filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
  const activeSprints = sprints.filter((s) => s.state === "active");
  const activity = [...issues].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8);

  return (
    <>
      <PageHeader title="System dashboard" />
      <Page>
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="Assigned to me" value={assigned.length} />
          <StatTile label="My time this week" value={formatDurationShort(myWeek)} />
          <StatTile label="Team time this week" value={formatDurationShort(weekTotal)} />
          <StatTile label="Open work items" value={issues.filter((i) => i.status !== "done" && i.type !== "epic").length} />
        </div>
        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <ChartCard title="Assigned to me" subtitle="Open work items assigned to you, by priority.">
            <ul className="divide-y divide-ds-border">
              {assigned.slice(0, 10).map((i) => (
                <li key={i.id}>
                  <button type="button" onClick={() => setOpenIssueId(i.id)} className="flex w-full items-center gap-2 py-1.5 text-left text-sm hover:bg-ds-surface-hovered">
                    <IssueTypeIcon type={i.type} size={14} />
                    <span className="w-16 shrink-0 text-xs text-ds-text-subtle">{i.key}</span>
                    <span className="min-w-0 flex-1 truncate">{i.summary}</span>
                    <PriorityIcon priority={i.priority} size={14} />
                    <StatusLozenge status={i.status} />
                  </button>
                </li>
              ))}
              {assigned.length === 0 && <li className="py-4 text-sm text-ds-text-subtlest">Nothing assigned to you. Enjoy!</li>}
            </ul>
          </ChartCard>
          <ChartCard title="Sprint health" subtitle="Progress of active sprints.">
            {activeSprints.length === 0 && <div className="text-sm text-ds-text-subtlest">No active sprints.</div>}
            <div className="space-y-4">
              {activeSprints.map((s) => {
                const p = projects.find((x) => x.id === s.projectId)!;
                const list = issues.filter((i) => i.sprintId === s.id && i.type !== "epic");
                const done = list.filter((i) => i.status === "done").length;
                const prog = list.filter((i) => i.status === "inprogress" || i.status === "inreview").length;
                const daysLeft = s.endDate ? differenceInCalendarDays(parseISO(s.endDate), now) : undefined;
                return (
                  <div key={s.id}>
                    <div className="mb-1 flex items-center gap-2 text-sm">
                      <ProjectAvatar name={p.name} color={p.color} size={16} />
                      <Link href={`/projects/${p.key}/board`} className="font-medium hover:underline">{s.name}</Link>
                      <span className="text-xs text-ds-text-subtlest">{list.length} work items</span>
                      {daysLeft !== undefined && <span className="ml-auto text-xs text-ds-text-subtlest">{daysLeft} days left</span>}
                    </div>
                    <ProgressBar segments={[{ value: done, color: "var(--ds-chart-green)", label: "Done" }, { value: prog, color: "var(--ds-chart-blue)", label: "In progress" }, { value: list.length - done - prog, color: "var(--ds-chart-track)", label: "To do" }]} height={8} />
                  </div>
                );
              })}
            </div>
          </ChartCard>
          <ChartCard title="Time this week by project" subtitle="All members, current week.">
            <HBars rows={perProject} format={formatDurationShort} labelWidth={160} />
          </ChartCard>
          <ChartCard title="Activity stream" subtitle="Latest updates across all projects.">
            <ul className="space-y-1">
              {activity.map((i) => (
                <li key={i.id}>
                  <button type="button" onClick={() => setOpenIssueId(i.id)} className="flex w-full items-center gap-3 rounded-ds px-1 py-1 text-left hover:bg-ds-neutral-subtle-hovered">
                    <Avatar user={users.find((u) => u.id === i.assigneeId) ?? users.find((u) => u.id === i.reporterId)} size="sm" />
                    <IssueTypeIcon type={i.type} size={14} />
                    <span className="min-w-0 flex-1 truncate text-sm"><span className="text-ds-text-subtle">{i.key}</span> {i.summary}</span>
                    <span className="shrink-0 text-xs text-ds-text-subtlest">{relativeTime(i.updatedAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </ChartCard>
        </div>
      </Page>
      <IssueModal issueId={openIssueId} onClose={() => setOpenIssueId(null)} />
    </>
  );
}
