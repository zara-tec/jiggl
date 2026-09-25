"use client";

import * as React from "react";
import Link from "next/link";
import { MoreHorizontal, Plus, StickyNote, Trash2, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useEffectiveEntries, useProjectTeam } from "@/hooks/useData";
import type { ForecastActivity, ID, Offer, OfferLine, Project, User, WorkspaceSettings } from "@/lib/types";
import { activityHours, currentForecast, forecastMembers, formatEffort, fromUnit, lineActivities, rateBook, toUnit, trackedByLine, type EffortUnit } from "@/lib/forecast";
import { isOrder } from "@/lib/offers";
import { formatMoney } from "@/lib/rates";
import { cn } from "@/lib/utils";
import { pickable } from "@/lib/team";
import { Avatar } from "@/components/ui/Avatar";
import { Select } from "@/components/ui/Select";
import { ColumnsChip } from "@/components/ui/ColumnsChip";
import { Lozenge } from "@/components/ui/Lozenge";
import { IconButton } from "@/components/ui/Button";
import { DropdownMenu, MenuItem } from "@/components/ui/Popover";
import { IssueTypeIcon } from "@/components/issues/icons";

type Settings = Pick<WorkspaceSettings, "hoursPerDay" | "currency">;
type Fmt = (h: number, opts?: { zero?: string; signed?: boolean }) => string;

const NONE: string[] = [];

/**
 * Forecast matrix: offer lines as group rows, their activities as sub-rows,
 * one column per member with the hours (or days) that person is expected to
 * spend. Totals compare the forecast with the hours sold and value it at cost.
 */
