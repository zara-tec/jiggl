"use client";

import * as React from "react";
import { Clock, Play, Square } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Issue } from "@/lib/types";
import { cn, formatDurationShort } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { EpicLozenge, IssueTypeIcon, PriorityIcon } from "./icons";
import { PointsBadge } from "./fields";

export function IssueCard({
  issue,
  onOpen,
  logged,
  dragging,
  className,
  style,
  handleProps,
  ref,
}: {
  issue: Issue;
  onOpen?: (issue: Issue) => void;
  logged?: number;
  dragging?: boolean;
  className?: string;
  style?: React.CSSProperties;
  handleProps?: React.HTMLAttributes<HTMLDivElement>;
  ref?: React.Ref<HTMLDivElement>;
}) {
  const assignee = useStore((s) => s.users.find((u) => u.id === issue.assigneeId));
  const parent = useStore((s) => (issue.parentId ? s.issues.find((i) => i.id === issue.parentId) : undefined));
  const running = useStore((s) => s.timeEntries.find((t) => t.userId === s.currentUserId && !t.stop));
  const start = useStore((s) => s.startTimer);
  const stop = useStore((s) => s.stopTimer);
  const isRunningHere = running?.issueId === issue.id;

  return (
    <div
      ref={ref}
      style={style}
      {...handleProps}
      onClick={() => onOpen?.(issue)}
      className={cn(
        "group/card relative cursor-pointer rounded-ds bg-ds-surface p-2 shadow-ds-raised transition-colors hover:bg-ds-surface-hovered",
        dragging && "rotate-[1.5deg] shadow-ds-overlay",
        isRunningHere && "ring-1 ring-ds-danger-bold/60",
        className,
      )}
    >
      <div className="mb-1.5 text-sm leading-5 text-ds-text">{issue.summary}</div>
      {(parent || issue.labels.length > 0) && (
        <div className="mb-2 flex flex-wrap items-center gap-1">
          {parent && parent.type === "epic" && <EpicLozenge id={parent.id} name={parent.summary} />}
          {issue.labels.map((l) => (
            <span key={l} className="rounded-[3px] bg-ds-neutral px-1 text-[11px] font-medium text-ds-text-subtle">
              {l}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <IssueTypeIcon type={issue.type} />
          <span className={cn("truncate text-xs text-ds-text-subtle", issue.status === "done" && "line-through")}>{issue.key}</span>
          <PriorityIcon priority={issue.priority} />
          <PointsBadge points={issue.storyPoints} />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {(logged ?? 0) > 0 && (
            <span className={cn("inline-flex items-center gap-0.5 text-[11px] text-ds-text-subtlest", isRunningHere && "text-ds-text-danger")} title="Time logged">
              <Clock size={11} /> {formatDurationShort(logged!)}
            </span>
          )}
          <button
            type="button"
            title={isRunningHere ? "Stop timer" : "Start timer on this work item"}
            onClick={(e) => {
              e.stopPropagation();
              if (isRunningHere) stop();
              else start({ description: issue.summary, projectId: issue.projectId, issueId: issue.id, tagIds: [], billable: true });
            }}
            className={cn(
              "inline-flex size-5 items-center justify-center rounded-full text-ds-text-on-brand transition-opacity",
              isRunningHere ? "bg-ds-danger-bold opacity-100" : "bg-ds-brand-bold opacity-0 group-hover/card:opacity-100",
            )}
          >
            {isRunningHere ? <Square size={8} fill="currentColor" /> : <Play size={8} fill="currentColor" className="ml-px" />}
          </button>
          <Avatar user={assignee} size="sm" />
        </div>
      </div>
    </div>
  );
}
