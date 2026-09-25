"use client";

import * as React from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlignLeft, GripVertical, Link2, Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { useLoggedByIssue } from "@/hooks/useData";
import type { Offer, OfferLine, OfferLineIssueType, OfferUnit } from "@/lib/types";
import { OFFER_UNITS, defaultLineHours, lineAmount, offerTotals } from "@/lib/offers";
import { dependentsOf } from "@/lib/schedule";
import { formatDays, formatMoney } from "@/lib/rates";
import { cn, formatDurationShort } from "@/lib/utils";
import { Select } from "@/components/ui/Select";
import { ColumnsChip } from "@/components/ui/ColumnsChip";
import { IssueTypeIcon } from "@/components/issues/icons";
import { ProgressBar } from "@/components/ui/misc";

const OPTIONAL_COLUMNS = [{ id: "details", label: "Details", description: "Longer text under each line" }];
const NONE: string[] = [];

export function OfferLinesTable({ offer, editable }: { offer: Offer; editable: boolean }) {
  const settings = useStore((s) => s.settings);
  const issues = useStore((s) => s.issues);
  const shown = useStore((s) => s.ui.tableColumns?.offerLines ?? NONE);
  const toggleColumn = useStore((s) => s.toggleTableColumn);
  const addLine = useStore((s) => s.addOfferLine);
  const moveLine = useStore((s) => s.moveOfferLine);
  const logged = useLoggedByIssue();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const lines = React.useMemo(() => [...offer.lines].sort((a, b) => a.order - b.order), [offer.lines]);
  const totals = offerTotals(offer);
  const showIssues = offer.lines.some((l) => l.issueId);
  const showDetails = shown.includes("details");
  const cols = 13 + (showDetails ? 1 : 0) + (showIssues ? 1 : 0) + (editable ? 1 : 0);

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const to = lines.findIndex((l) => l.id === over.id);
    moveLine(offer.id, String(active.id), to);
  };

  /** logged seconds on the created issue and its children */
  const loggedFor = (line: OfferLine) => {
    if (!line.issueId) return 0;
    const kids = issues.filter((i) => i.parentId === line.issueId).map((i) => i.id);
    return [line.issueId, ...kids].reduce((a, id) => a + (logged.get(id) ?? 0), 0);
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <ColumnsChip columns={OPTIONAL_COLUMNS} shown={shown} onToggle={(id) => toggleColumn("offerLines", id)} />
        <span className="text-xs text-ds-text-subtlest">A line that comes after another starts on the next working day after it ends, plus the lag; its start date is computed and only its end date is edited.</span>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className="overflow-x-auto rounded-ds border border-ds-border">
          <table className="w-full min-w-[1040px] table-fixed text-sm">
            <colgroup>
              <col style={{ width: 28 }} />
              <col style={{ width: 26 }} />
              <col style={{ width: 96 }} />
              <col />
              {showDetails && <col />}
              <col style={{ width: 36 }} />
              <col style={{ width: 48 }} />
              <col style={{ width: 40 }} />
              <col style={{ width: 78 }} />
              <col style={{ width: 84 }} />
              <col style={{ width: 56 }} />
              <col style={{ width: 112 }} />
              <col style={{ width: 108 }} />
              <col style={{ width: 108 }} />
              {showIssues && <col style={{ width: 140 }} />}
              {editable && <col style={{ width: 30 }} />}
            </colgroup>
            <thead>
              <tr className="bg-ds-surface-sunken text-left text-xs text-ds-text-subtle">
                <th className="py-2" />
                <th className="py-2 font-semibold">#</th>
                <th className="py-2 pr-2 font-semibold">Section</th>
                <th className="py-2 pr-2 font-semibold">Description</th>
                {showDetails && <th className="py-2 pr-2 font-semibold">Details</th>}
                <th className="py-2 font-semibold">Type</th>
                <th className="py-2 pr-1 text-right font-semibold">Qty</th>
                <th className="py-2 pl-1 font-semibold">Unit</th>
                <th className="py-2 pr-1 text-right font-semibold">Unit price</th>
                <th className="py-2 pr-2 text-right font-semibold">Amount</th>
                <th className="py-2 pr-1 text-right font-semibold">Hours</th>
                <th className="py-2 pl-1 font-semibold">After</th>
                <th className="py-2 pl-1 font-semibold">Start</th>
                <th className="py-2 pl-1 font-semibold">End</th>
                {showIssues && <th className="py-2 pl-2 font-semibold">Work item</th>}
                {editable && <th className="py-2" />}
              </tr>
            </thead>
            <SortableContext items={lines.map((l) => l.id)} strategy={verticalListSortingStrategy}>
              <tbody>
                {lines.map((line) => (
                  <LineRow key={line.id} offer={offer} line={line} lines={lines} editable={editable} settings={settings} loggedSeconds={loggedFor(line)} issueKey={issues.find((i) => i.id === line.issueId)?.key} showIssues={showIssues} showDetails={showDetails} />
                ))}
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={cols} className="py-8 text-center text-ds-text-subtlest">
                      No lines yet. Each line becomes a work item (usually an epic) when the offer is converted into an order.
                    </td>
                  </tr>
                )}
              </tbody>
            </SortableContext>
            <tfoot>
              {editable && (
                <tr>
                  <td colSpan={cols} className="border-t border-ds-border px-2 py-1">
                    <button type="button" onClick={() => addLine(offer.id)} className="flex h-8 items-center gap-1 rounded-ds px-2 text-sm font-medium text-ds-text-subtle hover:bg-ds-neutral-subtle-hovered">
                      <Plus size={16} /> Add line
                    </button>
                  </td>
                </tr>
              )}
              <tr className="border-t border-ds-border bg-ds-surface-sunken text-sm">
                <td colSpan={8 + (showDetails ? 1 : 0)} className="py-2 pr-2 text-right text-ds-text-subtle">
                  {(offer.discountPct ?? 0) > 0 ? (
                    <>
                      Subtotal <span className="tabular-nums">{formatMoney(totals.subtotal, settings.currency)}</span> · discount {offer.discountPct}% <span className="tabular-nums">-{formatMoney(totals.discount, settings.currency)}</span> · Total
                    </>
                  ) : (
                    "Total"
                  )}
                </td>
                <td className="tabular-nums py-2 pr-2 text-right font-semibold">{formatMoney(totals.total, settings.currency)}</td>
                <td className="tabular-nums py-2 pr-1 text-right font-semibold">{totals.hours}h</td>
                <td colSpan={cols - 10 - (showDetails ? 1 : 0)} className="py-2 pl-2 text-xs text-ds-text-subtlest">
                  {formatDays(totals.hours * 3600, settings)} at {settings.hoursPerDay}h/day
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </DndContext>
    </div>
  );
}

