"use client";

import * as React from "react";
import { use } from "react";
import { format, isSameDay, parseISO, startOfDay, subDays } from "date-fns";
import { useStore } from "@/lib/store";
import { useProjectByKey, useProjectIssues, useEffectiveEntries } from "@/hooks/useData";
import { useNow } from "@/hooks/useHydrated";
import { daysBetween, entryDuration, formatDurationShort, formatHoursDecimal } from "@/lib/utils";
import { formatDays, formatMoney, marginPct, valueEntries } from "@/lib/rates";
import { Page } from "@/components/layout/AppShell";
import { Select } from "@/components/ui/Select";
import { Avatar } from "@/components/ui/Avatar";
import { IssueTypeIcon } from "@/components/issues/icons";
import { ChartCard, ColumnChart, HBars, StatTile } from "@/components/reports/charts";
import { TimeEntriesList } from "@/components/time/TimeEntriesList";

export default function ProjectTimePage({ params }: PageProps<"/projects/[key]/time">) {
  const { key } = use(params);
  const project = useProjectByKey(key);
  const issues = useProjectIssues(project?.id);
  const users = useStore((s) => s.users);
  const entries = useEffectiveEntries();
  const projects = useStore((s) => s.projects);
  const settings = useStore((s) => s.settings);
  const [range, setRange] = React.useState("14");
  const [member, setMember] = React.useState<string | null>(null);
  const now = useNow(1000, entries.some((e) => !e.stop));

  if (!project) return null;
  const days = Number(range);
  const from = subDays(startOfDay(now), days - 1);
  const list = entries.filter((e) => e.projectId === project.id && parseISO(e.start) >= from && (!member || e.userId === member));
  const totals = valueEntries(list, users, projects, now);
  const total = totals.seconds;
  const billable = totals.billableSeconds;
  const dayList = daysBetween(from, now);
  const values: Record<string, Record<string, number>> = {};
  dayList.forEach((d) => (values[format(d, "yyyy-MM-dd")] = { t: list.filter((e) => isSameDay(parseISO(e.start), d)).reduce((a, e) => a + entryDuration(e, now), 0) }));

  const perMember = users
    .map((u) => ({ id: u.id, label: <><Avatar user={u} size="xs" /> <span className="truncate">{u.name}</span></>, value: list.filter((e) => e.userId === u.id).reduce((a, e) => a + entryDuration(e, now), 0) }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);
  const epics = issues.filter((i) => i.type === "epic");
  const perEpic = [
    ...epics.map((e) => ({
      id: e.id,
      label: <><IssueTypeIcon type="epic" size={12} /> <span className="truncate">{e.summary}</span></>,
      value: list.filter((t) => { const i = issues.find((x) => x.id === t.issueId); return i && (i.parentId === e.id || issues.find((p) => p.id === i.parentId)?.parentId === e.id); }).reduce((a, t) => a + entryDuration(t, now), 0),
    })),
    { id: "_none", label: <span className="truncate text-ds-text-subtlest">No epic / no work item</span>, value: list.filter((t) => { const i = issues.find((x) => x.id === t.issueId); return !i || !i.parentId; }).reduce((a, t) => a + entryDuration(t, now), 0) },
  ].filter((r) => r.value > 0).sort((a, b) => b.value - a.value);

  return (
    <Page>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Select value={range} onChange={(v) => v && setRange(v)} searchable={false} appearance="chip" chipLabel="Period" options={[{ value: "7", label: "Last 7 days" }, { value: "14", label: "Last 14 days" }, { value: "30", label: "Last 30 days" }, { value: "90", label: "Last 90 days" }]} />
        <Select value={member} onChange={setMember} clearable appearance="chip" chipLabel="Member" placeholder="All members" options={users.map((u) => ({ value: u.id, label: u.name, icon: <Avatar user={u} size="xs" /> }))} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="Total tracked" value={formatDurationShort(total)} hint={`${formatHoursDecimal(total)} h · ${formatDays(total, settings)}`} />
        <StatTile label="Billable" value={formatDurationShort(billable)} hint={total ? `${Math.round((billable / total) * 100)}% of total` : undefined} />
        <StatTile label={project.pricing === "tm" ? "Revenue" : "Billable value"} value={formatMoney(totals.revenue, settings.currency)} hint={project.pricing === "tm" ? "Billable hours x billing rate" : "Notional: fixed price project"} />
        <StatTile label="Cost" value={formatMoney(totals.cost, settings.currency)} hint="All hours x cost rate" />
        <StatTile label="Margin" value={formatMoney(totals.revenue - totals.cost, settings.currency)} hint={`${marginPct(totals.revenue, totals.cost)}% of revenue`} />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]">
        <ChartCard title="Tracked time per day">
          <ColumnChart categories={dayList.map((d) => ({ id: format(d, "yyyy-MM-dd"), label: days > 14 ? format(d, "d") : format(d, "EEE d"), sublabel: format(d, "EEEE d MMM") }))} series={[{ id: "t", name: "Tracked", color: project.color }]} values={values} format={(v) => `${Math.round(v / 3600)}h`} />
        </ChartCard>
        <div className="space-y-6">
          <ChartCard title="By member"><HBars rows={perMember} format={formatDurationShort} labelWidth={140} /></ChartCard>
          <ChartCard title="By epic"><HBars rows={perEpic} format={formatDurationShort} labelWidth={140} /></ChartCard>
        </div>
      </div>
      <h3 className="ds-heading-md mb-3 mt-8">Time entries</h3>
      <TimeEntriesList entries={list} showUser />
    </Page>
  );
}
