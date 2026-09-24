"use client";

import * as React from "react";
import Link from "next/link";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { useLoggedByIssue } from "@/hooks/useData";
import type { Offer, OfferLine, OfferLineIssueType, OfferUnit } from "@/lib/types";
import { OFFER_UNITS, defaultLineHours, lineAmount, offerTotals } from "@/lib/offers";
import { formatDays, formatMoney } from "@/lib/rates";
import { cn, formatDurationShort } from "@/lib/utils";
import { Select } from "@/components/ui/Select";
import { IssueTypeIcon } from "@/components/issues/icons";
import { ProgressBar } from "@/components/ui/misc";

export function OfferLinesTable({ offer, editable }: { offer: Offer; editable: boolean }) {
  const settings = useStore((s) => s.settings);
  const issues = useStore((s) => s.issues);
  const addLine = useStore((s) => s.addOfferLine);
  const moveLine = useStore((s) => s.moveOfferLine);
  const logged = useLoggedByIssue();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const lines = React.useMemo(() => [...offer.lines].sort((a, b) => a.order - b.order), [offer.lines]);
  const totals = offerTotals(offer);
  const showIssues = offer.lines.some((l) => l.issueId);
  const cols = 11 + (showIssues ? 1 : 0) + (editable ? 1 : 0);

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
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
    <div className="overflow-x-auto rounded-ds border border-ds-border">
      <table className="w-full min-w-[960px] table-fixed text-sm">
        <colgroup>
          <col style={{ width: 28 }} />
          <col style={{ width: 28 }} />
          <col />
          <col style={{ width: 44 }} />
          <col style={{ width: 64 }} />
          <col style={{ width: 56 }} />
          <col style={{ width: 92 }} />
          <col style={{ width: 96 }} />
          <col style={{ width: 72 }} />
          <col style={{ width: 150 }} />
          {showIssues && <col style={{ width: 150 }} />}
          {editable && <col style={{ width: 32 }} />}
        </colgroup>
        <thead>
          <tr className="bg-ds-surface-sunken text-left text-xs text-ds-text-subtle">
            <th className="py-2" />
            <th className="py-2 font-semibold">#</th>
            <th className="py-2 pr-2 font-semibold">Description</th>
            <th className="py-2 font-semibold">Type</th>
            <th className="py-2 pr-1 text-right font-semibold">Qty</th>
            <th className="py-2 pl-1 font-semibold">Unit</th>
            <th className="py-2 pr-1 text-right font-semibold">Unit price</th>
            <th className="py-2 pr-2 text-right font-semibold">Amount</th>
            <th className="py-2 pr-1 text-right font-semibold">Hours</th>
            <th className="py-2 pl-2 font-semibold">Planned</th>
            {showIssues && <th className="py-2 pl-2 font-semibold">Work item</th>}
            {editable && <th className="py-2" />}
          </tr>
        </thead>
          <SortableContext items={lines.map((l) => l.id)} strategy={verticalListSortingStrategy}>
            <tbody>
              {lines.map((line) => (
                <LineRow key={line.id} offer={offer} line={line} editable={editable} settings={settings} loggedSeconds={loggedFor(line)} issueKey={issues.find((i) => i.id === line.issueId)?.key} showIssues={showIssues} />
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
            <td colSpan={7} className="py-2 pr-2 text-right text-ds-text-subtle">
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
            <td colSpan={cols - 9} className="py-2 pl-2 text-xs text-ds-text-subtlest">
              {formatDays(totals.hours * 3600, settings)} at {settings.hoursPerDay}h/day
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
    </DndContext>
  );
}

function LineRow({ offer, line, editable, settings, loggedSeconds, issueKey, showIssues }: { offer: Offer; line: OfferLine; editable: boolean; settings: { currency: string; hoursPerDay: number }; loggedSeconds: number; issueKey?: string; showIssues: boolean }) {
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

  return (
    <tr ref={setNodeRef} style={style} className={cn("border-t border-ds-border align-top hover:bg-ds-surface-hovered", isDragging && "bg-ds-selected")}>
      <td className="py-2 text-center">
        {editable && (
          <button type="button" {...attributes} {...listeners} className="inline-flex size-6 cursor-grab items-center justify-center rounded-ds text-ds-icon-subtle hover:bg-ds-neutral-hovered" aria-label="Reorder">
            <GripVertical size={14} />
          </button>
        )}
      </td>
      <td className="py-2.5 text-xs text-ds-text-subtle">{line.order}</td>
      <td className="py-1.5 pr-2">
        <TextCell value={line.section ?? ""} onSave={(v) => patch({ section: v || undefined })} editable={editable} placeholder="Section" className="text-[11px] font-bold uppercase tracking-wide text-ds-text-subtlest" />
        <TextCell value={line.description} onSave={(v) => patch({ description: v })} editable={editable} placeholder="Line description" className="font-medium" />
        <TextCell value={line.details ?? ""} onSave={(v) => patch({ details: v || undefined })} editable={editable} placeholder="Details (optional)" className="text-xs text-ds-text-subtle" multiline />
      </td>
      <td className="py-2">
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
      <td className="py-2 pr-1 text-right"><NumberCell value={line.qty} onSave={(v) => setQtyUnit({ qty: v })} editable={editable} /></td>
      <td className="py-2 pl-1">
        {editable ? (
          <Select value={line.unit} onChange={(v) => v && setQtyUnit({ unit: v as OfferUnit })} searchable={false} appearance="inline" className="h-7 px-1" options={OFFER_UNITS.map((u) => ({ value: u.id, label: u.name }))} renderTrigger={() => <span className="text-sm text-ds-text-subtle">{unitShort}</span>} />
        ) : (
          <span className="inline-flex h-7 items-center px-1 text-ds-text-subtle">{unitShort}</span>
        )}
      </td>
      <td className="py-2 pr-1 text-right"><NumberCell value={line.unitPrice} onSave={(v) => patch({ unitPrice: v })} editable={editable} money={settings.currency} /></td>
      <td className="tabular-nums py-2.5 pr-2 text-right font-semibold">{formatMoney(lineAmount(line), settings.currency)}</td>
      <td className="py-2 pr-1 text-right"><NumberCell value={line.hours} onSave={(v) => patch({ hours: v })} editable={editable} suffix="h" /></td>
      <td className="py-2 pl-2">
        <DateCell value={line.plannedStart} onSave={(v) => patch({ plannedStart: v })} editable={editable} label="Start" />
        <DateCell value={line.plannedEnd} onSave={(v) => patch({ plannedEnd: v })} editable={editable} label="End" />
      </td>
      {showIssues && (
        <td className="py-2 pl-2">
          {issueKey && (
            <div>
              <Link href={`/browse/${issueKey}`} className="inline-flex items-center gap-1 text-sm text-ds-link hover:underline"><IssueTypeIcon type={line.issueType} size={14} /> {issueKey}</Link>
              <ProgressBar className="mt-1" height={4} segments={[{ value: Math.min(loggedSeconds, sold || loggedSeconds), color: sold && loggedSeconds > sold ? "var(--ds-chart-red)" : "var(--ds-chart-blue)" }, { value: Math.max(0, sold - loggedSeconds), color: "var(--ds-chart-track)" }]} />
              <div className="mt-0.5 text-[11px] text-ds-text-subtlest">{formatDurationShort(loggedSeconds)} of {line.hours}h</div>
            </div>
          )}
        </td>
      )}
      {editable && (
        <td className="py-2 text-center">
          <button type="button" onClick={() => remove(offer.id, line.id)} className="inline-flex size-6 items-center justify-center rounded-ds text-ds-icon-subtle hover:bg-ds-neutral-hovered hover:text-ds-text-danger" aria-label="Remove line">
            <Trash2 size={14} />
          </button>
        </td>
      )}
    </tr>
  );
}

function TextCell({ value, onSave, editable, placeholder, className, multiline }: { value: string; onSave: (v: string) => void; editable: boolean; placeholder?: string; className?: string; multiline?: boolean }) {
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => setDraft(value), [value]);
  if (!editable) return value ? <div className={cn("whitespace-pre-wrap break-words", className)}>{value}</div> : null;
  const common = {
    value: draft,
    placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
    onBlur: () => draft !== value && onSave(draft.trim()),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (!multiline || e.ctrlKey || e.metaKey)) (e.target as HTMLElement).blur();
      if (e.key === "Escape") setDraft(value);
    },
    className: cn("block w-full resize-none rounded-ds border border-transparent bg-transparent px-1 py-0.5 hover:border-ds-border focus:border-ds-border-focused focus:bg-ds-input focus:outline-none placeholder:text-ds-text-subtlest", className),
  };
  return multiline ? <textarea rows={draft ? Math.min(4, draft.split("\n").length) : 1} {...common} /> : <input {...common} />;
}