function LineRow({ offer, line, lines, editable, settings, loggedSeconds, issueKey, showIssues, showDetails }: { offer: Offer; line: OfferLine; lines: OfferLine[]; editable: boolean; settings: { currency: string; hoursPerDay: number }; loggedSeconds: number; issueKey?: string; showIssues: boolean; showDetails: boolean }) {
  const update = useStore((s) => s.updateOfferLine);
  const remove = useStore((s) => s.removeOfferLine);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: line.id, disabled: !editable });
  const style: React.CSSProperties = { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const patch = (p: Partial<OfferLine>) => update(offer.id, line.id, p);
  const setQtyUnit = (p: Partial<Pick<OfferLine, "qty" | "unit">>) => {
    const next = { ...line, ...p };
    const auto = defaultLineHours(line, settings) === line.hours || !line.hours;
    patch({ ...p, hours: auto && (next.unit === "hours" || next.unit === "days") ? defaultLineHours(next, settings) : line.hours });
  };
  const sold = line.hours * 3600;
  const unitShort = OFFER_UNITS.find((u) => u.id === line.unit)?.short;
  const pred = lines.find((l) => l.id === line.predecessorId);

  return (
    <tr ref={setNodeRef} style={style} className={cn("border-t border-ds-border hover:bg-ds-surface-hovered", isDragging && "bg-ds-selected")}>
      <td className="py-1 text-center">
        {editable && (
          <button type="button" {...attributes} {...listeners} className="inline-flex size-6 cursor-grab items-center justify-center rounded-ds text-ds-icon-subtle hover:bg-ds-neutral-hovered" aria-label="Reorder">
            <GripVertical size={14} />
          </button>
        )}
      </td>
      <td className="py-1 text-xs text-ds-text-subtle">{line.order}</td>
      <td className="py-1 pr-2">
        <TextCell value={line.section ?? ""} onSave={(v) => patch({ section: v || undefined })} editable={editable} placeholder="Section" className="text-[11px] font-bold uppercase tracking-wide text-ds-text-subtlest" />
      </td>
      <td className="py-1 pr-2">
        <div className="flex items-center gap-1">
          <TextCell value={line.description} onSave={(v) => patch({ description: v })} editable={editable} placeholder="Line description" className="font-medium" />
          {!showDetails && line.details && <AlignLeft size={12} className="shrink-0 text-ds-icon-subtle" aria-label="Has details" />}
        </div>
      </td>
      {showDetails && (
        <td className="py-1 pr-2">
          <TextCell value={line.details ?? ""} onSave={(v) => patch({ details: v || undefined })} editable={editable} placeholder="Details" className="text-xs text-ds-text-subtle" />
        </td>
      )}
      <td className="py-1">
        {editable ? (
          <Select
            value={line.issueType}
            onChange={(v) => v && patch({ issueType: v as OfferLineIssueType })}
            searchable={false}
            appearance="inline"
            className="h-7 px-1"
            options={[
              { value: "epic", label: "Epic", icon: <IssueTypeIcon type="epic" /> },
              { value: "story", label: "Story", icon: <IssueTypeIcon type="story" /> },
              { value: "task", label: "Task", icon: <IssueTypeIcon type="task" /> },
            ]}
            renderTrigger={() => <IssueTypeIcon type={line.issueType} />}
          />
        ) : (
          <span className="inline-flex h-7 items-center px-1"><IssueTypeIcon type={line.issueType} /></span>
        )}
      </td>
      <td className="py-1 pr-1 text-right"><NumberCell value={line.qty} onSave={(v) => setQtyUnit({ qty: v })} editable={editable} /></td>
      <td className="py-1 pl-1">
        {editable ? (
          <Select value={line.unit} onChange={(v) => v && setQtyUnit({ unit: v as OfferUnit })} searchable={false} appearance="inline" className="h-7 px-1" options={OFFER_UNITS.map((u) => ({ value: u.id, label: u.name }))} renderTrigger={() => <span className="text-sm text-ds-text-subtle">{unitShort}</span>} />
        ) : (
          <span className="inline-flex h-7 items-center px-1 text-ds-text-subtle">{unitShort}</span>
        )}
      </td>
      <td className="py-1 pr-1 text-right"><NumberCell value={line.unitPrice} onSave={(v) => patch({ unitPrice: v })} editable={editable} money={settings.currency} /></td>
      <td className="tabular-nums py-1 pr-2 text-right font-semibold"><span className="inline-flex h-7 items-center">{formatMoney(lineAmount(line), settings.currency)}</span></td>
      <td className="py-1 pr-1 text-right"><NumberCell value={line.hours} onSave={(v) => patch({ hours: v })} editable={editable} suffix="h" /></td>
      <td className="py-1 pl-1">
        <PredecessorCell offer={offer} line={line} lines={lines} pred={pred} editable={editable} patch={patch} />
      </td>
      <td className="py-1 pl-1">
        {pred ? (
          <span className="inline-flex h-7 items-center gap-1 px-1 text-xs text-ds-text-subtle" title={`Computed: next working day after #${pred.order} ends${line.lagDays ? `, ${line.lagDays > 0 ? "+" : ""}${line.lagDays} working days` : ""}`}>
            <Link2 size={12} className="text-ds-icon-subtle" />
            {line.plannedStart ? format(parseISO(line.plannedStart), "dd/MM/yyyy") : "—"}
          </span>
        ) : (
          <DateCell value={line.plannedStart} onSave={(v) => patch({ plannedStart: v })} editable={editable} label="Start" />
        )}
      </td>
      <td className="py-1 pl-1">
        <DateCell value={line.plannedEnd} onSave={(v) => patch({ plannedEnd: v })} editable={editable} label="End" />
      </td>
      {showIssues && (
        <td className="py-1 pl-2">
          {issueKey && (
            <div className="flex h-7 items-center gap-2">
              <Link href={`/browse/${issueKey}`} className="inline-flex shrink-0 items-center gap-1 text-sm text-ds-link hover:underline"><IssueTypeIcon type={line.issueType} size={14} /> {issueKey}</Link>
              <ProgressBar className="w-12 shrink-0" height={4} segments={[{ value: Math.min(loggedSeconds, sold || loggedSeconds), color: sold && loggedSeconds > sold ? "var(--ds-chart-red)" : "var(--ds-chart-blue)" }, { value: Math.max(0, sold - loggedSeconds), color: "var(--ds-chart-track)" }]} />
              <span className="truncate text-[11px] text-ds-text-subtlest">{formatDurationShort(loggedSeconds)}</span>
            </div>
          )}
        </td>
      )}
      {editable && (
        <td className="py-1 text-center">
          {!line.issueId && (
            <button type="button" onClick={() => remove(offer.id, line.id)} className="inline-flex size-6 items-center justify-center rounded-ds text-ds-icon-subtle hover:bg-ds-neutral-hovered hover:text-ds-text-danger" aria-label="Remove line">
              <Trash2 size={14} />
            </button>
          )}
        </td>
      )}
    </tr>
  );
}

