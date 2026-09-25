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
  // below 768px the cells only hint at their work items: the picked day lists them under the month
  const [day, setDay] = React.useState(() => new Date());
  const [openIssueId, setOpenIssueId] = React.useState<string | null>(null);
  const [dragId, setDragId] = React.useState<string | null>(null);

  if (!project) return null;
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) });
  const scheduled = issues.filter((i) => i.type !== "epic" && i.dueDate);
  const unscheduled = issues.filter((i) => i.type !== "epic" && !i.dueDate && i.status !== "done");
  const dayItems = scheduled.filter((i) => isSameDay(parseISO(i.dueDate!), day));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 px-page pb-3 pt-4">
        <IconButton icon={<ChevronLeft />} label="Previous month" onClick={() => setMonth((m) => addMonths(m, -1))} />
        <IconButton icon={<ChevronRight />} label="Next month" onClick={() => setMonth((m) => addMonths(m, 1))} />
        <Button appearance="subtle" onClick={() => setMonth(startOfMonth(new Date()))}>Today</Button>
        <h2 className="ds-heading-md ml-2">{format(month, "MMMM yyyy")}</h2>
        <span className="ml-auto text-xs text-ds-text-subtlest max-md:hidden">Work items are placed on their due date. Drag to reschedule.</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-page pb-6 md:flex-row md:overflow-hidden">
        <div className="flex min-w-0 shrink-0 flex-col overflow-hidden rounded-ds-md border border-ds-border md:flex-1 md:shrink">
          <div className="grid shrink-0 grid-cols-7 border-b border-ds-border bg-ds-surface-sunken text-center text-xs font-semibold text-ds-text-subtle">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="py-2">{d}</div>
            ))}
          </div>
          <div className="grid auto-rows-fr grid-cols-7 md:flex-1 md:overflow-y-auto">
            {days.map((d) => {
              const items = scheduled.filter((i) => isSameDay(parseISO(i.dueDate!), d));
              return (
                <div
                  key={d.toISOString()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { if (dragId) update(dragId, { dueDate: formatISO(d) }); setDragId(null); }}
                  onClick={() => setDay(d)}
                  className={cn(
                    "min-h-14 min-w-0 border-b border-r border-ds-border p-1 md:min-h-24",
                    !isSameMonth(d, month) && "bg-ds-surface-sunken/60",
                    (d.getDay() === 0 || d.getDay() === 6) && "bg-ds-surface-sunken/40",
                    "max-md:cursor-pointer",
                    isSameDay(d, day) && "max-md:bg-ds-selected",
                  )}
                >
                  <div className={cn("mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs", isToday(d) ? "bg-ds-brand-bold font-bold text-white" : "text-ds-text-subtle")}>{format(d, "d")}</div>
                  <div className="flex flex-wrap items-center gap-0.5 md:hidden">
                    {items.slice(0, 3).map((i) => (
                      <IssueTypeIcon key={i.id} type={i.type} size={12} />
                    ))}
                    {items.length > 3 && <span className="text-[10px] font-semibold text-ds-text-subtle">+{items.length - 3}</span>}
                  </div>
                  <div className="space-y-0.5 max-md:hidden">
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
        <section className="shrink-0 md:hidden">
          <div className="ds-heading-sm mb-2">
            {format(day, "EEEE d MMMM")} <span className="text-xs font-normal text-ds-text-subtlest">{dayItems.length}</span>
          </div>
          {dayItems.length === 0 && <p className="text-xs text-ds-text-subtlest">Nothing due on this day.</p>}
          <div className="space-y-1">
            {dayItems.map((i) => (
              <button key={i.id} type="button" onClick={() => setOpenIssueId(i.id)} className={cn("flex h-10 w-full items-center gap-2 rounded-ds border border-ds-border px-2 text-left text-sm hover:bg-ds-surface-hovered", i.status === "done" && "opacity-60 line-through")}>
                <IssueTypeIcon type={i.type} />
                <span className="shrink-0 text-xs text-ds-text-subtle">{i.key}</span>
                <span className="min-w-0 flex-1 truncate">{i.summary}</span>
                <Avatar user={users.find((u) => u.id === i.assigneeId)} size="xs" />
              </button>
            ))}
          </div>
        </section>
        <aside className="shrink-0 rounded-ds-md border border-ds-border p-3 md:w-64 md:overflow-y-auto">
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
