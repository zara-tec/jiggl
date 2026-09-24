"use client";

import * as React from "react";
import Link from "next/link";
import { format, isSameDay, parseISO } from "date-fns";
import { Download, ExternalLink } from "lucide-react";
import { useStore } from "@/lib/store";
import { useNow } from "@/hooks/useHydrated";
import { daysBetween, entryDuration, formatDurationClock, formatDurationShort, formatHoursDecimal, formatTime } from "@/lib/utils";
import { billingRateFor, costRateFor, formatDays, formatMoney, marginPct, valueEntries } from "@/lib/rates";
import { Page } from "@/components/layout/AppShell";
import { PageHeader, Tabs } from "@/components/ui/misc";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Avatar } from "@/components/ui/Avatar";
import { IssueTypeIcon } from "@/components/issues/icons";
import { ChartCard, ColumnChart, Donut, StatTile } from "@/components/reports/charts";
import { applyFilters, defaultFilters, filterRange, ReportFilterBar, type ReportFilters } from "@/components/reports/filters";
import { useEffectiveEntries } from "@/hooks/useData";

type GroupBy = "project" | "client" | "member" | "tag" | "issue";

export default function ReportsPage() {
  const [tab, setTab] = React.useState("summary");
  const [filters, setFilters] = React.useState<ReportFilters>(defaultFilters);
  const [groupBy, setGroupBy] = React.useState<GroupBy>("project");
  const entries = useEffectiveEntries();
  const projects = useStore((s) => s.projects);
  const clients = useStore((s) => s.clients);
  const users = useStore((s) => s.users);
  const tags = useStore((s) => s.tags);
  const issues = useStore((s) => s.issues);
  const settings = useStore((s) => s.settings);
  const now = useNow(1000, entries.some((e) => !e.stop));

  const list = React.useMemo(() => applyFilters(entries, filters, projects), [entries, filters, projects]);
  const dur = (e: (typeof list)[number]) => entryDuration(e, now);
  const totals = React.useMemo(() => valueEntries(list, users, projects, now), [list, users, projects, now]);
  const total = totals.seconds;
  const billable = totals.billableSeconds;
  const amount = totals.revenue;
  const cost = totals.cost;
  const { from, to } = filterRange(filters);
  const days = daysBetween(from, to);

  // Series: projects that appear (entity colours), + "No project"
  const activeProjects = projects.filter((p) => list.some((e) => e.projectId === p.id));
  const series = [...activeProjects.map((p) => ({ id: p.id, name: p.name, color: p.color })), ...(list.some((e) => !e.projectId) ? [{ id: "_none", name: "No project", color: "var(--ds-chart-gray)" }] : [])];
  const values: Record<string, Record<string, number>> = {};
  days.forEach((d) => {
    const k = format(d, "yyyy-MM-dd");
    values[k] = {};
    list.filter((e) => isSameDay(parseISO(e.start), d)).forEach((e) => {
      const sid = e.projectId ?? "_none";
      values[k][sid] = (values[k][sid] ?? 0) + dur(e);
    });
  });

  // Group rows
  const groups = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string; sub?: string; color: string; icon?: React.ReactNode; seconds: number; billable: number; amount: number; cost: number; count: number }>();
    for (const e of list) {
      const p = projects.find((x) => x.id === e.projectId);
      const keys: { id: string; name: string; sub?: string; color: string; icon?: React.ReactNode }[] = [];
      if (groupBy === "project") keys.push({ id: p?.id ?? "_none", name: p?.name ?? "No project", sub: clients.find((c) => c.id === p?.clientId)?.name, color: p?.color ?? "var(--ds-chart-gray)" });
      else if (groupBy === "client") {
        const c = clients.find((x) => x.id === p?.clientId);
        keys.push({ id: c?.id ?? "_none", name: c?.name ?? "No client", color: "var(--ds-chart-blue)" });
      } else if (groupBy === "member") {
        const u = users.find((x) => x.id === e.userId);
        keys.push({ id: u?.id ?? "_none", name: u?.name ?? "Unknown", color: u?.color ?? "var(--ds-chart-gray)", icon: <Avatar user={u} size="xs" /> });
      } else if (groupBy === "tag") {
        if (e.tagIds.length === 0) keys.push({ id: "_none", name: "No tag", color: "var(--ds-chart-gray)" });
        e.tagIds.forEach((t) => keys.push({ id: t, name: tags.find((x) => x.id === t)?.name ?? t, color: "var(--ds-chart-blue)" }));
      } else {
        const i = issues.find((x) => x.id === e.issueId);
        keys.push({ id: i?.id ?? "_none", name: i ? `${i.key} ${i.summary}` : "No work item", sub: p?.name, color: p?.color ?? "var(--ds-chart-gray)", icon: i ? <IssueTypeIcon type={i.type} size={12} /> : undefined });
      }
      const user = users.find((u) => u.id === e.userId);
      const price = billingRateFor(user, p, e.start);
      const costRate = costRateFor(user, p, e.start);
      for (const k of keys) {
        const g = map.get(k.id) ?? { ...k, seconds: 0, billable: 0, amount: 0, cost: 0, count: 0 };
        g.seconds += dur(e);
        g.count += 1;
        g.cost += (dur(e) / 3600) * costRate;
        if (e.billable) {
          g.billable += dur(e);
          g.amount += (dur(e) / 3600) * price;
        }
        map.set(k.id, g);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.seconds - a.seconds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, groupBy, projects, clients, users, tags, issues, now]);

  const donutData = (() => {
    const top = groups.slice(0, 7);
    const rest = groups.slice(7);
    const data = top.map((g) => ({ id: g.id, name: g.name, value: g.seconds, color: groupBy === "project" || groupBy === "member" || groupBy === "issue" ? g.color : undefined as unknown as string }));
    if (rest.length) data.push({ id: "_other", name: "Other", value: rest.reduce((a, g) => a + g.seconds, 0), color: "var(--ds-chart-gray)" });
    // For non-entity groupings use a validated fixed order
    const fixed = ["#0b83d9", "#e36a00", "#06a893", "#9e5bd9", "#c7af14", "#d94182", "#2da608", "#465bb3"];
    return data.map((d, i) => ({ ...d, color: d.color ?? fixed[i % fixed.length] }));
  })();

  const exportCsv = () => {
    const rows = [["Date", "Start", "Stop", "Duration (h)", "Member", "Description", "Project", "Client", "Work item", "Tags", "Billable", "Source"]];
    [...list].sort((a, b) => a.start.localeCompare(b.start)).forEach((e) => {
      const p = projects.find((x) => x.id === e.projectId);
      const i = issues.find((x) => x.id === e.issueId);
      rows.push([format(parseISO(e.start), "yyyy-MM-dd"), formatTime(e.start), e.stop ? formatTime(e.stop) : "", formatHoursDecimal(dur(e)), users.find((u) => u.id === e.userId)?.name ?? "", e.description, p?.name ?? "", clients.find((c) => c.id === p?.clientId)?.name ?? "", i?.key ?? "", e.tagIds.map((t) => tags.find((x) => x.id === t)?.name).join("|"), e.billable ? "yes" : "no", e.virtual ? "allocated" : "tracked"]);
    });
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `jiggl-report-${filters.from}-${filters.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Reports"
        actions={
          <Button iconBefore={<Download />} onClick={exportCsv}>
            Export CSV
          </Button>
        }
      >
        <Tabs
          value={tab}
          onChange={setTab}
          className="mt-2"
          tabs={[
            { id: "summary", label: "Summary" },
            { id: "detailed", label: "Detailed" },
            { id: "weekly", label: "Weekly" },
          ]}
        />
      </PageHeader>
      <Page>
        <div className="mt-4">
          <ReportFilterBar value={filters} onChange={setFilters} />
        </div>

        {tab === "summary" && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-5">
              <StatTile label="Total hours" value={formatDurationClock(total)} hint={`${formatHoursDecimal(total)} h · ${formatDays(total, settings)}`} />
              <StatTile label="Billable hours" value={formatDurationClock(billable)} hint={total ? `${Math.round((billable / total) * 100)}% of total` : undefined} />
              <StatTile label="Revenue" value={formatMoney(amount, settings.currency)} hint="Billable hours x billing rate" />
              <StatTile label="Cost" value={formatMoney(cost, settings.currency)} hint="All hours x cost rate" />
              <StatTile label="Margin" value={formatMoney(amount - cost, settings.currency)} hint={`${marginPct(amount, cost)}% of revenue`} />
            </div>
            <ChartCard title="Tracked time per day" className="mt-6">
              <ColumnChart
                categories={days.map((d) => ({ id: format(d, "yyyy-MM-dd"), label: days.length > 14 ? format(d, "d") : format(d, "EEE d"), sublabel: format(d, "EEEE d MMM") }))}
                series={series}
                values={values}
                format={(v) => `${Math.round((v / 3600) * 10) / 10}h`}
                height={240}
              />
            </ChartCard>
            <ChartCard
              title="Breakdown"
              className="mt-6"
              action={
                <Select
                  value={groupBy}
                  onChange={(v) => v && setGroupBy(v as GroupBy)}
                  searchable={false}
                  appearance="subtle"
                  className="w-auto"
                  options={[
                    { value: "project", label: "Group by: Project" },
                    { value: "client", label: "Group by: Client" },
                    { value: "member", label: "Group by: Member" },
                    { value: "tag", label: "Group by: Tag" },
                    { value: "issue", label: "Group by: Work item" },
                  ]}
                />
              }
            >
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-[320px_1fr]">
                <Donut data={donutData} format={(v) => formatDurationShort(v)} centerLabel="Total" size={180} showPercent={false} />
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-ds-text-subtle">
                      <th className="pb-2 font-semibold">Title</th>
                      <th className="pb-2 text-right font-semibold">Duration</th>
                      <th className="pb-2 text-right font-semibold">%</th>
                      <th className="pb-2 text-right font-semibold">Billable</th>
                      <th className="pb-2 text-right font-semibold">Revenue</th>
                      <th className="pb-2 text-right font-semibold">Cost</th>
                      <th className="pb-2 text-right font-semibold">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g) => (
                      <tr key={g.id} className="border-t border-ds-border">
                        <td className="py-1.5 pr-3">
                          <span className="flex items-center gap-2">
                            <span className="size-2.5 shrink-0 rounded-full" style={{ background: g.color }} />
                            {g.icon}
                            <span className="truncate">{g.name}</span>
                            {g.sub && <span className="truncate text-xs text-ds-text-subtlest">· {g.sub}</span>}
                          </span>
                        </td>
                        <td className="tabular-nums py-1.5 text-right font-semibold">{formatDurationClock(g.seconds)}</td>
                        <td className="tabular-nums py-1.5 text-right text-ds-text-subtle">{total ? Math.round((g.seconds / total) * 100) : 0}%</td>
                        <td className="tabular-nums py-1.5 text-right text-ds-text-subtle">{formatDurationShort(g.billable)}</td>
                        <td className="tabular-nums py-1.5 text-right text-ds-text-subtle">{formatMoney(g.amount, settings.currency)}</td>
                        <td className="tabular-nums py-1.5 text-right text-ds-text-subtle">{formatMoney(g.cost, settings.currency)}</td>
                        <td className={`tabular-nums py-1.5 text-right ${g.amount - g.cost < 0 ? "text-ds-text-danger" : "text-ds-text-subtle"}`}>{formatMoney(g.amount - g.cost, settings.currency)}</td>
                      </tr>
                    ))}
                    {groups.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-ds-text-subtlest">No time entries match the filters.</td>
                      </tr>
                    )}
                  </tbody>
                  {groups.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-ds-border font-semibold">
                        <td className="py-2">Total</td>
                        <td className="tabular-nums py-2 text-right">{formatDurationClock(total)}</td>
                        <td className="py-2 text-right">100%</td>
                        <td className="tabular-nums py-2 text-right">{formatDurationShort(billable)}</td>
                        <td className="tabular-nums py-2 text-right">{formatMoney(amount, settings.currency)}</td>
                        <td className="tabular-nums py-2 text-right">{formatMoney(cost, settings.currency)}</td>
                        <td className="tabular-nums py-2 text-right">{formatMoney(amount - cost, settings.currency)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </ChartCard>
          </>
        )}

        {tab === "detailed" && (
          <div className="mt-4 overflow-hidden rounded-ds-lg border border-ds-border">
            <div className="flex items-center justify-between bg-ds-surface-sunken px-4 py-2 text-sm">
              <span className="text-ds-text-subtle">{list.length} entries</span>
              <span className="tabular-nums font-semibold">Total {formatDurationClock(total)}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ds-border text-left text-xs text-ds-text-subtle">
                  <th className="px-4 py-2 font-semibold">Date</th>
                  <th className="py-2 font-semibold">Member</th>
                  <th className="py-2 font-semibold">Description</th>
                  <th className="py-2 font-semibold">Project</th>
                  <th className="py-2 font-semibold">Tags</th>
                  <th className="py-2 text-center font-semibold">$</th>
                  <th className="py-2 font-semibold">Time</th>
                  <th className="px-4 py-2 text-right font-semibold">Duration</th>
                </tr>
              </thead>
              <tbody>
                {[...list]
                  .sort((a, b) => b.start.localeCompare(a.start))
                  .slice(0, 400)
                  .map((e) => {
                    const p = projects.find((x) => x.id === e.projectId);
                    const i = issues.find((x) => x.id === e.issueId);
                    const u = users.find((x) => x.id === e.userId);
                    return (
                      <tr key={e.id} className="border-b border-ds-border hover:bg-ds-surface-hovered">
                        <td className="whitespace-nowrap px-4 py-1.5 text-ds-text-subtle">{format(parseISO(e.start), "EEE d MMM")}</td>
                        <td className="py-1.5"><span className="flex items-center gap-2"><Avatar user={u} size="xs" /> {u?.name}</span></td>
                        <td className="max-w-md truncate py-1.5 pr-3">{e.virtual && <span className="mr-1.5 rounded-[3px] bg-ds-neutral px-1 text-[10px] font-bold uppercase text-ds-text-subtle">Allocated</span>}{e.description || <span className="italic text-ds-text-subtlest">(no description)</span>}</td>
                        <td className="py-1.5 pr-3">
                          {p ? (
                            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: p.color }} /><span style={{ color: p.color }}>{p.name}</span>{i && <Link href={`/browse/${i.key}`} className="inline-flex items-center gap-0.5 text-xs text-ds-text-subtle hover:underline">{i.key}<ExternalLink size={10} /></Link>}</span>
                          ) : (
                            <span className="text-ds-text-subtlest">—</span>
                          )}
                        </td>
                        <td className="py-1.5 pr-3 text-xs text-ds-text-subtle">{e.tagIds.map((t) => tags.find((x) => x.id === t)?.name).join(", ")}</td>
                        <td className="py-1.5 text-center text-xs">{e.billable ? <span className="font-bold text-ds-text-success">$</span> : <span className="text-ds-text-subtlest">–</span>}</td>
                        <td className="tabular-nums whitespace-nowrap py-1.5 text-xs text-ds-text-subtle">{formatTime(e.start)} – {e.stop ? formatTime(e.stop) : "now"}</td>
                        <td className="tabular-nums px-4 py-1.5 text-right font-semibold">{formatDurationClock(dur(e))}</td>
                      </tr>
                    );
                  })}
                {list.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-ds-text-subtlest">No time entries match the filters.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "weekly" && <WeeklyMatrix list={list} days={days} groupBy={groupBy === "member" ? "member" : "project"} onGroupBy={(g) => setGroupBy(g)} now={now} />}
      </Page>
    </>
  );
}

function WeeklyMatrix({ list, days, groupBy, onGroupBy, now }: { list: ReturnType<typeof applyFilters>; days: Date[]; groupBy: "project" | "member"; onGroupBy: (g: GroupBy) => void; now: Date }) {
  const projects = useStore((s) => s.projects);
  const users = useStore((s) => s.users);
  const shownDays = days.slice(0, 14);
  const rows = groupBy === "member" ? users.map((u) => ({ id: u.id, name: u.name, color: u.color, icon: <Avatar user={u} size="xs" />, match: (e: (typeof list)[number]) => e.userId === u.id })) : [...projects.map((p) => ({ id: p.id, name: p.name, color: p.color, icon: undefined as React.ReactNode, match: (e: (typeof list)[number]) => e.projectId === p.id })), { id: "_none", name: "No project", color: "var(--ds-chart-gray)", icon: undefined as React.ReactNode, match: (e: (typeof list)[number]) => !e.projectId }];
  const cell = (r: (typeof rows)[number], d: Date) => list.filter((e) => r.match(e) && isSameDay(parseISO(e.start), d)).reduce((a, e) => a + entryDuration(e, now), 0);
  const filled = rows.map((r) => ({ r, cells: shownDays.map((d) => cell(r, d)) })).map((x) => ({ ...x, total: x.cells.reduce((a, b) => a + b, 0) })).filter((x) => x.total > 0);
  const colTotals = shownDays.map((_, i) => filled.reduce((a, x) => a + x.cells[i], 0));
  const grand = colTotals.reduce((a, b) => a + b, 0);
  return (
    <ChartCard
      title="Weekly"
      subtitle={days.length > 14 ? "Showing the first 14 days of the selected range." : undefined}
      className="mt-4"
      action={<Select value={groupBy} onChange={(v) => v && onGroupBy(v as GroupBy)} searchable={false} appearance="subtle" className="w-auto" options={[{ value: "project", label: "Rows: Projects" }, { value: "member", label: "Rows: Members" }]} />}
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-ds-text-subtle">
            <th className="pb-2 font-semibold">{groupBy === "member" ? "Member" : "Project"}</th>
            {shownDays.map((d) => (
              <th key={d.toISOString()} className="pb-2 text-right font-semibold"><div>{format(d, "EEE")}</div><div className="font-normal text-ds-text-subtlest">{format(d, "d MMM")}</div></th>
            ))}
            <th className="pb-2 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {filled.map(({ r, cells, total }) => (
            <tr key={r.id} className="border-t border-ds-border">
              <td className="py-2 pr-3"><span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: r.color }} />{r.icon}{r.name}</span></td>
              {cells.map((c, i) => (
                <td key={i} className="tabular-nums py-2 text-right text-ds-text-subtle">{c ? formatDurationClock(c) : <span className="text-ds-text-subtlest">–</span>}</td>
              ))}
              <td className="tabular-nums py-2 text-right font-semibold">{formatDurationClock(total)}</td>
            </tr>
          ))}
          {filled.length === 0 && <tr><td colSpan={shownDays.length + 2} className="py-6 text-center text-ds-text-subtlest">No time entries match the filters.</td></tr>}
        </tbody>
        {filled.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-ds-border font-semibold">
              <td className="py-2">Total</td>
              {colTotals.map((c, i) => (
                <td key={i} className="tabular-nums py-2 text-right">{c ? formatDurationClock(c) : "–"}</td>
              ))}
              <td className="tabular-nums py-2 text-right">{formatDurationClock(grand)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </ChartCard>
  );
}
