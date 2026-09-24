"use client";

import * as React from "react";
import { addDays, endOfDay, endOfMonth, endOfWeek, endOfYear, format, parse, startOfDay, startOfMonth, startOfWeek, startOfYear, subDays, subMonths, subWeeks } from "date-fns";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { useStore } from "@/lib/store";
import type { TimeEntry } from "@/lib/types";
import { Select } from "@/components/ui/Select";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export type RangePreset = "today" | "yesterday" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth" | "thisYear" | "custom";

export interface ReportFilters {
  preset: RangePreset;
  from: string; // yyyy-MM-dd
  to: string;
  userId: string | null;
  clientId: string | null;
  projectId: string | null;
  tagId: string | null;
  billable: "all" | "billable" | "nonbillable";
  source: "all" | "tracked" | "allocated";
  q: string;
}

export function presetRange(preset: RangePreset, ref = new Date()): { from: Date; to: Date } {
  const d = startOfDay(ref);
  switch (preset) {
    case "today":
      return { from: d, to: endOfDay(d) };
    case "yesterday":
      return { from: subDays(d, 1), to: endOfDay(subDays(d, 1)) };
    case "thisWeek":
      return { from: startOfWeek(d, { weekStartsOn: 1 }), to: endOfWeek(d, { weekStartsOn: 1 }) };
    case "lastWeek": {
      const w = subWeeks(d, 1);
      return { from: startOfWeek(w, { weekStartsOn: 1 }), to: endOfWeek(w, { weekStartsOn: 1 }) };
    }
    case "thisMonth":
      return { from: startOfMonth(d), to: endOfMonth(d) };
    case "lastMonth": {
      const m = subMonths(d, 1);
      return { from: startOfMonth(m), to: endOfMonth(m) };
    }
    case "thisYear":
      return { from: startOfYear(d), to: endOfYear(d) };
    default:
      return { from: d, to: endOfDay(d) };
  }
}

export function defaultFilters(): ReportFilters {
  const { from, to } = presetRange("thisWeek");
  return { preset: "thisWeek", from: format(from, "yyyy-MM-dd"), to: format(to, "yyyy-MM-dd"), userId: null, clientId: null, projectId: null, tagId: null, billable: "all", source: "all", q: "" };
}

export function filterRange(f: ReportFilters) {
  return { from: startOfDay(parse(f.from, "yyyy-MM-dd", new Date())), to: endOfDay(parse(f.to, "yyyy-MM-dd", new Date())) };
}

export function applyFilters(entries: TimeEntry[], f: ReportFilters, projects: { id: string; clientId?: string }[]) {
  const { from, to } = filterRange(f);
  return entries.filter((e) => {
    const s = new Date(e.start);
    if (s < from || s > to) return false;
    if (f.userId && e.userId !== f.userId) return false;
    if (f.projectId && e.projectId !== f.projectId) return false;
    if (f.clientId) {
      const p = projects.find((x) => x.id === e.projectId);
      if (!p || p.clientId !== f.clientId) return false;
    }
    if (f.tagId && !e.tagIds.includes(f.tagId)) return false;
    if (f.billable === "billable" && !e.billable) return false;
    if (f.billable === "nonbillable" && e.billable) return false;
    if (f.source === "tracked" && e.virtual) return false;
    if (f.source === "allocated" && !e.virtual) return false;
    if (f.q && !e.description.toLowerCase().includes(f.q.toLowerCase())) return false;
    return true;
  });
}

const PRESETS: { id: RangePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "thisWeek", label: "This week" },
  { id: "lastWeek", label: "Last week" },
  { id: "thisMonth", label: "This month" },
  { id: "lastMonth", label: "Last month" },
  { id: "thisYear", label: "This year" },
  { id: "custom", label: "Custom range" },
];

