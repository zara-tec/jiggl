"use client";

import * as React from "react";
import { use } from "react";
import Link from "next/link";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { DndContext, DragOverlay, PointerSensor, closestCorners, useDroppable, useSensor, useSensors, type DragEndEvent, type DragOverEvent, type DragStartEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, Search, SlidersHorizontal, Plus, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useLoggedByIssue, useProjectByKey, useProjectIssues, useProjectSprints } from "@/hooks/useData";
import { STATUSES, type Issue, type IssueStatus, type IssueType, ISSUE_TYPES } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { DropdownMenu, MenuItem } from "@/components/ui/Popover";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/misc";
import { IssueCard } from "@/components/issues/IssueCard";
import { IssueTypeIcon, EpicLozenge } from "@/components/issues/icons";
import { IssueModal } from "@/components/issues/IssueView";
import { CompleteSprintModal } from "@/components/issues/SprintModals";

export default function BoardPage({ params }: PageProps<"/projects/[key]/board">) {
  const { key } = use(params);
  const project = useProjectByKey(key);
  const allIssues = useProjectIssues(project?.id);
  const sprints = useProjectSprints(project?.id);
  const users = useStore((s) => s.users);
  const reorder = useStore((s) => s.reorderIssue);
  const createIssue = useStore((s) => s.createIssue);
  const openCreate = useStore((s) => s.openCreateIssue);
  const logged = useLoggedByIssue();

  const [q, setQ] = React.useState("");
  const [assignees, setAssignees] = React.useState<string[]>([]);
  const [types, setTypes] = React.useState<IssueType[]>([]);
  const [epicId, setEpicId] = React.useState<string | null>(null);
  const [groupBy, setGroupBy] = React.useState<"none" | "assignee" | "epic">("none");
  const [openIssueId, setOpenIssueId] = React.useState<string | null>(null);
  const [completeOpen, setCompleteOpen] = React.useState(false);

  const activeSprint = sprints.find((s) => s.state === "active");
  const isScrum = project?.type === "software";

  const scoped = React.useMemo(() => {
    let list = allIssues.filter((i) => i.type !== "epic");
    if (isScrum) list = activeSprint ? list.filter((i) => i.sprintId === activeSprint.id) : [];
    if (q) list = list.filter((i) => i.summary.toLowerCase().includes(q.toLowerCase()) || i.key.toLowerCase().includes(q.toLowerCase()));
    if (assignees.length) list = list.filter((i) => (i.assigneeId ? assignees.includes(i.assigneeId) : assignees.includes("unassigned")));
    if (types.length) list = list.filter((i) => types.includes(i.type));
    if (epicId) list = list.filter((i) => i.parentId === epicId);
    return list;
  }, [allIssues, isScrum, activeSprint, q, assignees, types, epicId]);

  const epics = React.useMemo(() => allIssues.filter((i) => i.type === "epic"), [allIssues]);
  const boardUsers = users.filter((u) => allIssues.some((i) => i.assigneeId === u.id));

  const groups = React.useMemo<{ id: string; label: React.ReactNode; issues: Issue[] }[]>(() => {
    if (groupBy === "none") return [{ id: "all", label: null, issues: scoped }];
    if (groupBy === "assignee")
      return [
        ...users.filter((u) => scoped.some((i) => i.assigneeId === u.id)).map((u) => ({ id: u.id, label: <span className="flex items-center gap-2"><Avatar user={u} size="sm" />{u.name}</span>, issues: scoped.filter((i) => i.assigneeId === u.id) })),
        { id: "unassigned", label: <span className="flex items-center gap-2"><Avatar size="sm" />Unassigned</span>, issues: scoped.filter((i) => !i.assigneeId) },
      ].filter((g) => g.issues.length);
    return [
      ...epics.filter((e) => scoped.some((i) => i.parentId === e.id)).map((e) => ({ id: e.id, label: <span className="flex items-center gap-2"><IssueTypeIcon type="epic" />{e.summary}</span>, issues: scoped.filter((i) => i.parentId === e.id) })),
      { id: "noepic", label: <span>Work items without epic</span>, issues: scoped.filter((i) => !i.parentId || !epics.some((e) => e.id === i.parentId)) },
    ].filter((g) => g.issues.length);
  }, [groupBy, scoped, users, epics]);

  if (!project) return null;

  const daysLeft = activeSprint?.endDate ? differenceInCalendarDays(parseISO(activeSprint.endDate), new Date()) : undefined;

  const onMove = (id: string, status: IssueStatus, beforeId?: string | null, afterId?: string | null) => reorder(id, { status, beforeId, afterId });

  const quickCreate = (status: IssueStatus, summary: string) => createIssue({ projectId: project.id, type: "task", summary, status, sprintId: activeSprint?.id });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 px-8 pb-3 pt-4">
        <div className="relative w-44">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-ds-icon-subtle" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search board" className="ds-input h-8 py-1 pl-8" />
        </div>
        <div className="flex items-center">
          {boardUsers.map((u, i) => {
            const on = assignees.includes(u.id);
            return (
              <button
                key={u.id}
                type="button"
                title={u.name}
                onClick={() => setAssignees((a) => (on ? a.filter((x) => x !== u.id) : [...a, u.id]))}
                className={cn("rounded-full ring-2 transition-transform hover:z-10 hover:scale-110", on ? "ring-ds-brand-bold" : "ring-white")}
                style={{ marginLeft: i === 0 ? 0 : -6 }}
              >
                <Avatar user={u} size="md" />
              </button>
            );
          })}
          <button
            type="button"
            title="Unassigned"
            onClick={() => setAssignees((a) => (a.includes("unassigned") ? a.filter((x) => x !== "unassigned") : [...a, "unassigned"]))}
            className={cn("rounded-full ring-2 hover:z-10 hover:scale-110", assignees.includes("unassigned") ? "ring-ds-brand-bold" : "ring-white")}
            style={{ marginLeft: -6 }}
          >
            <Avatar size="md" />
          </button>
        </div>
        <DropdownMenu
          trigger={({ ref, toggle, open }) => (
            <Button ref={ref} onClick={toggle} isSelected={open || epicId !== null} iconAfter={<ChevronDown />} appearance="subtle">
              Epic{epicId ? `: ${epics.find((e) => e.id === epicId)?.summary}` : ""}
            </Button>
          )}
        >
          {({ close }) => (
            <>
              {epics.map((e) => (
                <MenuItem key={e.id} isSelected={epicId === e.id} onClick={() => { setEpicId(epicId === e.id ? null : e.id); close(); }} icon={<IssueTypeIcon type="epic" />}>
                  {e.summary}
                </MenuItem>
              ))}
              {epics.length === 0 && <div className="px-3 py-2 text-sm text-ds-text-subtlest">No epics</div>}
            </>
          )}
        </DropdownMenu>
        <DropdownMenu
          trigger={({ ref, toggle, open }) => (
            <Button ref={ref} onClick={toggle} isSelected={open || types.length > 0} iconAfter={<ChevronDown />} appearance="subtle">
              Type{types.length ? ` (${types.length})` : ""}
            </Button>
          )}
        >
          {ISSUE_TYPES.filter((t) => t.id !== "epic").map((t) => (
            <MenuItem key={t.id} isSelected={types.includes(t.id)} onClick={() => setTypes((x) => (x.includes(t.id) ? x.filter((y) => y !== t.id) : [...x, t.id]))} icon={<IssueTypeIcon type={t.id} />}>
              {t.name}
            </MenuItem>
          ))}
        </DropdownMenu>
        {(q || assignees.length || types.length || epicId) && (
          <Button appearance="subtle" iconBefore={<X />} onClick={() => { setQ(""); setAssignees([]); setTypes([]); setEpicId(null); }}>
            Clear filters
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Select
            value={groupBy}
            onChange={(v) => v && setGroupBy(v as typeof groupBy)}
            searchable={false}
            appearance="subtle"
            className="w-auto"
            options={[
              { value: "none", label: "Group by: None" },
              { value: "assignee", label: "Group by: Assignee" },
              { value: "epic", label: "Group by: Epic" },
            ]}
          />
          {isScrum && activeSprint && (
            <Button onClick={() => setCompleteOpen(true)}>Complete sprint</Button>
          )}
          <Button appearance="subtle" iconBefore={<SlidersHorizontal />} aria-label="View settings" />
        </div>
      </div>

      {isScrum && activeSprint && (
        <div className="flex shrink-0 items-center gap-3 px-8 pb-2 text-sm">
          <span className="font-semibold">{activeSprint.name}</span>
          {activeSprint.goal && <span className="truncate text-ds-text-subtle">— {activeSprint.goal}</span>}
          {daysLeft !== undefined && (
            <span className={cn("ml-auto text-xs", daysLeft < 0 ? "text-ds-text-danger" : "text-ds-text-subtlest")}>
              {daysLeft < 0 ? `${-daysLeft} days overdue` : `${daysLeft} days remaining`}
            </span>
          )}
        </div>
      )}

      {isScrum && !activeSprint ? (
        <EmptyState
          title="No active sprint"
          description="Plan work in the backlog and start a sprint to see it on the board."
          action={
            <Link href={`/projects/${project.key}/backlog`}>
              <Button appearance="primary">Go to backlog</Button>
            </Link>
          }
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto px-8 pb-6">
          {groups.map((g) => (
            <div key={g.id} className="mb-6">
              {g.label && <div className="mb-2 flex items-center gap-2 text-sm font-semibold">{g.label}<span className="text-xs font-normal text-ds-text-subtlest">{g.issues.length}</span></div>}
              <BoardLanes issues={g.issues} onMove={onMove} onOpen={(i) => setOpenIssueId(i.id)} logged={logged} onQuickCreate={groupBy === "none" ? quickCreate : undefined} />
            </div>
          ))}
          {scoped.length === 0 && (
            <EmptyState
              title="No work items match"
              description={isScrum ? "The active sprint has no work items matching your filters." : "Create a work item to get started."}
              action={<Button appearance="primary" iconBefore={<Plus />} onClick={() => openCreate({ projectId: project.id, sprintId: activeSprint?.id })}>Create work item</Button>}
            />
          )}
        </div>
      )}

      <IssueModal issueId={openIssueId} onClose={() => setOpenIssueId(null)} />
      {activeSprint && <CompleteSprintModal open={completeOpen} onClose={() => setCompleteOpen(false)} sprintId={activeSprint.id} />}
    </div>
  );
}

/* ---------- Kanban lanes with drag & drop ---------- */
function BoardLanes({
  issues,
  onMove,
  onOpen,
  logged,
  onQuickCreate,
}: {
  issues: Issue[];
  onMove: (id: string, status: IssueStatus, beforeId?: string | null, afterId?: string | null) => void;
  onOpen: (i: Issue) => void;
  logged: Map<string, number>;
  onQuickCreate?: (status: IssueStatus, summary: string) => void;
}) {
  const [columns, setColumns] = React.useState<Record<IssueStatus, string[]>>(() => build(issues));
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  React.useEffect(() => {
    if (!activeId) setColumns(build(issues));
  }, [issues, activeId]);

  const byId = React.useMemo(() => new Map(issues.map((i) => [i.id, i])), [issues]);
  const findColumn = (id: string): IssueStatus | undefined => {
    if (id in columns) return id as IssueStatus;
    return (Object.keys(columns) as IssueStatus[]).find((k) => columns[k].includes(id));
  };

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const from = findColumn(String(active.id));
    const to = findColumn(String(over.id));
    if (!from || !to || from === to) return;
    setColumns((cols) => {
      const fromItems = cols[from].filter((x) => x !== active.id);
      const toItems = [...cols[to]];
      const overIdx = toItems.indexOf(String(over.id));
      const insertAt = overIdx >= 0 ? overIdx : toItems.length;
      toItems.splice(insertAt, 0, String(active.id));
      return { ...cols, [from]: fromItems, [to]: toItems };
    });
  };
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;
    const from = findColumn(String(active.id))!;
    const to = findColumn(String(over.id)) ?? from;
    let items = [...columns[to]];
    if (from === to && String(active.id) !== String(over.id)) {
      const oldIdx = items.indexOf(String(active.id));
      const newIdx = items.indexOf(String(over.id));
      if (oldIdx >= 0 && newIdx >= 0) {
        items.splice(oldIdx, 1);
        items.splice(newIdx, 0, String(active.id));
      }
    }
    if (!items.includes(String(active.id))) items = [...items, String(active.id)];
    setColumns((c) => ({ ...c, [to]: items }));
    const idx = items.indexOf(String(active.id));
    const before = items[idx + 1] ?? null;
    const after = items[idx - 1] ?? null;
    onMove(String(active.id), to, before, before ? undefined : after);
  };

  const activeIssue = activeId ? byId.get(activeId) : undefined;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="flex min-w-max gap-3">
        {STATUSES.map((s) => (
          <Column key={s.id} status={s.id} name={s.name} ids={columns[s.id]} byId={byId} onOpen={onOpen} logged={logged} onQuickCreate={onQuickCreate} isDone={s.id === "done"} />
        ))}
      </div>
      <DragOverlay>{activeIssue ? <IssueCard issue={activeIssue} dragging className="w-[270px]" /> : null}</DragOverlay>
    </DndContext>
  );
}

