"use client";

import * as React from "react";
import { use } from "react";
import Link from "next/link";
import { addDays, parseISO, startOfDay, subDays } from "date-fns";
import { CalendarClock, CheckCircle2, FilePlus2, RefreshCw, Clock } from "lucide-react";
import { useStore } from "@/lib/store";
import { useProjectByKey, useProjectIssues, useProjectSprints, useEffectiveEntries } from "@/hooks/useData";
import { STATUSES, PRIORITIES, ISSUE_TYPES, type IssueStatus } from "@/lib/types";
import { entryDuration, formatDurationShort, relativeTime } from "@/lib/utils";
import { formatMoney, valueEntries } from "@/lib/rates";
import { Page } from "@/components/layout/AppShell";
import { Avatar } from "@/components/ui/Avatar";
import { ProgressBar } from "@/components/ui/misc";
import { IssueTypeIcon, STATUS_META, StatusLozenge, PriorityIcon } from "@/components/issues/icons";
import { ChartCard, ColumnChart, Donut, HBars, StatTile } from "@/components/reports/charts";

export default function SummaryPage({ params }: PageProps<"/projects/[key]/summary">) {
  const { key } = use(params);
  const project = useProjectByKey(key);
  const issues = useProjectIssues(project?.id);
  const sprints = useProjectSprints(project?.id);
  const users = useStore((s) => s.users);
  const entries = useEffectiveEntries();
  const projects = useStore((s) => s.projects);
  const settings = useStore((s) => s.settings);
  if (!project) return null;

  const now = new Date();
  const weekAgo = subDays(startOfDay(now), 7);
  const work = issues.filter((i) => i.type !== "epic");
  const done7 = work.filter((i) => i.resolvedAt && parseISO(i.resolvedAt) >= weekAgo).length;
  const updated7 = work.filter((i) => parseISO(i.updatedAt) >= weekAgo).length;
  const created7 = work.filter((i) => parseISO(i.createdAt) >= weekAgo).length;
  const dueSoon = work.filter((i) => i.status !== "done" && i.dueDate && parseISO(i.dueDate) <= addDays(startOfDay(now), 7)).length;

  const statusData = STATUSES.map((s) => ({ id: s.id, name: s.name, value: work.filter((i) => i.status === s.id).length, color: STATUS_META[s.id as IssueStatus].color }));
  const priorityValues: Record<string, Record<string, number>> = {};
  PRIORITIES.forEach((p) => (priorityValues[p.id] = { count: work.filter((i) => i.priority === p.id && i.status !== "done").length }));
  const typeRows = ISSUE_TYPES.filter((t) => t.id !== "epic").map((t) => ({ id: t.id, label: <><IssueTypeIcon type={t.id} size={14} /> {t.name}</>, value: work.filter((i) => i.type === t.id).length }));
  const recent = [...work].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);
  const openWork = work.filter((i) => i.status !== "done");
  const workload = users
    .map((u) => ({ u, count: openWork.filter((i) => i.assigneeId === u.id).length }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);
  const unassigned = openWork.filter((i) => !i.assigneeId).length;

  const projectEntries = entries.filter((e) => e.projectId === project.id);
  const entries14 = projectEntries.filter((e) => parseISO(e.start) >= subDays(startOfDay(now), 14));
  const value = valueEntries(projectEntries, users, projects, now);
  const totalLogged = value.seconds;
  const billable = value.billableSeconds;
  const perMember = users
    .map((u) => ({ id: u.id, label: <><Avatar user={u} size="xs" /> <span className="truncate">{u.name}</span></>, value: entries14.filter((e) => e.userId === u.id).reduce((a, e) => a + entryDuration(e, now), 0) }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);
  const epics = issues.filter((i) => i.type === "epic");
  const activeSprint = sprints.find((s) => s.state === "active");

  return (
    <Page>
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="done in the last 7 days" value={done7} icon={<CheckCircle2 className="text-ds-text-success" />} iconBg="var(--ds-bg-success)" />
        <StatTile label="updated in the last 7 days" value={updated7} icon={<RefreshCw className="text-ds-text-information" />} iconBg="var(--ds-bg-information)" />
        <StatTile label="created in the last 7 days" value={created7} icon={<FilePlus2 className="text-ds-text-discovery" />} iconBg="var(--ds-bg-discovery)" />
        <StatTile label="due in the next 7 days" value={dueSoon} icon={<CalendarClock className="text-ds-text-warning" />} iconBg="var(--ds-bg-warning)" href={`/projects/${project.key}/list?status=open`} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard title="Status overview" subtitle="Get a snapshot of the status of your work items." action={<Link href={`/projects/${project.key}/list`} className="text-xs text-ds-link hover:underline">View all work items</Link>}>
          <Donut data={statusData} format={(v) => String(v)} centerLabel="Total work items" />
        </ChartCard>

        <ChartCard title="Recent activity" subtitle="Stay up to date with what's happening across the project.">
          <ul className="space-y-1">
            {recent.map((i) => {
              const who = users.find((u) => u.id === i.assigneeId) ?? users.find((u) => u.id === i.reporterId);
              return (
                <li key={i.id}>
                  <Link href={`/browse/${i.key}`} className="flex items-center gap-3 rounded-ds px-1 py-1.5 hover:bg-ds-neutral-subtle-hovered">
                    <Avatar user={who} size="sm" />
                    <IssueTypeIcon type={i.type} size={14} />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      <span className="text-ds-text-subtle">{i.key}</span> {i.summary}
                    </span>
                    <StatusLozenge status={i.status} />
                    <span className="w-24 shrink-0 text-right text-xs text-ds-text-subtlest">{relativeTime(i.updatedAt)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </ChartCard>

        <ChartCard title="Priority breakdown" subtitle="Open work items by priority.">
          <ColumnChart categories={PRIORITIES.map((p) => ({ id: p.id, label: p.name }))} series={[{ id: "count", name: "Open work items", color: "var(--ds-chart-blue)" }]} values={priorityValues} format={(v) => String(Math.round(v))} height={200} />
          <div className="mt-1 flex justify-around pl-12 text-xs text-ds-text-subtlest">
            {PRIORITIES.map((p) => (
              <PriorityIcon key={p.id} priority={p.id} size={14} />
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Types of work" subtitle="Breakdown of work items by type.">
          <HBars rows={typeRows} format={(v) => String(v)} showPercent labelWidth={120} />
        </ChartCard>

        <ChartCard title="Team workload" subtitle="Open work items per assignee." action={<span className="text-xs text-ds-text-subtlest">{openWork.length} open</span>}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ds-text-subtle">
                <th className="pb-2 font-semibold">Assignee</th>
                <th className="pb-2 font-semibold">Work distribution</th>
                <th className="pb-2 text-right font-semibold">Count</th>
              </tr>
            </thead>
            <tbody>
              {[...workload, ...(unassigned ? [{ u: undefined, count: unassigned }] : [])].map((w, idx) => (
                <tr key={w.u?.id ?? `un${idx}`}>
                  <td className="py-1.5 pr-3">
                    <span className="flex items-center gap-2"><Avatar user={w.u} size="sm" /> {w.u?.name ?? "Unassigned"}</span>
                  </td>
                  <td className="py-1.5 pr-3">
                    <ProgressBar segments={[{ value: w.count, color: w.u ? "var(--ds-chart-blue)" : "var(--ds-chart-gray)" }, { value: Math.max(0, openWork.length - w.count), color: "var(--ds-chart-track)" }]} height={8} />
                  </td>
                  <td className="tabular-nums py-1.5 text-right">{w.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ChartCard>

        <ChartCard title="Time tracked" subtitle="Hours logged on this project in the last 14 days, per member." action={<span className="flex gap-3"><Link href={`/projects/${project.key}/budget`} className="text-xs text-ds-link hover:underline">Budget</Link><Link href={`/projects/${project.key}/time`} className="text-xs text-ds-link hover:underline">View time</Link></span>}>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="rounded-ds bg-ds-surface-sunken px-3 py-2"><div className="text-lg font-semibold">{formatDurationShort(totalLogged)}</div><div className="text-xs text-ds-text-subtlest">Total logged</div></div>
            <div className="rounded-ds bg-ds-surface-sunken px-3 py-2"><div className="text-lg font-semibold">{formatDurationShort(billable)}</div><div className="text-xs text-ds-text-subtlest">Billable</div></div>
            <div className="rounded-ds bg-ds-surface-sunken px-3 py-2"><div className="text-lg font-semibold">{formatMoney(value.revenue - value.cost, settings.currency)}</div><div className="text-xs text-ds-text-subtlest">Margin ({formatMoney(value.revenue, settings.currency)} revenue)</div></div>
          </div>
          <HBars rows={perMember} format={(v) => formatDurationShort(v)} labelWidth={150} />
        </ChartCard>

        <ChartCard title="Epic progress" subtitle="See how your epics are progressing at a glance." className="xl:col-span-2" action={activeSprint ? <span className="text-xs text-ds-text-subtlest">Active: {activeSprint.name}</span> : undefined}>
          {epics.length === 0 && <div className="text-sm text-ds-text-subtlest">No epics in this project.</div>}
          <div className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2">
            {epics.map((e) => {
              const kids = work.filter((i) => i.parentId === e.id);
              const done = kids.filter((k) => k.status === "done").length;
              const prog = kids.filter((k) => k.status === "inprogress" || k.status === "inreview").length;
              const todo = kids.length - done - prog;
              return (
                <div key={e.id}>
                  <Link href={`/browse/${e.key}`} className="mb-1 flex items-center gap-2 text-sm hover:underline">
                    <IssueTypeIcon type="epic" size={14} /> <span className="truncate">{e.summary}</span>
                    <span className="ml-auto shrink-0 text-xs text-ds-text-subtlest">{kids.length ? Math.round((done / kids.length) * 100) : 0}% done</span>
                  </Link>
                  <ProgressBar segments={[{ value: done, color: "var(--ds-chart-green)", label: "Done" }, { value: prog, color: "var(--ds-chart-blue)", label: "In progress" }, { value: todo, color: "var(--ds-chart-track)", label: "To do" }]} height={8} />
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex gap-4 text-xs text-ds-text-subtle">
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[2px] bg-chart-green" /> Done</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[2px] bg-chart-blue" /> In progress</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[2px] bg-ds-track" /> To do</span>
          </div>
        </ChartCard>
      </div>
      <span className="hidden"><Clock /></span>
    </Page>
  );
}
