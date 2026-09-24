"use client";

import * as React from "react";
import { use } from "react";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, parseISO, startOfMonth, startOfWeek, formatISO } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useStore } from "@/lib/store";
import { useProjectByKey, useProjectIssues } from "@/hooks/useData";
import { cn } from "@/lib/utils";
import { Button, IconButton } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { IssueTypeIcon } from "@/components/issues/icons";
import { IssueModal } from "@/components/issues/IssueView";

export default function ProjectCalendarPage({ params }: PageProps<"/projects/[key]/calendar">) {
  const { key } = use(params);
  const project = useProjectByKey(key);
  const issues = useProjectIssues(project?.id);
  const users = useStore((s) => s.users);
  const update = useStore((s) => s.updateIssue);
  const [month, setMonth] = React.useState(() => startOfMonth(new Date()));
  const [openIssueId, setOpenIssueId] = React.useState<string | null>(null);
  const [dragId, setDragId] = React.useState<string | null>(null);

  if (!project) return null;
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) });
  const scheduled = issues.filter((i) => i.type !== "epic" && i.dueDate);
  const unscheduled = issues.filter((i) => i.type !== "epic" && !i.dueDate && i.status !== "done");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 px-8 pb-3 pt-4">
        <IconButton icon={<ChevronLeft />} label="Previous month" onClick={() => setMonth((m) => addMonths(m, -1))} />
        <IconButton icon={<ChevronRight />} label="Next month" onClick={() => setMonth((m) => addMonths(m, 1))} />
        <Button appearance="subtle" onClick={() => setMonth(startOfMonth(new Date()))}>Today</Button>
        <h2 className="ds-heading-md ml-2">{format(month, "MMMM yyyy")}</h2>
        <span className="ml-auto text-xs text-ds-text-subtlest">Work items are placed on their due date. Drag to reschedule.</span>
      </div>
      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden px-8 pb-6">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-ds-md border border-ds-border">
          <div className="grid shrink-0 grid-cols-7 border-b border-ds-border bg-ds-surface-sunken text-center text-xs font-semibold text-ds-text-subtle">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="py-2">{d}</div>
            ))}
          </div>
          <div className="grid flex-1 auto-rows-fr grid-cols-7 overflow-y-auto">
            {days.map((d) => {
              const items = scheduled.filter((i) => isSameDay(parseISO(i.dueDate!), d));
              return (
                <div
                  key={d.toISOString()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { if (dragId) update(dragId, { dueDate: formatISO(d) }); setDragId(null); }}
                  className={cn("min-h-24 border-b border-r border-ds-border p-1", !isSameMonth(d, month) && "bg-ds-surface-sunken/60", (d.getDay() === 0 || d.getDay() === 6) && "bg-ds-surface-sunken/40")}
                >
                  <div className={cn("mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs", isToday(d) ? "bg-ds-brand-bold font-bold text-white" : "text-ds-text-subtle")}>{format(d, "d")}</div>
                  <div className="space-y-0.5">
                    {items.map((i) => (
                      <button
                        key={i.id}
                        draggable
                        onDragStart={() => setDragId(i.id)}
                        onClick={() => setOpenIssueId(i.id)}
                        className={cn("flex w-full items-center gap-1 rounded-[3px] border border-ds-border bg-ds-surface px-1 py-0.5 text-left text-xs hover:bg-ds-surface-hovered", i.status === "done" && "opacity-60 line-through")}
                      >
                        <IssueTypeIcon type={i.type} size={12} />
                        <span className="truncate">{i.summary}</span>
                        <Avatar user={users.find((u) => u.id === i.assigneeId)} size="xs" className="ml-auto" />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <aside className="w-64 shrink-0 overflow-y-auto rounded-ds-md border border-ds-border p-3">
          <div className="ds-heading-sm mb-2">Unscheduled <span className="text-xs font-normal text-ds-text-subtlest">{unscheduled.length}</span></div>
          <p className="mb-2 text-xs text-ds-text-subtlest">Drag a work item onto a day to set its due date.</p>
          <div className="space-y-1">
            {unscheduled.map((i) => (
              <button key={i.id} draggable onDragStart={() => setDragId(i.id)} onClick={() => setOpenIssueId(i.id)} className="flex w-full items-center gap-1.5 rounded-ds border border-ds-border px-2 py-1 text-left text-xs hover:bg-ds-surface-hovered">
                <IssueTypeIcon type={i.type} size={12} />
                <span className="truncate">{i.summary}</span>
              </button>
            ))}
          </div>
        </aside>
      </div>
      <IssueModal issueId={openIssueId} onClose={() => setOpenIssueId(null)} />
    </div>
  );
}