function build(issues: Issue[]): Record<IssueStatus, string[]> {
  const cols: Record<IssueStatus, string[]> = { todo: [], inprogress: [], inreview: [], done: [] };
  [...issues].sort((a, b) => a.rank - b.rank).forEach((i) => cols[i.status].push(i.id));
  return cols;
}

function Column({ status, name, ids, byId, onOpen, logged, onQuickCreate, isDone }: { status: IssueStatus; name: string; ids: string[]; byId: Map<string, Issue>; onOpen: (i: Issue) => void; logged: Map<string, number>; onQuickCreate?: (status: IssueStatus, summary: string) => void; isDone?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const [creating, setCreating] = React.useState(false);
  const [text, setText] = React.useState("");
  return (
    <div ref={setNodeRef} className={cn("flex w-[286px] shrink-0 flex-col rounded-ds-md bg-ds-surface-sunken transition-colors", isOver && "bg-ds-selected")}>
      <div className="flex h-10 items-center gap-2 px-3">
        <span className="ds-heading-xxs text-ds-text-subtlest">{name}</span>
        <span className="text-xs text-ds-text-subtlest">{ids.length}</span>
        {isDone && <span className="ml-auto inline-flex size-4 items-center justify-center rounded-full bg-ds-success-bold text-ds-text-on-brand"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M5 13l4 4L19 7" /></svg></span>}
      </div>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-[40px] flex-1 flex-col gap-1.5 px-2 pb-2">
          {ids.map((id) => {
            const issue = byId.get(id);
            return issue ? <SortableCard key={id} issue={issue} onOpen={onOpen} logged={logged.get(id)} /> : null;
          })}
        </div>
      </SortableContext>
      {onQuickCreate && (
        <div className="px-2 pb-2">
          {creating ? (
            <div className="rounded-ds bg-ds-surface p-2 shadow-ds-raised ring-2 ring-ds-border-focused">
              <textarea
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (text.trim()) onQuickCreate(status, text.trim());
                    setText("");
                    setCreating(false);
                  }
                  if (e.key === "Escape") { setCreating(false); setText(""); }
                }}
                onBlur={() => { if (text.trim()) onQuickCreate(status, text.trim()); setText(""); setCreating(false); }}
                rows={2}
                placeholder="What needs to be done?"
                className="w-full resize-none bg-transparent text-sm outline-none"
              />
              <div className="mt-1 flex items-center gap-1 text-xs text-ds-text-subtlest"><IssueTypeIcon type="task" size={14} /> Task</div>
            </div>
          ) : (
            <button type="button" onClick={() => setCreating(true)} className="flex h-8 w-full items-center gap-1 rounded-ds px-2 text-sm font-medium text-ds-text-subtle hover:bg-ds-neutral-hovered">
              <Plus size={16} /> Create
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SortableCard({ issue, onOpen, logged }: { issue: Issue; onOpen: (i: Issue) => void; logged?: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: issue.id });
  const style: React.CSSProperties = { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return <IssueCard ref={setNodeRef} style={style} handleProps={{ ...attributes, ...listeners } as React.HTMLAttributes<HTMLDivElement>} issue={issue} onOpen={onOpen} logged={logged} />;
}

// keep EpicLozenge import used for potential swimlane labels
void EpicLozenge;