function NumberCell({ value, onSave, editable, money, suffix }: { value: number; onSave: (v: number) => void; editable: boolean; money?: string; suffix?: string }) {
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
        onChange={(e) => setDraft(e.target.value.replace(/[^\d.,]/g, ""))}
        onBlur={() => { const n = Number(draft.replace(",", ".")); if (!isNaN(n) && n !== value) onSave(n); else setDraft(String(value)); }}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="h-7 w-full min-w-0 rounded-ds border border-transparent bg-transparent px-1 text-right hover:border-ds-border focus:border-ds-border-focused focus:bg-ds-input focus:outline-none"
      />
      {suffix && <span className="text-xs text-ds-text-subtlest">{suffix}</span>}
    </span>
  );
}

function DateCell({ value, onSave, editable, label }: { value?: string; onSave: (v: string | undefined) => void; editable: boolean; label: string }) {
  if (!editable) {
    return (
      <div className="flex h-6 items-center gap-2 text-xs">
        <span className="w-8 text-ds-text-subtlest">{label}</span>
        <span className="text-ds-text-subtle">{value ?? "—"}</span>
      </div>
    );
  }
  return (
    <label className="flex h-7 items-center gap-1 text-xs">
      <span className="w-8 shrink-0 text-ds-text-subtlest">{label}</span>
      <input type="date" value={value ?? ""} onChange={(e) => onSave(e.target.value || undefined)} className={cn("h-7 w-full min-w-0 rounded-ds border border-transparent bg-transparent px-1 text-xs hover:border-ds-border focus:border-ds-border-focused focus:outline-none", !value && "text-ds-text-subtlest")} />
    </label>
  );
}
