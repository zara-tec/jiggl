"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { Camera, MoreHorizontal, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import type { ID, Offer, OfferBaseline, Project } from "@/lib/types";
import { baselineForecast, compareForecasts, currentForecast, formatEffort, lineActivities, rateBook, type ForecastDelta, type OfferForecast } from "@/lib/forecast";
import { formatMoney } from "@/lib/rates";
import { inTeam } from "@/lib/team";
import { cn, relativeTime } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { Button, IconButton } from "@/components/ui/Button";
import { Lozenge, type LozengeAppearance } from "@/components/ui/Lozenge";
import { Modal } from "@/components/ui/Modal";
import { DropdownMenu, MenuItem } from "@/components/ui/Popover";
import { EmptyState } from "@/components/ui/misc";
import { StatTile } from "@/components/reports/charts";

/**
 * Baselines of an offer: frozen copies of lines, forecast and rates. The
 * selected one is compared with the live forecast, line by line and member
 * by member, so that extra scope and team changes show up as cost and margin.
 */
export function BaselinesPanel({ offer, project }: { offer: Offer; project: Project }) {
  const users = useStore((s) => s.users);
  const settings = useStore((s) => s.settings);
  const all = useStore((s) => s.offerBaselines);
  const unit = useStore((s) => s.ui.forecastUnit);
  const deleteBaseline = useStore((s) => s.deleteBaseline);
  const baselines = React.useMemo(() => all.filter((b) => b.offerId === offer.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [all, offer.id]);
  const [selectedId, setSelectedId] = React.useState<ID | null>(null);
  const [open, setOpen] = React.useState(false);
  const selected = baselines.find((b) => b.id === selectedId) ?? baselines[0];
  const now = React.useMemo(() => currentForecast(offer, users, project), [offer, users, project]);
  const rates = React.useMemo(() => rateBook(users, project), [users, project]);
  const then = React.useMemo(() => (selected ? baselineForecast(selected, project.pricing) : undefined), [selected, project.pricing]);
  const delta = React.useMemo(() => (then ? compareForecasts(then, now) : undefined), [then, now]);
  const cur = settings.currency;
  const fmt = (h: number, opts?: { zero?: string; signed?: boolean }) => formatEffort(h, unit, settings, opts);
  const userOf = (id: ID) => users.find((u) => u.id === id);

  return (
    <div>
      <div className="flex items-start justify-between gap-6">
        <p className="text-sm text-ds-text-subtle">A baseline freezes the lines, the forecast and the rates in force at that moment. The order baseline is taken automatically; take one whenever the plan changes, then compare it with the current forecast.</p>
        <Button appearance="primary" iconBefore={<Camera />} onClick={() => setOpen(true)} className="shrink-0">
          Take baseline
        </Button>
      </div>

      {baselines.length === 0 ? (
        <EmptyState icon={<Camera />} title="No baselines yet" description="Take a baseline to remember what was planned and sold at this point; later revisions of the forecast will be compared with it." action={<Button appearance="primary" onClick={() => setOpen(true)}>Take baseline</Button>} />
      ) : (
        <>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ds-text-subtle">
                <th className="border-b border-ds-border py-2 font-semibold">Baseline</th>
                <th className="border-b border-ds-border py-2 font-semibold">Taken</th>
                <th className="border-b border-ds-border py-2 text-right font-semibold">Forecast</th>
                <th className="border-b border-ds-border py-2 text-right font-semibold">Cost</th>
                <th className="border-b border-ds-border py-2 text-right font-semibold">Sold</th>
                <th className="border-b border-ds-border py-2 text-right font-semibold">Margin</th>
                <th className="w-8 border-b border-ds-border py-2" />
              </tr>
            </thead>
            <tbody>
              {baselines.map((b) => {
                const f = baselineForecast(b, project.pricing);
                const isSel = b.id === selected?.id;
                const by = userOf(b.createdBy);
                return (
                  <tr key={b.id} onClick={() => setSelectedId(b.id)} className={cn("cursor-pointer hover:bg-ds-surface-hovered", isSel && "bg-ds-selected hover:bg-ds-selected-hovered")} aria-selected={isSel}>
                    <td className="border-b border-ds-border py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{b.name}</span>
                        <Lozenge appearance={b.kind === "order" ? "success" : "default"}>{b.kind === "order" ? "Order" : "Manual"}</Lozenge>
                      </div>
                      {b.note && <div className="text-xs text-ds-text-subtlest">{b.note}</div>}
                    </td>
                    <td className="border-b border-ds-border py-2 pr-3 text-ds-text-subtle">
                      <span className="flex items-center gap-2">
                        <Avatar user={by} size="xs" /> {format(parseISO(b.createdAt), "d MMM yyyy")} <span className="text-xs text-ds-text-subtlest">{relativeTime(b.createdAt)}</span>
                      </span>
                    </td>
                    <td className="tabular-nums border-b border-ds-border py-2 text-right">{fmt(f.hours, { zero: "0h" })}</td>
                    <td className="tabular-nums border-b border-ds-border py-2 text-right">{formatMoney(f.cost, cur)}</td>
                    <td className="tabular-nums border-b border-ds-border py-2 text-right">{formatMoney(f.soldAmount, cur)}</td>
                    <td className={cn("tabular-nums border-b border-ds-border py-2 text-right font-semibold", f.margin < 0 && "text-ds-text-danger")}>{formatMoney(f.margin, cur)} <span className="text-xs font-normal text-ds-text-subtlest">{f.marginPct}%</span></td>
                    <td className="border-b border-ds-border py-1 text-center" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu align="end" trigger={({ ref, toggle }) => <IconButton ref={ref} icon={<MoreHorizontal />} label="Baseline actions" spacing="compact" onClick={toggle} />}>
                        {({ close }) => (
                          <>
                            <MenuItem onClick={() => { setSelectedId(b.id); close(); }}>Compare with the current forecast</MenuItem>
                            <MenuItem icon={<Trash2 />} className="text-ds-text-danger" onClick={() => { close(); if (confirm(`Delete baseline "${b.name}"?`)) deleteBaseline(b.id); }}>
                              Delete baseline
                            </MenuItem>
                          </>
                        )}
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {selected && then && delta && <Comparison baseline={selected} then={then} delta={delta} fmt={fmt} currency={cur} costRates={rates.cost} userOf={userOf} offer={offer} project={project} />}
        </>
      )}

      <TakeBaselineModal open={open} onClose={() => setOpen(false)} offer={offer} count={baselines.length} />
    </div>
  );
}

const STATUS_META: Record<ForecastDelta["lines"][number]["status"], { name: string; appearance: LozengeAppearance }> = {
  same: { name: "Unchanged", appearance: "default" },
  changed: { name: "Changed", appearance: "moved" },
  added: { name: "Added", appearance: "new" },
  removed: { name: "Removed", appearance: "removed" },
};

function Comparison({ baseline, then, delta, fmt, currency, costRates, userOf, offer, project }: { baseline: OfferBaseline; then: OfferForecast; delta: ForecastDelta; fmt: (h: number, opts?: { zero?: string; signed?: boolean }) => string; currency: string; costRates: Record<ID, number>; userOf: (id: ID) => { name: string; id: string; color: string; email: string; role: "admin" | "pm" | "member"; costRates: { from: string; rate: number }[] } | undefined; offer: Offer; project: Project }) {
  const now = delta.after;
  const money = (v: number, signed = false) => `${signed && v > 0 ? "+" : ""}${formatMoney(v, currency)}`;
  const unsold = offer.lines.flatMap((l) => lineActivities(l).filter((a) => a.unsold).map((a) => ({ line: l, activity: a })));
  const changed = delta.lines.filter((l) => l.status !== "same");
  const movers = delta.members.filter((m) => Math.abs(m.hours) >= 0.05 || Math.abs(m.cost) >= 0.5);
  return (
    <div className="mt-6">
      <h3 className="ds-heading-sm mb-1">Since “{baseline.name}”</h3>
      <p className="mb-3 text-xs text-ds-text-subtlest">Then: the baseline valued at the rates of {format(parseISO(baseline.createdAt), "d MMM yyyy")}. Now: the current forecast at the rates in force today.</p>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Forecast effort" value={<Shift then={fmt(then.hours, { zero: "0h" })} now={fmt(now.hours, { zero: "0h" })} />} hint={`${fmt(delta.hours, { zero: "no change", signed: true })}${delta.unsoldHours ? ` · ${fmt(delta.unsoldHours, { signed: true })} unsold` : ""}`} />
        <StatTile label="Forecast cost" value={<Shift then={money(then.cost)} now={money(now.cost)} bad={delta.cost > 0} />} hint={delta.cost ? `${money(delta.cost, true)} from effort and rate changes` : "No change"} />
        <StatTile label="Revenue" value={<Shift then={money(then.revenue)} now={money(now.revenue)} />} hint={delta.revenue ? money(delta.revenue, true) : offer.status === "ordered" ? "What was sold" : "Sold amount if ordered"} />
        <StatTile label="Expected margin" value={<Shift then={`${money(then.margin)}`} now={`${money(now.margin)}`} bad={delta.margin < 0} />} hint={`${then.marginPct}% → ${now.marginPct}%${delta.margin ? ` · ${money(delta.margin, true)}` : ""}`} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div>
          <h4 className="mb-2 text-sm font-semibold">By line</h4>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ds-text-subtle">
                <th className="border-b border-ds-border py-1.5 font-semibold">Line</th>
                <th className="border-b border-ds-border py-1.5 text-right font-semibold">Forecast then → now</th>
                <th className="border-b border-ds-border py-1.5 text-right font-semibold">Cost Δ</th>
                <th className="border-b border-ds-border py-1.5 text-right font-semibold">Sold Δ</th>
              </tr>
            </thead>
            <tbody>
              {delta.lines.map((l) => (
                <tr key={l.lineId} className={cn(l.status === "same" && "text-ds-text-subtle")}>
                  <td className="border-b border-ds-border py-1.5 pr-2">
                    <span className="flex items-center gap-2">
                      <span className="truncate">{l.name}</span>
                      {l.status !== "same" && <Lozenge appearance={STATUS_META[l.status].appearance}>{STATUS_META[l.status].name}</Lozenge>}
                    </span>
                  </td>
                  <td className="tabular-nums whitespace-nowrap border-b border-ds-border py-1.5 text-right">
                    {fmt(l.before?.hours ?? 0, { zero: "0h" })} → {fmt(l.after?.hours ?? 0, { zero: "0h" })}
                    {l.hours ? <span className={cn("ml-1 text-xs", l.hours > 0 ? "text-ds-text-danger" : "text-ds-text-success")}>{fmt(l.hours, { signed: true })}</span> : null}
                  </td>
                  <td className={cn("tabular-nums whitespace-nowrap border-b border-ds-border py-1.5 text-right", l.cost > 0 && "text-ds-text-danger", l.cost < 0 && "text-ds-text-success")}>{l.cost ? money(l.cost, true) : "—"}</td>
                  <td className={cn("tabular-nums whitespace-nowrap border-b border-ds-border py-1.5 text-right", l.soldAmount !== 0 && "font-medium")}>{l.soldAmount || l.soldHours ? `${money(l.soldAmount, true)} · ${fmt(l.soldHours, { zero: "0h", signed: true })}` : "—"}</td>
                </tr>
              ))}
              {delta.lines.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-ds-text-subtlest">No lines.</td></tr>}
            </tbody>
            {changed.length === 0 && delta.lines.length > 0 && (
              <tfoot><tr><td colSpan={4} className="pt-2 text-xs text-ds-text-subtlest">No line changed since this baseline.</td></tr></tfoot>
            )}
          </table>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-semibold">By member</h4>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ds-text-subtle">
                <th className="border-b border-ds-border py-1.5 font-semibold">Member</th>
                <th className="border-b border-ds-border py-1.5 text-right font-semibold">Effort then → now</th>
                <th className="border-b border-ds-border py-1.5 text-right font-semibold">Cost rate</th>
                <th className="border-b border-ds-border py-1.5 text-right font-semibold">Cost Δ</th>
              </tr>
            </thead>
            <tbody>
              {delta.members.map((m) => {
                const u = userOf(m.userId);
                const rateThen = baseline.costRates?.[m.userId];
                const rateNow = costRates[m.userId] ?? 0;
                const quiet = Math.abs(m.hours) < 0.05 && Math.abs(m.cost) < 0.5;
                return (
                  <tr key={m.userId} className={cn(quiet && "text-ds-text-subtle")}>
                    <td className="border-b border-ds-border py-1.5 pr-2">
                      <span className="flex items-center gap-2">
                        <Avatar user={u} size="xs" /> {u?.name ?? m.userId}
                        {!m.before && <Lozenge appearance="new">Joined</Lozenge>}
                        {!m.after && <Lozenge appearance="removed">Left</Lozenge>}
                        {m.after && !inTeam(project, m.userId) && <Lozenge appearance="moved" maxWidth={120}>Not in team</Lozenge>}
                      </span>
                    </td>
                    <td className="tabular-nums whitespace-nowrap border-b border-ds-border py-1.5 text-right">
                      {fmt(m.before?.hours ?? 0, { zero: "0h" })} → {fmt(m.after?.hours ?? 0, { zero: "0h" })}
                      {m.hours ? <span className={cn("ml-1 text-xs", m.hours > 0 ? "text-ds-text-danger" : "text-ds-text-success")}>{fmt(m.hours, { signed: true })}</span> : null}
                    </td>
                    <td className="tabular-nums whitespace-nowrap border-b border-ds-border py-1.5 text-right text-ds-text-subtle">
                      {rateThen !== undefined && rateThen !== rateNow ? `${formatMoney(rateThen, currency)} → ${formatMoney(rateNow, currency)}` : formatMoney(rateNow, currency)}/h
                    </td>
                    <td className={cn("tabular-nums whitespace-nowrap border-b border-ds-border py-1.5 text-right", m.cost > 0 && "text-ds-text-danger", m.cost < 0 && "text-ds-text-success")}>{m.cost ? money(m.cost, true) : "—"}</td>
                  </tr>
                );
              })}
              {delta.members.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-ds-text-subtlest">Nobody is planned on this offer yet.</td></tr>}
            </tbody>
            {movers.length === 0 && delta.members.length > 0 && (
              <tfoot><tr><td colSpan={4} className="pt-2 text-xs text-ds-text-subtlest">Same team, same effort as the baseline.</td></tr></tfoot>
            )}
          </table>
        </div>
      </div>

      {unsold.length > 0 && (
        <div className="mt-6">
          <h4 className="mb-2 text-sm font-semibold">Unsold work in the current forecast</h4>
          <ul className="divide-y divide-ds-border rounded-ds border border-ds-border text-sm">
            {unsold.map(({ line, activity }) => {
              const cost = Object.entries(activity.effort ?? {}).reduce((a, [uid, h]) => a + (h || 0) * (costRates[uid] ?? 0), 0);
              const hours = Object.values(activity.effort ?? {}).reduce((a, h) => a + (h || 0), 0);
              return (
                <li key={activity.id} className="flex items-center gap-3 px-3 py-2">
                  <Lozenge appearance="removed">Unsold</Lozenge>
                  <span className="min-w-0 flex-1 truncate">
                    <span className="text-ds-text-subtle">{line.description || `Line ${line.order}`}</span> <span className="text-ds-text-subtlest">›</span> {activity.name || "Activity"}
                    {activity.note && <span className="ml-2 text-xs text-ds-text-subtlest">{activity.note}</span>}
                  </span>
                  <span className="tabular-nums w-16 text-right">{fmt(hours, { zero: "0h" })}</span>
                  <span className="tabular-nums w-24 text-right text-ds-text-subtle">{formatMoney(cost, currency)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function Shift({ then, now, bad }: { then: string; now: string; bad?: boolean }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-base font-normal text-ds-text-subtlest line-through decoration-ds-text-subtlest/60">{then}</span>
      <span className={cn(bad && "text-ds-text-danger")}>{now}</span>
    </span>
  );
}

function TakeBaselineModal({ open, onClose, offer, count }: { open: boolean; onClose: () => void; offer: Offer; count: number }) {
  const createBaseline = useStore((s) => s.createBaseline);
  const [name, setName] = React.useState("");
  const [note, setNote] = React.useState("");
  const wasOpen = React.useRef(false);
  React.useEffect(() => {
    if (open && !wasOpen.current) {
      setName(`Revision ${count + 1}`);
      setNote("");
    }
    wasOpen.current = open;
  }, [open, count]);
  const submit = () => {
    createBaseline(offer.id, { name, note });
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Take a baseline"
      width={480}
      footer={
        <>
          <Button appearance="subtle" onClick={onClose}>Cancel</Button>
          <Button appearance="primary" onClick={submit} disabled={!name.trim()}>Take baseline</Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-ds-text-subtle">Freezes the {offer.lines.length} line{offer.lines.length === 1 ? "" : "s"} of {offer.number}, their forecast and the cost and billing rates in force today.</p>
      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className="ds-input" autoFocus onKeyDown={(e) => e.key === "Enter" && name.trim() && submit()} />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Note</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="ds-input resize-y" placeholder="Why the plan changed (optional)" />
      </label>
    </Modal>
  );
}