export function ReportFilterBar({ value, onChange }: { value: ReportFilters; onChange: (f: ReportFilters) => void }) {
  const users = useStore((s) => s.users);
  const clients = useStore((s) => s.clients);
  const projects = useStore((s) => s.projects);
  const tags = useStore((s) => s.tags);
  const set = (p: Partial<ReportFilters>) => onChange({ ...value, ...p });
  const setPreset = (preset: RangePreset) => {
    if (preset === "custom") return set({ preset });
    const { from, to } = presetRange(preset);
    set({ preset, from: format(from, "yyyy-MM-dd"), to: format(to, "yyyy-MM-dd") });
  };
  const shift = (dir: 1 | -1) => {
    const { from, to } = filterRange(value);
    const len = Math.round((startOfDay(to).getTime() - from.getTime()) / 86400000) + 1;
    set({ preset: "custom", from: format(addDays(from, dir * len), "yyyy-MM-dd"), to: format(addDays(startOfDay(to), dir * len), "yyyy-MM-dd") });
  };
  const active = value.userId || value.clientId || value.projectId || value.tagId || value.billable !== "all" || value.source !== "all" || value.q;
  const { from, to } = filterRange(value);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex h-8 shrink-0 items-center rounded-ds bg-ds-neutral">
        <button type="button" onClick={() => shift(-1)} aria-label="Previous period" title="Previous period" className="inline-flex h-8 w-7 items-center justify-center rounded-l-ds text-ds-icon hover:bg-ds-neutral-hovered">
          <ChevronLeft size={16} />
        </button>
        <Select
          value={value.preset}
          onChange={(v) => v && setPreset(v as RangePreset)}
          searchable={false}
          appearance="inline"
          className="h-8 rounded-none px-2 hover:bg-ds-neutral-hovered"
          options={PRESETS.map((p) => ({ value: p.id, label: p.label }))}
          renderTrigger={({ open }) => (
            <span className="inline-flex items-center gap-1.5 text-sm">
              <CalendarDays size={16} className="text-ds-icon" />
              <span className="font-medium">{PRESETS.find((p) => p.id === value.preset)?.label}</span>
              <span className="text-ds-text-subtle">
                {format(from, "d MMM")} – {format(to, "d MMM yyyy")}
              </span>
              <ChevronDown size={16} className={cn("text-ds-icon transition-transform", open && "rotate-180")} />
            </span>
          )}
        />
        <button type="button" onClick={() => shift(1)} aria-label="Next period" title="Next period" className="inline-flex h-8 w-7 items-center justify-center rounded-r-ds text-ds-icon hover:bg-ds-neutral-hovered">
          <ChevronRight size={16} />
        </button>
      </div>
      {value.preset === "custom" && (
        <>
          <input type="date" value={value.from} onChange={(e) => set({ from: e.target.value })} className="ds-input h-8 w-36 py-1" />
          <input type="date" value={value.to} onChange={(e) => set({ to: e.target.value })} className="ds-input h-8 w-36 py-1" />
        </>
      )}
      <Select value={value.userId} onChange={(v) => set({ userId: v })} clearable appearance="chip" chipLabel="Member" placeholder="All members" options={users.map((u) => ({ value: u.id, label: u.name, icon: <Avatar user={u} size="xs" /> }))} />
      <Select value={value.clientId} onChange={(v) => set({ clientId: v })} clearable appearance="chip" chipLabel="Client" placeholder="All clients" options={clients.map((c) => ({ value: c.id, label: c.name }))} />
      <Select value={value.projectId} onChange={(v) => set({ projectId: v })} clearable appearance="chip" chipLabel="Project" placeholder="All projects" options={projects.map((p) => ({ value: p.id, label: p.name, icon: <span className="size-2.5 rounded-full" style={{ background: p.color }} />, keywords: p.key }))} />
      <Select value={value.tagId} onChange={(v) => set({ tagId: v })} clearable appearance="chip" chipLabel="Tag" placeholder="All tags" options={tags.map((t) => ({ value: t.id, label: t.name }))} />
      <Select
        value={value.billable === "all" ? null : value.billable}
        onChange={(v) => set({ billable: (v ?? "all") as ReportFilters["billable"] })}
        searchable={false}
        clearable
        appearance="chip"
        chipLabel="Billable"
        placeholder="All"
        options={[
          { value: "billable", label: "Billable" },
          { value: "nonbillable", label: "Non-billable" },
        ]}
      />
      <Select
        value={value.source === "all" ? null : value.source}
        onChange={(v) => set({ source: (v ?? "all") as ReportFilters["source"] })}
        searchable={false}
        clearable
        appearance="chip"
        chipLabel="Source"
        placeholder="All"
        options={[
          { value: "tracked", label: "Tracked", description: "Timer and manual entries" },
          { value: "allocated", label: "Allocated", description: "Generated from fixed allocations" },
        ]}
      />
      <div className="relative w-44">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-ds-icon-subtle" />
        <input value={value.q} onChange={(e) => set({ q: e.target.value })} placeholder="Search description" className="ds-input h-8 py-1 pl-8" />
      </div>
      {active && (
        <Button appearance="subtle" iconBefore={<X />} onClick={() => onChange({ ...defaultFilters(), preset: value.preset, from: value.from, to: value.to })}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
