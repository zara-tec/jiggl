"use client";

import * as React from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { useEffectiveEntries } from "@/hooks/useData";
import { HEALTH_META, computeProjectBudget, type Health } from "@/lib/budget";
import { formatDays, formatMoney } from "@/lib/rates";
import { cn, formatDurationShort } from "@/lib/utils";
import { Page } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/misc";
import { Select } from "@/components/ui/Select";
import { Avatar, ProjectAvatar } from "@/components/ui/Avatar";
import { Lozenge } from "@/components/ui/Lozenge";
import { PROJECT_STATUS_META } from "@/components/offers/meta";
import { ChartCard, ColumnChart, StatTile } from "@/components/reports/charts";

/** Portfolio view for project managers: sold vs consumed across projects. */
export default function InsightsPage() {
  const projects = useStore((s) => s.projects);
  const clients = useStore((s) => s.clients);
  const users = useStore((s) => s.users);
  const offers = useStore((s) => s.offers);
  const issues = useStore((s) => s.issues);
  const settings = useStore((s) => s.settings);
  const entries = useEffectiveEntries();
  const [clientId, setClientId] = React.useState<string | null>(null);
  const [leadId, setLeadId] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [healthF, setHealthF] = React.useState<string | null>(null);
  const cur = settings.currency;

  const rows = React.useMemo(
    () =>
      projects
        .filter((p) => !p.archived)
        .map((p) => ({ p, b: computeProjectBudget({ project: p, offers, issues, entries, users, projects, settings }) })),
    [projects, offers, issues, entries, users, settings],
  );
  const list = rows
    .filter((r) => !clientId || r.p.clientId === clientId)
    .filter((r) => !leadId || r.p.leadId === leadId)
    .filter((r) => !status || r.p.status === status)
    .filter((r) => !healthF || r.b.health === healthF)
    .sort((a, b) => b.b.sold.amount - a.b.sold.amount);

  const sum = (f: (r: (typeof rows)[number]) => number) => list.reduce((a, r) => a + f(r), 0);
  const sold = sum((r) => r.b.sold.amount);
  const soldHours = sum((r) => r.b.sold.hours);
  const consumedValue = sum((r) => r.b.consumed.value);
  const consumedSeconds = sum((r) => r.b.consumed.seconds);
  const cost = sum((r) => r.b.consumed.cost);
  const pipeline = sum((r) => r.b.pipeline.amount);
  const margin = sum((r) => (r.p.pricing === "tm" ? r.b.consumed.value - r.b.consumed.cost : r.b.sold.amount - r.b.consumed.cost));

  const chartRows = list.filter((r) => r.b.sold.hours > 0 || r.b.consumed.seconds > 0).slice(0, 8);
  const values: Record<string, Record<string, number>> = {};
  chartRows.forEach((r) => (values[r.p.id] = { sold: r.b.sold.hours, consumed: Math.round(r.b.consumed.seconds / 3600) }));

  return (
    <>
      <PageHeader title="Insights" />
      <Page>
        <p className="mt-2 text-sm text-ds-text-subtle">Sold from orders, consumed from tracked and allocated hours, valued at billing and cost rates. Open offers are pipeline, never budget.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Select value={clientId} onChange={setClientId} clearable appearance="chip" chipLabel="Client" placeholder="All" options={clients.map((c) => ({ value: c.id, label: c.name }))} />
          <Select value={leadId} onChange={setLeadId} clearable appearance="chip" chipLabel="Lead" placeholder="All" options={users.map((u) => ({ value: u.id, label: u.name, icon: <Avatar user={u} size="xs" /> }))} />
          <Select value={status} onChange={setStatus} searchable={false} clearable appearance="chip" chipLabel="Status" placeholder="All" options={[{ value: "prospect", label: "Prospect" }, { value: "active", label: "Active" }, { value: "closed", label: "Closed" }]} />
          <Select value={healthF} onChange={setHealthF} searchable={false} clearable appearance="chip" chipLabel="Health" placeholder="All" options={(Object.keys(HEALTH_META) as Health[]).map((h) => ({ value: h, label: HEALTH_META[h].name }))} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatTile label="Sold" value={formatMoney(sold, cur)} hint={`${soldHours}h · ${formatDays(soldHours * 3600, settings)}`} />
          <StatTile label="Consumed at price" value={formatMoney(consumedValue, cur)} hint={`${formatDurationShort(consumedSeconds)} · ${formatDays(consumedSeconds, settings)}`} />
          <StatTile label="Cost" value={formatMoney(cost, cur)} hint="All hours x cost rate" />
          <StatTile label="Margin" value={<span className={cn(margin < 0 && "text-ds-text-danger")}>{formatMoney(margin, cur)}</span>} hint="Fixed: sold minus cost · T&M: revenue minus cost" />
          <StatTile label="Pipeline" value={formatMoney(pipeline, cur)} hint="Draft, sent and accepted offers" />
        </div>

        <ChartCard title="Sold vs consumed hours" subtitle="Per project. Consumed includes allocated hours." className="mt-6">
          {chartRows.length ? (
            <ColumnChart categories={chartRows.map((r) => ({ id: r.p.id, label: r.p.key, sublabel: r.p.name }))} series={[{ id: "sold", name: "Sold", color: "#2a78d6" }, { id: "consumed", name: "Consumed", color: "#eb6834" }]} values={values} format={(v) => `${Math.round(v)}h`} height={220} grouped />
          ) : (
            <div className="py-6 text-center text-sm text-ds-text-subtlest">Nothing to show.</div>
          )}
        </ChartCard>

        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ds-text-subtle">
              <th className="border-b border-ds-border py-2 font-semibold">Project</th>
              <th className="border-b border-ds-border py-2 font-semibold">Client</th>
              <th className="border-b border-ds-border py-2 font-semibold">Status</th>
              <th className="border-b border-ds-border py-2 font-semibold">Pricing</th>
              <th className="border-b border-ds-border py-2 font-semibold">Health</th>
              <th className="border-b border-ds-border py-2 text-right font-semibold">Sold</th>
              <th className="border-b border-ds-border py-2 text-right font-semibold">Sold h</th>
              <th className="border-b border-ds-border py-2 text-right font-semibold">Consumed h</th>
              <th className="border-b border-ds-border py-2 text-right font-semibold">%</th>
              <th className="border-b border-ds-border py-2 text-right font-semibold">Cost</th>
              <th className="border-b border-ds-border py-2 text-right font-semibold">Margin</th>
              <th className="border-b border-ds-border py-2 text-right font-semibold">Pipeline</th>
            </tr>
          </thead>
          <tbody>
            {list.map(({ p, b }) => {
              const h = HEALTH_META[b.health];
              const m = p.pricing === "tm" ? b.consumed.value - b.consumed.cost : b.sold.amount - b.consumed.cost;
              return (
                <tr key={p.id} className="hover:bg-ds-surface-hovered">
                  <td className="border-b border-ds-border py-2 pr-3"><Link href={`/projects/${p.key}/budget`} className="flex items-center gap-2 font-medium text-ds-link hover:underline"><ProjectAvatar name={p.name} color={p.color} size={20} /> {p.name}</Link></td>
                  <td className="border-b border-ds-border py-2 pr-3 text-ds-text-subtle">{clients.find((c) => c.id === p.clientId)?.name ?? "—"}</td>
                  <td className="border-b border-ds-border py-2 pr-3"><Lozenge appearance={PROJECT_STATUS_META[p.status].appearance}>{PROJECT_STATUS_META[p.status].name}</Lozenge></td>
                  <td className="border-b border-ds-border py-2 pr-3 text-ds-text-subtle">{p.pricing === "tm" ? "T&M" : "Fixed"}</td>
                  <td className="border-b border-ds-border py-2 pr-3"><Lozenge appearance={h.appearance} isBold={b.health === "over"}>{h.name}</Lozenge></td>
                  <td className="tabular-nums border-b border-ds-border py-2 text-right font-semibold">{formatMoney(b.sold.amount, cur)}</td>
                  <td className="tabular-nums border-b border-ds-border py-2 text-right">{b.sold.hours}h</td>
                  <td className="tabular-nums border-b border-ds-border py-2 text-right">{formatDurationShort(b.consumed.seconds)}</td>
                  <td className={cn("tabular-nums border-b border-ds-border py-2 text-right", b.pctHours > 100 && "font-semibold text-ds-text-danger")}>{b.sold.hours ? `${b.pctHours}%` : "—"}</td>
                  <td className="tabular-nums border-b border-ds-border py-2 text-right text-ds-text-subtle">{formatMoney(b.consumed.cost, cur)}</td>
                  <td className={cn("tabular-nums border-b border-ds-border py-2 text-right", m < 0 ? "text-ds-text-danger" : "text-ds-text-subtle")}>{formatMoney(m, cur)}</td>
                  <td className="tabular-nums border-b border-ds-border py-2 text-right text-ds-text-subtle">{b.pipeline.amount ? formatMoney(b.pipeline.amount, cur) : "—"}</td>
                </tr>
              );
            })}
            {list.length === 0 && <tr><td colSpan={12} className="py-8 text-center text-ds-text-subtlest">No projects match the filters.</td></tr>}
          </tbody>
        </table>
      </Page>
    </>
  );
}