/** "After #n" plus the lag in working days; lines that depend on this one are not offered (no cycles) */
function PredecessorCell({ offer, line, lines, pred, editable, patch }: { offer: Offer; line: OfferLine; lines: OfferLine[]; pred?: OfferLine; editable: boolean; patch: (p: Partial<OfferLine>) => void }) {
  const lag = line.lagDays ?? 0;
  if (!editable) {
    return pred ? <span className="inline-flex h-7 items-center px-1 text-xs text-ds-text-subtle">#{pred.order}{lag ? ` ${lag > 0 ? "+" : ""}${lag}d` : ""}</span> : null;
  }
  const blocked = dependentsOf(offer.lines, line.id);
  const options = lines.filter((l) => l.id !== line.id && !blocked.has(l.id)).map((l) => ({ value: l.id, label: `#${l.order} ${l.description || `Line ${l.order}`}`, description: l.plannedEnd ? `ends ${format(parseISO(l.plannedEnd), "d MMM yyyy")}` : "no end date yet" }));
  return (
    <span className="flex items-center gap-0.5 whitespace-nowrap">
      <Select
        value={line.predecessorId ?? null}
        options={options}
        onChange={(v) => patch({ predecessorId: v ?? undefined, lagDays: v ? line.lagDays : undefined })}
        clearable
        searchable={false}
        appearance="inline"
        className="h-7 min-w-0 px-1"
        menuClassName="w-72"
        placeholder="—"
        renderTrigger={() => <span className={cn("text-xs", pred ? "text-ds-text" : "text-ds-text-subtlest")} title={pred ? `After line ${pred.order}` : "No predecessor"}>{pred ? `#${pred.order}` : "—"}</span>}
      />
      {pred && (
        <span className="w-14 shrink-0" title="Lag in working days (negative = overlap)">
          <NumberCell value={lag} onSave={(v) => patch({ lagDays: v || undefined })} editable suffix="d" allowNegative />
        </span>
      )}
    </span>
  );
}

