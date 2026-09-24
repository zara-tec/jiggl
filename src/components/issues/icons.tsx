"use client";

import { Bookmark, Bug, Check, ChevronDown, ChevronUp, ChevronsDown, ChevronsUp, Equal, Zap, GitBranchPlus } from "lucide-react";
import type { IssuePriority, IssueStatus, IssueType } from "@/lib/types";
import { Lozenge, type LozengeAppearance } from "@/components/ui/Lozenge";
import { cn } from "@/lib/utils";

export const ISSUE_TYPE_META: Record<IssueType, { name: string; color: string }> = {
  epic: { name: "Epic", color: "#6E5DC6" },
  story: { name: "Story", color: "#22A06B" },
  task: { name: "Task", color: "#0C66E4" },
  bug: { name: "Bug", color: "#C9372C" },
  subtask: { name: "Subtask", color: "#0C66E4" },
};

export function IssueTypeIcon({ type, size = 16, className }: { type: IssueType; size?: number; className?: string }) {
  const meta = ISSUE_TYPE_META[type];
  const inner = Math.round(size * 0.7);
  const glyph =
    type === "epic" ? (
      <Zap size={inner} strokeWidth={2.5} fill="currentColor" />
    ) : type === "story" ? (
      <Bookmark size={inner} strokeWidth={2.5} fill="currentColor" />
    ) : type === "bug" ? (
      <Bug size={inner} strokeWidth={2.5} />
    ) : type === "subtask" ? (
      <GitBranchPlus size={inner} strokeWidth={2.5} />
    ) : (
      <Check size={inner} strokeWidth={3} />
    );
  return (
    <span
      title={meta.name}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-[3px] text-white", className)}
      style={{ width: size, height: size, background: meta.color }}
    >
      {glyph}
    </span>
  );
}

export const PRIORITY_META: Record<IssuePriority, { name: string; color: string }> = {
  highest: { name: "Highest", color: "var(--ds-chart-red)" },
  high: { name: "High", color: "var(--ds-chart-red)" },
  medium: { name: "Medium", color: "var(--ds-chart-orange)" },
  low: { name: "Low", color: "var(--ds-chart-blue)" },
  lowest: { name: "Lowest", color: "var(--ds-chart-blue)" },
};

export function PriorityIcon({ priority, size = 16, className }: { priority: IssuePriority; size?: number; className?: string }) {
  const meta = PRIORITY_META[priority];
  const props = { size, strokeWidth: 2.5, style: { color: meta.color }, className: cn("shrink-0", className) };
  const icon =
    priority === "highest" ? <ChevronsUp {...props} /> : priority === "high" ? <ChevronUp {...props} /> : priority === "medium" ? <Equal {...props} /> : priority === "low" ? <ChevronDown {...props} /> : <ChevronsDown {...props} />;
  return <span title={meta.name} className="inline-flex">{icon}</span>;
}

export const STATUS_META: Record<IssueStatus, { name: string; appearance: LozengeAppearance; color: string }> = {
  todo: { name: "To Do", appearance: "default", color: "var(--ds-status-todo)" },
  inprogress: { name: "In Progress", appearance: "inprogress", color: "var(--ds-status-inprogress)" },
  inreview: { name: "In Review", appearance: "inprogress", color: "var(--ds-status-inreview)" },
  done: { name: "Done", appearance: "success", color: "var(--ds-status-done)" },
};

export function StatusLozenge({ status, isBold, className }: { status: IssueStatus; isBold?: boolean; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <Lozenge appearance={meta.appearance} isBold={isBold} className={className}>
      {meta.name}
    </Lozenge>
  );
}

export const EPIC_COLORS = ["#6E5DC6", "#0C66E4", "#1F845A", "#E56910", "#C9372C", "#227D9B", "#943D73", "#5E4DB2"];
export function epicColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return EPIC_COLORS[h % EPIC_COLORS.length];
}

const EPIC_SUBTLE: Record<string, string> = {
  "#6E5DC6": "bg-ds-accent-purple-subtler text-ds-accent-purple-text",
  "#0C66E4": "bg-ds-accent-blue-subtler text-ds-accent-blue-text",
  "#1F845A": "bg-ds-accent-green-subtler text-ds-accent-green-text",
  "#E56910": "bg-ds-accent-orange-subtler text-ds-accent-orange-text",
  "#C9372C": "bg-ds-accent-red-subtler text-ds-accent-red-text",
  "#227D9B": "bg-ds-accent-teal-subtler text-ds-accent-teal-text",
  "#943D73": "bg-ds-accent-magenta-subtler text-ds-accent-magenta-text",
  "#5E4DB2": "bg-ds-accent-purple-subtler text-ds-accent-purple-text",
};

export function EpicLozenge({ id, name, className }: { id: string; name: string; className?: string }) {
  const c = epicColor(id);
  return (
    <span className={cn("inline-flex h-4 max-w-40 items-center truncate rounded-[3px] px-1 text-[11px] font-bold uppercase leading-4", EPIC_SUBTLE[c], className)}>
      <span className="truncate">{name}</span>
    </span>
  );
}
