"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { useStore } from "@/lib/store";
import { useEffectiveEntries } from "@/hooks/useData";
import type { Project } from "@/lib/types";
import { HEALTH_META, burnSeries, computeProjectBudget } from "@/lib/budget";
import { formatDays, formatMoney } from "@/lib/rates";
import { cn, formatDurationShort } from "@/lib/utils";
import { Lozenge } from "@/components/ui/Lozenge";
import { ProgressBar } from "@/components/ui/misc";
import { IssueTypeIcon } from "@/components/issues/icons";
import { OfferStatusLozenge } from "@/components/offers/meta";
import { ChartCard, LineChart, StatTile } from "@/components/reports/charts";
import { offerTotals } from "@/lib/offers";

/** Sold vs consumed for one project: the PM view. */
export function BudgetView({ project }: { project: Project }) {
  const offers = useStore((s) => s.offers);
  const issues = useStore((s) => s.issues);
  const users = useStore((s) => s.users);
  const projects = useStore((s) => s.projects);
  const settings = useStore((s) => s.settings);
  const entries = useEffectiveEntries();
  const budget = React.useMemo(() => computeProjectBudget({ project, offers, issues, entries, users, projects, settings }), [project, offers, issues, entries, users, projects, settings]);
  const burn = React.useMemo(() => burnSeries({ project, offers, entries }), [project, offers, entries]);
  const cur = settings.currency;
  const isTm = project.pricing === "tm";
  const health = HEALTH_META[budget.health];
  const consumedHours = budget.consumed.seconds / 3600;
  const remainingHours = budget.sold.hours - consumedHours;
  const margin = isTm ? budget.consumed.value - budget.consumed.cost : budget.sold.amount - budget.consumed.cost;
  const open = offers.filter((o) => o.projectId === project.id && o.status !== "ordered");

  return (
    <div className="mt-4">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Lozenge appearance={health.appearance} isBold>{health.name}</Lozenge>
        <span className="text-sm text-ds-text-subtle">
          {budget.sold.orders === 0
            ? "No order yet: nothing has been sold on this project, so consumed hours are compared with nothing."
            : isTm
              ? `Time & material: the order is a ceiling of ${budget.sold.hours}h. Revenue is billable hours at the billing rate.`
              : `Fixed price: revenue is the ${formatMoney(budget.sold.amount, cur)} sold. Consumed hours drive cost and eat the margin.`}
        </span>
        <Link href={`/projects/${project.key}/offers`} className="ml-auto text-sm text-ds-link hover:underline">Offers</Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="Sold" value={formatMoney(budget.sold.amount, cur)} hint={`${budget.sold.hours}h · ${formatDays(budget.sold.hours * 3600, settings)} · ${budget.sold.orders} order${budget.sold.orders === 1 ? "" : "s"}`} />
        <StatTile label={isTm ? "Consumed (revenue)" : "Consumed (at price)"} value={formatMoney(budget.consumed.value, cur)} hint={`${formatDurationShort(budget.consumed.seconds)} · ${formatDays(budget.consumed.seconds, settings)}`} />
        <StatTile
          label="Remaining"
          value={budget.sold.hours ? <span className={cn(remainingHours < 0 && "text-ds-text-danger")}>{formatDurationShort(Math.abs(remainingHours) * 3600)}{remainingHours < 0 ? " over" : ""}</span> : "—"}
          hint={budget.sold.hours ? `${budget.pctHours}% of sold hours used · ${formatMoney(Math.max(0, budget.sold.amount - budget.consumed.value), cur)} left at price` : "No order to compare with"}
        />
        <StatTile label="Cost" value={formatMoney(budget.consumed.cost, cur)} hint="All hours x cost rate" />
        <StatTile label="Margin" value={<span className={cn(margin < 0 && "text-ds-text-danger")}>{formatMoney(margin, cur)}</span>} hint={isTm ? "Revenue minus cost" : "Sold minus cost so far"} />
      </div>

      {budget.sold.hours > 0 && (
        <div className="mt-4 rounded-ds-lg border border-ds-border bg-ds-surface p-4 shadow-ds-raised">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold">Hours: consumed vs sold</span>
            <span className="text-ds-text-subtle">
              {budget.burnPerWeek > 0 ? `Burning ${Math.round(budget.burnPerWeek)}h / week` : "No recent activity"}
              {budget.runOut && ` · at this pace sold hours run out on ${format(budget.runOut, "d MMM yyyy")}`}
            </span>
          </div>
          <ProgressBar
            height={10}
            segments={[
              { value: Math.min(consumedHours, budget.sold.hours), color: health.color, label: "Consumed" },
              { value: Math.max(0, budget.sold.hours - consumedHours), color: "var(--ds-chart-track)", label: "Remaining" },
            ]}
          />
          <div className="mt-1 flex justify-between text-xs text-ds-text-subtlest">
            <span>{formatDurationShort(budget.consumed.seconds)} consumed</span>
            <span>{budget.sold.hours}h sold</span>
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <ChartCard title="Burn" subtitle="Cumulative consumed hours per week against the planned ramp from the order lines and the total sold.">
          {burn.length > 1 ? (
            <LineChart
              points={burn.map((b) => ({ id: b.id, label: b.label }))}
              series={[
                { id: "consumed", name: "Consumed", color: "#2a78d6", values: burn.map((b) => (b.consumed === null ? null : b.consumed)) },
                { id: "planned", name: "Planned", color: "#eb6834", values: burn.map((b) => b.planned) },
              ]}
              guide={burn.map((b) => (b.sold ? b.sold : null))}
              guideLabel="Sold"
              format={(v) => `${Math.round(v)}h`}
              height={240}
            />
          ) : (
            <div className="py-8 text-center text-sm text-ds-text-subtlest">Not enough data yet.</div>
          )}
        </ChartCard>
        <ChartCard title="Pipeline" subtitle="Open offers are not counted in the budget until they become orders.">
          {open.length === 0 && <div className="text-sm text-ds-text-subtlest">No open offers.</div>}
          <ul className="divide-y divide-ds-border">
            {open.map((o) => (
              <li key={o.id} className="flex items-center gap-3 py-2 text-sm">
                <Link href={`/projects/${project.key}/offers/${o.id}`} className="w-20 shrink-0 font-medium text-ds-link hover:underline">{o.number}</Link>
                <span className="min-w-0 flex-1 truncate">{o.title}</span>
                <OfferStatusLozenge status={o.status} />
                <span className="tabular-nums w-24 text-right">{formatMoney(offerTotals(o).total, cur)}</span>
              </li>
            ))}
          </ul>
          {open.length > 0 && (
            <div className="mt-3 flex justify-between border-t border-ds-border pt-2 text-sm">
              <span className="text-ds-text-subtle">Potential</span>
              <span className="tabular-nums font-semibold">{formatMoney(budget.pipeline.amount, cur)} · {budget.pipeline.hours}h</span>
            </div>
          )}
        </ChartCard>
      </div>

      <ChartCard title="By order line" subtitle="Each line of an order became a work item; hours tracked on it and its children are compared with what was sold." className="mt-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ds-text-subtle">
              <th className="pb-2 font-semibold">Line / work item</th>
              <th className="pb-2 font-semibold">Offer</th>
              <th className="w-44 pb-2 font-semibold">Consumed vs sold</th>
              <th className="pb-2 text-right font-semibold">Sold h</th>
              <th className="pb-2 text-right font-semibold">Consumed h</th>
              <th className="pb-2 text-right font-semibold">Remaining</th>
              <th className="pb-2 text-right font-semibold">Sold</th>
              <th className="pb-2 text-right font-semibold">At price</th>
              <th className="pb-2 text-right font-semibold">Cost</th>
              <th className="pb-2 text-right font-semibold">Margin</th>
            </tr>
          </thead>
          <tbody>
            {budget.lines.map((l) => {
              const ch = l.consumed.seconds / 3600;
              const pct = l.soldHours ? Math.round((ch / l.soldHours) * 100) : 0;
              const h = HEALTH_META[l.soldHours ? (pct > 100 ? "over" : pct >= 80 ? "warn" : "ok") : "none"];
              const m = isTm ? l.consumed.value - l.consumed.cost : l.soldAmount - l.consumed.cost;
              const issue = l.issueId ? issues.find((i) => i.id === l.issueId) : undefined;
              return (
                <tr key={l.id} className="border-t border-ds-border">
                  <td className="py-2 pr-3">
                    {issue ? (
                      <Link href={`/browse/${issue.key}`} className="flex items-center gap-2 hover:underline"><IssueTypeIcon type={issue.type} size={14} /> <span className="text-xs text-ds-text-subtle">{issue.key}</span> <span className="truncate">{l.name}</span></Link>
                    ) : (
                      <span className="text-ds-text-subtle">{l.name} <span className="text-xs text-ds-text-subtlest">(not converted)</span></span>
                    )}
                  </td>
                  <td className="py-2 pr-3"><Link href={`/projects/${project.key}/offers/${l.offerId}`} className="text-xs text-ds-link hover:underline">{l.offerNumber}</Link></td>
                  <td className="py-2 pr-3">
                    <ProgressBar height={6} segments={[{ value: Math.min(ch, l.soldHours || ch), color: h.color }, { value: Math.max(0, l.soldHours - ch), color: "var(--ds-chart-track)" }]} />
                    <div className="mt-0.5 text-[11px] text-ds-text-subtlest">{pct}%</div>
                  </td>
                  <td className="tabular-nums py-2 text-right">{l.soldHours}h</td>
                  <td className="tabular-nums py-2 text-right">{formatDurationShort(l.consumed.seconds)}</td>
                  <td className={cn("tabular-nums py-2 text-right", l.soldHours - ch < 0 && "font-semibold text-ds-text-danger")}>{l.soldHours - ch < 0 ? "-" : ""}{formatDurationShort(Math.abs(l.soldHours - ch) * 3600)}</td>
                  <td className="tabular-nums py-2 text-right">{formatMoney(l.soldAmount, cur)}</td>
                  <td className="tabular-nums py-2 text-right text-ds-text-subtle">{formatMoney(l.consumed.value, cur)}</td>
                  <td className="tabular-nums py-2 text-right text-ds-text-subtle">{formatMoney(l.consumed.cost, cur)}</td>
                  <td className={cn("tabular-nums py-2 text-right", m < 0 ? "text-ds-text-danger" : "text-ds-text-subtle")}>{formatMoney(m, cur)}</td>
                </tr>
              );
            })}
            {budget.unattributed.entries > 0 && (
              <tr className="border-t border-ds-border">
                <td className="py-2 pr-3 text-ds-text-subtle" colSpan={2}>
                  Not attributed to an order line
                  <span className="block text-xs text-ds-text-subtlest">{budget.unattributed.entries} entries without a work item, or on work items that did not come from an order</span>
                </td>
                <td className="py-2 pr-3" />
                <td className="tabular-nums py-2 text-right text-ds-text-subtlest">—</td>
                <td className="tabular-nums py-2 text-right">{formatDurationShort(budget.unattributed.seconds)}</td>
                <td className="tabular-nums py-2 text-right text-ds-text-subtlest">—</td>
                <td className="tabular-nums py-2 text-right text-ds-text-subtlest">—</td>
                <td className="tabular-nums py-2 text-right text-ds-text-subtle">{formatMoney(budget.unattributed.value, cur)}</td>
                <td className="tabular-nums py-2 text-right text-ds-text-subtle">{formatMoney(budget.unattributed.cost, cur)}</td>
                <td className="tabular-nums py-2 text-right text-ds-text-subtle">—</td>
              </tr>
            )}
            {budget.lines.length === 0 && budget.unattributed.entries === 0 && (
              <tr><td colSpan={10} className="py-6 text-center text-ds-text-subtlest">No orders and no tracked time yet.</td></tr>
            )}
          </tbody>
          {budget.lines.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-ds-border font-semibold">
                <td className="py-2" colSpan={3}>Total</td>
                <td className="tabular-nums py-2 text-right">{budget.sold.hours}h</td>
                <td className="tabular-nums py-2 text-right">{formatDurationShort(budget.consumed.seconds)}</td>
                <td className={cn("tabular-nums py-2 text-right", remainingHours < 0 && "text-ds-text-danger")}>{remainingHours < 0 ? "-" : ""}{formatDurationShort(Math.abs(remainingHours) * 3600)}</td>
                <td className="tabular-nums py-2 text-right">{formatMoney(budget.sold.amount, cur)}</td>
                <td className="tabular-nums py-2 text-right">{formatMoney(budget.consumed.value, cur)}</td>
                <td className="tabular-nums py-2 text-right">{formatMoney(budget.consumed.cost, cur)}</td>
                <td className={cn("tabular-nums py-2 text-right", margin < 0 && "text-ds-text-danger")}>{formatMoney(margin, cur)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </ChartCard>
    </div>
  );
}