function TextCell({ value, onSave, editable, placeholder, className }: { value: string; onSave: (v: string) => void; editable: boolean; placeholder?: string; className?: string }) {
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => setDraft(value), [value]);
  if (!editable) return value ? <div className={cn("truncate", className)} title={value}>{value}</div> : null;
  return (
    <input
      value={draft}
      placeholder={placeholder}
      title={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onSave(draft.trim())}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLElement).blur();
        if (e.key === "Escape") setDraft(value);
      }}
      className={cn("block h-7 w-full min-w-0 rounded-ds border border-transparent bg-transparent px-1 placeholder:text-ds-text-subtlest hover:border-ds-border focus:border-ds-border-focused focus:bg-ds-input focus:outline-none", className)}
    />
  );
}

function NumberCell({ value, onSave, editable, money, suffix, allowNegative }: { value: number; onSave: (v: number) => void; editable: boolean; money?: string; suffix?: string; allowNegative?: boolean }) {
  const [draft, setDraft] = React.useState(String(value ?? ""));
  React.useEffect(() => setDraft(String(value ?? "")), [value]);
  const sym = money === "USD" ? "$" : money === "GBP" ? "£" : money ? "€" : "";
  if (!editable) return <span className="tabular-nums inline-flex h-7 items-center justify-end">{sym}{value}{suffix}</span>;
  return (
    <span className="inline-flex w-full items-center justify-end gap-0.5 tabular-nums">
      {sym && <span className="text-xs text-ds-text-subtlest">{sym}</span>}
      <input
        value={draft}
        inputMode="decimal"
        onChange={(e) => setDraft(e.target.value.replace(allowNegative ? /[^\d.,-]/g : /[^\d.,]/g, ""))}
        onBlur={() => { const n = Number(draft.replace(",", ".")); if (!isNaN(n) && n !== value) onSave(n); else setDraft(String(value)); }}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="h-7 w-full min-w-0 rounded-ds border border-transparent bg-transparent px-1 text-right hover:border-ds-border focus:border-ds-border-focused focus:bg-ds-input focus:outline-none"
      />
      {suffix && <span className="text-xs text-ds-text-subtlest">{suffix}</span>}
    </span>
  );
}

function DateCell({ value, onSave, editable, label }: { value?: string; onSave: (v: string | undefined) => void; editable: boolean; label: string }) {
  if (!editable) return <span className="inline-flex h-7 items-center px-1 text-xs text-ds-text-subtle">{value ? format(parseISO(value), "dd/MM/yyyy") : "—"}</span>;
  return <input type="date" aria-label={label} value={value ?? ""} onChange={(e) => onSave(e.target.value || undefined)} className={cn("h-7 w-full min-w-0 rounded-ds border border-transparent bg-transparent px-1 text-xs hover:border-ds-border focus:border-ds-border-focused focus:outline-none", !value && "text-ds-text-subtlest")} />;
}