export function ForecastMatrix({ offer, project }: { offer: Offer; project: Project }) {
  const users = useStore((s) => s.users);
  const settings = useStore((s) => s.settings);
  const issues = useStore((s) => s.issues);
  const unit = useStore((s) => s.ui.forecastUnit);
  const setUnit = useStore((s) => s.setForecastUnit);
  const shown = useStore((s) => s.ui.tableColumns?.forecast ?? NONE);
  const toggleColumn = useStore((s) => s.toggleTableColumn);
  const addActivity = useStore((s) => s.addForecastActivity);
  const entries = useEffectiveEntries();
  const team = useProjectTeam(project.id);
  const [extra, setExtra] = React.useState<ID[]>([]);
  const order = isOrder(offer);
  const showNote = shown.includes("note");
  const showTracked = order && shown.includes("tracked");

  const forecast = React.useMemo(() => currentForecast(offer, users, project), [offer, users, project]);
  const rates = React.useMemo(() => rateBook(users, project), [users, project]);
  const tracked = React.useMemo(() => (showTracked ? trackedByLine(offer, issues, entries) : {}), [showTracked, offer, issues, entries]);
  const members = React.useMemo(() => {
    const ids = new Set([...forecastMembers(offer.lines), ...extra]);
    return users.filter((u) => ids.has(u.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [offer.lines, extra, users]);
  const available = React.useMemo(() => pickable(team).filter((u) => !members.some((m) => m.id === u.id)).sort((a, b) => a.name.localeCompare(b.name)), [team, members]);
  const lines = React.useMemo(() => [...offer.lines].sort((a, b) => a.order - b.order), [offer.lines]);
  const byLine = new Map(forecast.lines.map((l) => [l.lineId, l]));
  const fmt: Fmt = (h, opts) => formatEffort(h, unit, settings, opts);
  const cur = settings.currency;
  const trackedByUser: Record<ID, number> = {};
  for (const perUser of Object.values(tracked)) for (const [uid, secs] of Object.entries(perUser)) trackedByUser[uid] = (trackedByUser[uid] ?? 0) + secs;
  const trackedOfLine = (lineId: ID) => Object.values(tracked[lineId] ?? {}).reduce((a, s) => a + s, 0);
  const trackedTotal = Object.values(trackedByUser).reduce((a, s) => a + s, 0);
  const delta = forecast.hours - forecast.soldHours;
  const optionalColumns = [
    { id: "note", label: "Note", description: "A remark on each activity" },
    ...(order ? [{ id: "tracked", label: "Tracked", description: "Time tracked on the work items, per member and per line" }] : []),
  ];
  const leading = 1 + (showNote ? 1 : 0);
  const trailing = 4 + (showTracked ? 1 : 0) + 1;
  const cols = leading + members.length + trailing;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select
          value={unit}
          onChange={(v) => v && setUnit(v as EffortUnit)}
          searchable={false}
          appearance="chip"
          chipLabel="Unit"
          options={[
            { value: "hours", label: "Hours" },
            { value: "days", label: `Days (${settings.hoursPerDay}h)` },
          ]}
        />
        <Select
          value={null}
          onChange={(v) => v && setExtra((x) => (x.includes(v) ? x : [...x, v]))}
          appearance="chip"
          chipLabel="Add member"
          placeholder="Add member"
          isDisabled={available.length === 0}
          options={available.map((u) => ({ value: u.id, label: u.name, icon: <Avatar user={u} size="xs" />, description: `${formatMoney(rates.cost[u.id] ?? 0, cur)}/h cost` }))}
          menuClassName="w-72"
        />
        <ColumnsChip columns={optionalColumns} shown={shown.filter((c) => optionalColumns.some((o) => o.id === c))} onToggle={(id) => toggleColumn("forecast", id)} />
        {forecast.unsoldHours > 0 && (
          <Lozenge appearance="removed" className="ml-1">
            {fmt(forecast.unsoldHours)} unsold
          </Lozenge>
        )}
        <span className="ml-auto text-sm text-ds-text-subtle">
          Forecast <b className="tabular-nums text-ds-text">{fmt(forecast.hours, { zero: "0h" })}</b> vs <span className="tabular-nums">{fmt(forecast.soldHours, { zero: "0h" })}</span> sold · cost <span className="tabular-nums">{formatMoney(forecast.cost, cur)}</span> · expected margin{" "}
          <b className={cn("tabular-nums", forecast.margin < 0 ? "text-ds-text-danger" : "text-ds-text")}>{formatMoney(forecast.margin, cur)}</b> ({forecast.marginPct}%)
        </span>
      </div>

      <div className="overflow-x-auto rounded-ds border border-ds-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ds-surface-sunken text-left text-xs text-ds-text-subtle">
              <th className="sticky left-0 z-10 bg-ds-surface-sunken py-2 pl-3 pr-2 font-semibold" style={{ minWidth: 260 }}>
                Line / activity
              </th>
              {showNote && <th className="py-2 pr-2 font-semibold" style={{ minWidth: 180 }}>Note</th>}
              {members.map((u) => (
                <th key={u.id} className="px-1 py-2 text-center font-semibold" style={{ minWidth: 84 }} title={`${u.name} · ${formatMoney(rates.cost[u.id] ?? 0, cur)}/h cost`}>
                  <div className="group flex items-center justify-center gap-1">
                    <Avatar user={u} size="xs" />
                    <span className="max-w-20 truncate text-ds-text">{u.name.split(" ")[0]}</span>
                    {!forecast.byUser[u.id]?.hours && (
                      <button type="button" onClick={() => setExtra((x) => x.filter((id) => id !== u.id))} className="inline-flex size-4 items-center justify-center rounded-ds text-ds-icon-subtle opacity-0 hover:bg-ds-neutral-hovered group-hover:opacity-100" aria-label={`Remove ${u.name}`}>
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </th>
              ))}
              <th className="py-2 pr-2 text-right font-semibold" style={{ minWidth: 72 }}>Forecast</th>
              <th className="py-2 pr-2 text-right font-semibold" style={{ minWidth: 60 }}>Sold</th>
              <th className="py-2 pr-2 text-right font-semibold" style={{ minWidth: 52 }}>Δ</th>
              <th className="py-2 pr-2 text-right font-semibold" style={{ minWidth: 80 }}>Cost</th>
              {showTracked && <th className="py-2 pr-2 text-right font-semibold" style={{ minWidth: 72 }}>Tracked</th>}
              <th className="w-8 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const lf = byLine.get(line.id);
              const acts = lineActivities(line);
              const issue = line.issueId ? issues.find((i) => i.id === line.issueId) : undefined;
              const lineDelta = (lf?.hours ?? 0) - (line.hours || 0);
              return (
                <React.Fragment key={line.id}>
                  <tr className="border-t border-ds-border bg-ds-surface-sunken">
                    <td className="sticky left-0 z-10 bg-ds-surface-sunken py-1.5 pl-3 pr-2">
                      <div className="flex h-6 items-center gap-2">
                        <span className="w-5 shrink-0 text-xs text-ds-text-subtle">{line.order}</span>
                        <IssueTypeIcon type={line.issueType} size={14} />
                        <span className="min-w-0 truncate">
                          {line.section && <span className="mr-1.5 text-[11px] font-bold uppercase tracking-wide text-ds-text-subtlest">{line.section}</span>}
                          <span className="font-semibold">{line.description || `Line ${line.order}`}</span>
                        </span>
                        {issue && (
                          <Link href={`/browse/${issue.key}`} className="shrink-0 text-xs text-ds-link hover:underline">
                            {issue.key}
                          </Link>
                        )}
                      </div>
                    </td>
                    {showNote && <td />}
                    {members.map((u) => {
                      const h = lf?.byUser[u.id] ?? 0;
                      const t = tracked[line.id]?.[u.id] ?? 0;
                      return (
                        <td key={u.id} className="tabular-nums whitespace-nowrap px-1 py-1.5 text-center font-semibold">
                          {fmt(h) || <span className="font-normal text-ds-text-subtlest">·</span>}
                          {showTracked && t > 0 && <span className="ml-1 text-[11px] font-normal text-ds-text-subtlest" title="Tracked on the work item and its children">{fmt(t / 3600)}</span>}
                        </td>
                      );
                    })}
                    <td className="tabular-nums py-1.5 pr-2 text-right font-semibold">{fmt(lf?.hours ?? 0, { zero: "—" })}</td>
                    <td className="tabular-nums py-1.5 pr-2 text-right text-ds-text-subtle">{fmt(line.hours || 0, { zero: "—" })}</td>
                    <td className={cn("tabular-nums py-1.5 pr-2 text-right", lineDelta > 0 ? "font-semibold text-ds-text-danger" : "text-ds-text-subtle")}>{lf?.hours || line.hours ? fmt(lineDelta, { zero: "0", signed: true }) : "—"}</td>
                    <td className="tabular-nums py-1.5 pr-2 text-right font-semibold">{lf?.cost ? formatMoney(lf.cost, cur) : "—"}</td>
                    {showTracked && <td className="tabular-nums py-1.5 pr-2 text-right text-ds-text-subtle">{trackedOfLine(line.id) ? fmt(trackedOfLine(line.id) / 3600) : "—"}</td>}
                    <td />
                  </tr>
                  {acts.map((a) => (
                    <ActivityRow key={a.id} offer={offer} line={line} activity={a} members={members} unit={unit} settings={settings} rates={rates.cost} fmt={fmt} showNote={showNote} showTracked={showTracked} />
                  ))}
                  <tr>
                    <td colSpan={cols} className="sticky left-0 py-0.5 pl-9">
                      <button type="button" onClick={() => addActivity(offer.id, line.id)} className="flex h-6 items-center gap-1 rounded-ds px-1.5 text-xs font-medium text-ds-text-subtle hover:bg-ds-neutral-subtle-hovered">
                        <Plus size={14} /> Add activity
                      </button>
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
            {lines.length === 0 && (
              <tr>
                <td colSpan={cols} className="py-8 text-center text-ds-text-subtlest">
                  Add lines to the offer first: each line becomes a group of the forecast.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="text-xs">
            <tr className="border-t-2 border-ds-border bg-ds-surface-sunken font-semibold">
              <td className="sticky left-0 z-10 bg-ds-surface-sunken py-2 pl-3 text-sm">Forecast</td>
              {showNote && <td />}
              {members.map((u) => (
                <td key={u.id} className="tabular-nums px-1 py-2 text-center text-sm">{fmt(forecast.byUser[u.id]?.hours ?? 0, { zero: "·" })}</td>
              ))}
              <td className="tabular-nums py-2 pr-2 text-right text-sm">{fmt(forecast.hours, { zero: "0h" })}</td>
              <td className="tabular-nums py-2 pr-2 text-right text-sm text-ds-text-subtle">{fmt(forecast.soldHours, { zero: "0h" })}</td>
              <td className={cn("tabular-nums py-2 pr-2 text-right text-sm", delta > 0 ? "text-ds-text-danger" : "text-ds-text-subtle")}>{fmt(delta, { zero: "0", signed: true })}</td>
              <td className="tabular-nums py-2 pr-2 text-right text-sm">{formatMoney(forecast.cost, cur)}</td>
              {showTracked && <td className="tabular-nums py-2 pr-2 text-right text-sm text-ds-text-subtle">{trackedTotal ? fmt(trackedTotal / 3600) : "—"}</td>}
              <td />
            </tr>
            <tr className="border-t border-ds-border text-ds-text-subtle">
              <td className="sticky left-0 z-10 bg-ds-surface py-1.5 pl-3">Cost rate</td>
              {showNote && <td />}
              {members.map((u) => (
                <td key={u.id} className="tabular-nums px-1 py-1.5 text-center">{formatMoney(rates.cost[u.id] ?? 0, cur)}/h</td>
              ))}
              <td colSpan={trailing} className="py-1.5 pr-2 text-right">In force today, with the project overrides</td>
            </tr>
            <tr className="border-t border-ds-border text-ds-text-subtle">
              <td className="sticky left-0 z-10 bg-ds-surface py-1.5 pl-3">Cost</td>
              {showNote && <td />}
              {members.map((u) => (
                <td key={u.id} className="tabular-nums px-1 py-1.5 text-center">{forecast.byUser[u.id]?.cost ? formatMoney(forecast.byUser[u.id].cost, cur) : "·"}</td>
              ))}
              <td colSpan={trailing} className="py-1.5 pr-2 text-right">
                {forecast.unsoldHours > 0 ? `${formatMoney(forecast.unsoldCost, cur)} of it for unsold work` : "Hours × cost rate"}
              </td>
            </tr>
            {showTracked && (
              <tr className="border-t border-ds-border text-ds-text-subtle">
                <td className="sticky left-0 z-10 bg-ds-surface py-1.5 pl-3">Tracked so far</td>
                {showNote && <td />}
                {members.map((u) => (
                  <td key={u.id} className="tabular-nums px-1 py-1.5 text-center">{trackedByUser[u.id] ? fmt(trackedByUser[u.id] / 3600) : "·"}</td>
                ))}
                <td colSpan={trailing} className="py-1.5 pr-2 text-right">
                  {(() => {
                    const others = Object.entries(trackedByUser).filter(([uid]) => !members.some((m) => m.id === uid));
                    const secs = others.reduce((a, [, s]) => a + s, 0);
                    return secs > 0 ? `${fmt(secs / 3600)} tracked by ${others.length} member${others.length === 1 ? "" : "s"} outside the forecast` : "On the work items of this order";
                  })()}
                </td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>
      {members.length === 0 && lines.length > 0 && <p className="mt-2 text-xs text-ds-text-subtlest">Add a member to start forecasting: each cell is the effort that person will spend on the activity.</p>}
    </div>
  );
}

function ActivityRow({ offer, line, activity, members, unit, settings, rates, fmt, showNote, showTracked }: { offer: Offer; line: OfferLine; activity: ForecastActivity; members: User[]; unit: EffortUnit; settings: Settings; rates: Record<ID, number>; fmt: Fmt; showNote: boolean; showTracked: boolean }) {
  const update = useStore((s) => s.updateForecastActivity);
  const remove = useStore((s) => s.removeForecastActivity);
  const setEffort = useStore((s) => s.setForecastEffort);
  const hours = activityHours(activity);
  const cost = Object.entries(activity.effort ?? {}).reduce((a, [uid, h]) => a + (h || 0) * (rates[uid] ?? 0), 0);
  return (
    <tr className={cn("border-t border-ds-border", activity.unsold ? "bg-ds-danger" : "hover:bg-ds-surface-hovered")}>
      <td className={cn("sticky left-0 z-10 py-0.5 pl-9 pr-2", activity.unsold ? "bg-ds-danger" : "bg-ds-surface")}>
        <div className="flex items-center gap-1.5">
          {activity.unsold && <Lozenge appearance="removed" className="shrink-0">Unsold</Lozenge>}
          <NameCell value={activity.name} onSave={(v) => update(offer.id, line.id, activity.id, { name: v })} placeholder="Activity" className="min-w-0 flex-1 font-medium" />
          {!showNote && activity.note && <StickyNote size={12} className="shrink-0 text-ds-icon-subtle" aria-label="Has a note" />}
        </div>
      </td>
      {showNote && (
        <td className="py-0.5 pr-2">
          <NameCell value={activity.note ?? ""} onSave={(v) => update(offer.id, line.id, activity.id, { note: v || undefined })} placeholder="Add a note" className="text-xs text-ds-text-subtle" />
        </td>
      )}
      {members.map((u) => (
        <td key={u.id} className="px-1 py-0.5 text-center">
          <EffortCell hours={activity.effort?.[u.id] ?? 0} unit={unit} settings={settings} onSave={(h) => setEffort(offer.id, line.id, activity.id, u.id, h)} label={`${u.name} on ${activity.name || "activity"}`} />
        </td>
      ))}
      <td className="tabular-nums py-1 pr-2 text-right">{fmt(hours, { zero: "—" })}</td>
      <td className="py-1 pr-2 text-right text-xs text-ds-text-subtlest">{activity.unsold ? "not sold" : ""}</td>
      <td />
      <td className="tabular-nums py-1 pr-2 text-right text-ds-text-subtle">{cost ? formatMoney(cost, settings.currency) : "—"}</td>
      {showTracked && <td />}
      <td className="py-0.5 text-center">
        <DropdownMenu align="end" trigger={({ ref, toggle }) => <IconButton ref={ref} icon={<MoreHorizontal />} label="Activity actions" spacing="compact" onClick={toggle} />}>
          {({ close }) => (
            <>
              <MenuItem onClick={() => { update(offer.id, line.id, activity.id, { unsold: !activity.unsold }); close(); }} description={activity.unsold ? "Counts against the sold hours again" : "Extra work the client did not buy: it costs, it does not bill"}>
                {activity.unsold ? "Mark as sold" : "Mark as unsold"}
              </MenuItem>
              <MenuItem icon={<Trash2 />} className="text-ds-text-danger" onClick={() => { remove(offer.id, line.id, activity.id); close(); }}>
                Delete activity
              </MenuItem>
            </>
          )}
        </DropdownMenu>
      </td>
    </tr>
  );
}

function NameCell({ value, onSave, placeholder, className }: { value: string; onSave: (v: string) => void; placeholder?: string; className?: string }) {
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => setDraft(value), [value]);
  return (
    <input
      value={draft}
      placeholder={placeholder}
      title={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft.trim() !== value && onSave(draft.trim())}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setDraft(value);
      }}
      className={cn("block h-7 w-full min-w-0 rounded-ds border border-transparent bg-transparent px-1 placeholder:text-ds-text-subtlest hover:border-ds-border focus:border-ds-border-focused focus:bg-ds-input focus:outline-none", className)}
    />
  );
}

function EffortCell({ hours, unit, settings, onSave, label }: { hours: number; unit: EffortUnit; settings: Settings; onSave: (hours: number) => void; label: string }) {
  const shown = hours ? String(Math.round(toUnit(hours, unit, settings) * 100) / 100) : "";
  const [draft, setDraft] = React.useState(shown);
  React.useEffect(() => setDraft(shown), [shown]);
  const commit = () => {
    const raw = draft.trim();
    const n = raw === "" ? 0 : Number(raw.replace(",", "."));
    if (Number.isNaN(n) || n < 0) return setDraft(shown);
    const h = Math.round(fromUnit(n, unit, settings) * 100) / 100;
    if (h !== (hours || 0)) onSave(h);
  };
  return (
    <input
      value={draft}
      inputMode="decimal"
      aria-label={label}
      onChange={(e) => setDraft(e.target.value.replace(/[^\d.,]/g, ""))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setDraft(shown);
      }}
      className={cn("h-7 w-full min-w-0 rounded-ds border border-transparent bg-transparent text-center tabular-nums hover:border-ds-border focus:border-ds-border-focused focus:bg-ds-input focus:outline-none", !hours && "text-ds-text-subtlest")}
    />
  );
}
