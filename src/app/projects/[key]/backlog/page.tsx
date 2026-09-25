"use client";

import * as React from "react";
import { use } from "react";
import { format, parseISO } from "date-fns";
import { DndContext, DragOverlay, PointerSensor, closestCenter, useDroppable, useSensor, useSensors, type DragEndEvent, type DragOverEvent, type DragStartEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronRight, MoreHorizontal, Plus, Search, Pencil, Trash2, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useProjectByKey, useProjectIssues, useProjectSprints } from "@/hooks/useData";
import type { Issue, Sprint } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button, IconButton } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Lozenge } from "@/components/ui/Lozenge";
import { DropdownMenu, MenuItem } from "@/components/ui/Popover";
import { EmptyState, ProgressBar } from "@/components/ui/misc";
import { IssueTypeIcon, EpicLozenge, PriorityIcon } from "@/components/issues/icons";
import { PointsBadge, StatusSelect, UserSelect } from "@/components/issues/fields";
import { IssueModal } from "@/components/issues/IssueView";
import { CompleteSprintModal, EditSprintModal, StartSprintModal } from "@/components/issues/SprintModals";

const BACKLOG = "backlog";

export default function BacklogPage({ params }: PageProps<"/projects/[key]/backlog">) {
  const { key } = use(params);
  const project = useProjectByKey(key);
  const allIssues = useProjectIssues(project?.id);
  const sprints = useProjectSprints(project?.id);
  const users = useStore((s) => s.users);
  const reorder = useStore((s) => s.reorderIssue);
  const createSprint = useStore((s) => s.createSprint);
  const deleteSprint = useStore((s) => s.deleteSprint);
  const createIssue = useStore((s) => s.createIssue);

  const [q, setQ] = React.useState("");
  const [assignees, setAssignees] = React.useState<string[]>([]);
  const [epicId, setEpicId] = React.useState<string | null>(null);
  const [showEpics, setShowEpics] = React.useState(false);
  const [openIssueId, setOpenIssueId] = React.useState<string | null>(null);
  const [startId, setStartId] = React.useState<string | null>(null);
  const [completeId, setCompleteId] = React.useState<string | null>(null);
  const [editId, setEditId] = React.useState<string | null>(null);

  const issues = React.useMemo(
    () =>
      allIssues
        .filter((i) => i.type !== "epic" && i.type !== "subtask")
        .filter((i) => !q || i.summary.toLowerCase().includes(q.toLowerCase()) || i.key.toLowerCase().includes(q.toLowerCase()))
        .filter((i) => !assignees.length || (i.assigneeId ? assignees.includes(i.assigneeId) : assignees.includes("unassigned")))
        .filter((i) => !epicId || i.parentId === epicId),
    [allIssues, q, assignees, epicId],
  );
  const epics = React.useMemo(() => allIssues.filter((i) => i.type === "epic"), [allIssues]);
  const openSprints = React.useMemo(() => sprints.filter((s) => s.state !== "closed"), [sprints]);
  const containers = React.useMemo(() => [...openSprints.map((s) => s.id), BACKLOG], [openSprints]);

  const [lists, setLists] = React.useState<Record<string, string[]>>({});
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  React.useEffect(() => {
    if (activeId) return;
    const next: Record<string, string[]> = {};
    containers.forEach((c) => (next[c] = []));
    [...issues].sort((a, b) => a.rank - b.rank).forEach((i) => {
      const c = i.sprintId && next[i.sprintId] ? i.sprintId : BACKLOG;
      next[c].push(i.id);
    });
    setLists(next);
  }, [issues, containers, activeId]);

  const byId = React.useMemo(() => new Map(allIssues.map((i) => [i.id, i])), [allIssues]);
  const findContainer = (id: string) => (lists[id] ? id : Object.keys(lists).find((k) => lists[k].includes(id)));

  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const from = findContainer(String(active.id));
    const to = findContainer(String(over.id));
    if (!from || !to || from === to) return;
    setLists((ls) => {
      const fromItems = ls[from].filter((x) => x !== active.id);
      const toItems = [...ls[to]];
      const idx = toItems.indexOf(String(over.id));
      toItems.splice(idx >= 0 ? idx : toItems.length, 0, String(active.id));
      return { ...ls, [from]: fromItems, [to]: toItems };
    });
  };
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;
    const from = findContainer(String(active.id))!;
    const to = findContainer(String(over.id)) ?? from;
    let items = [...lists[to]];
    if (from === to && active.id !== over.id) {
      const oi = items.indexOf(String(active.id));
      const ni = items.indexOf(String(over.id));
      if (oi >= 0 && ni >= 0) {
        items.splice(oi, 1);
        items.splice(ni, 0, String(active.id));
      }
    }
    if (!items.includes(String(active.id))) items = [...items, String(active.id)];
    setLists((l) => ({ ...l, [to]: items }));
    const idx = items.indexOf(String(active.id));
    const before = items[idx + 1] ?? null;
    const after = items[idx - 1] ?? null;
    reorder(String(active.id), { sprintId: to === BACKLOG ? null : to, beforeId: before, afterId: before ? undefined : after });
  };

  if (!project) return null;
  if (project.type !== "software") return <EmptyState title="No backlog for this project" description="Backlog and sprints are available for software projects." />;

  const activeIssue = activeId ? byId.get(activeId) : undefined;
  const backlogUsers = users.filter((u) => allIssues.some((i) => i.assigneeId === u.id));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 px-page pb-3 pt-4">
        <div className="relative w-44">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-ds-icon-subtle" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search backlog" className="ds-input h-8 py-1 pl-8" />
        </div>
        <div className="flex items-center">
          {backlogUsers.map((u, i) => {
            const on = assignees.includes(u.id);
            return (
              <button key={u.id} type="button" title={u.name} onClick={() => setAssignees((a) => (on ? a.filter((x) => x !== u.id) : [...a, u.id]))} className={cn("rounded-full ring-2 transition-transform hover:z-10 hover:scale-110", on ? "ring-ds-brand-bold" : "ring-white")} style={{ marginLeft: i === 0 ? 0 : -6 }}>
                <Avatar user={u} size="md" />
              </button>
            );
          })}
        </div>
        <Button appearance="subtle" isSelected={showEpics} onClick={() => setShowEpics((s) => !s)}>
          Epic
        </Button>
        {(q || assignees.length || epicId) && (
          <Button appearance="subtle" iconBefore={<X />} onClick={() => { setQ(""); setAssignees([]); setEpicId(null); }}>
            Clear filters
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button appearance="subtle">Insights</Button>
          <Button appearance="subtle">View settings</Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-page pb-6 md:flex-row">
        {showEpics && (
          // on phones the epics panel sits above the backlog
          <aside className="max-h-[40%] shrink-0 overflow-y-auto rounded-ds-md bg-ds-surface-sunken p-2 md:max-h-none md:w-64">
            <div className="ds-heading-xxs px-2 py-2 text-ds-text-subtlest">Epics</div>
            <button type="button" onClick={() => setEpicId(null)} className={cn("mb-1 flex h-8 w-full items-center rounded-ds px-2 text-sm hover:bg-ds-neutral-hovered", !epicId && "bg-ds-selected text-ds-text-selected")}>
              All work items
            </button>
            {epics.map((e) => {
              const kids = allIssues.filter((i) => i.parentId === e.id);
              const done = kids.filter((k) => k.status === "done").length;
              return (
                <button key={e.id} type="button" onClick={() => setEpicId(epicId === e.id ? null : e.id)} className={cn("mb-1 w-full rounded-ds px-2 py-1.5 text-left hover:bg-ds-neutral-hovered", epicId === e.id && "bg-ds-selected")}>
                  <div className="flex items-center gap-2 text-sm">
                    <IssueTypeIcon type="epic" size={14} />
                    <span className="truncate">{e.summary}</span>
                  </div>
                  <ProgressBar className="mt-1.5" height={4} segments={[{ value: done, color: "var(--ds-chart-green)" }, { value: kids.length - done, color: "var(--ds-chart-track)" }]} />
                  <div className="mt-1 text-[11px] text-ds-text-subtlest">{done}/{kids.length} done</div>
                </button>
              );
            })}
            {epics.length === 0 && <div className="px-2 py-2 text-xs text-ds-text-subtlest">No epics yet</div>}
          </aside>
        )}

        <div className="min-w-0 flex-1 overflow-y-auto">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
            {openSprints.map((sprint, idx) => (
              <SprintSection
                key={sprint.id}
                sprint={sprint}
                ids={lists[sprint.id] ?? []}
                byId={byId}
                canStart={idx === 0 || !openSprints.some((s) => s.state === "active")}
                onOpen={(i) => setOpenIssueId(i.id)}
                onStart={() => setStartId(sprint.id)}
                onComplete={() => setCompleteId(sprint.id)}
                onEdit={() => setEditId(sprint.id)}
                onDelete={() => { if (confirm(`Delete ${sprint.name}? Work items move back to the backlog.`)) deleteSprint(sprint.id); }}
                onCreate={(summary) => createIssue({ projectId: project.id, type: "story", summary, sprintId: sprint.id })}
              />
            ))}
            <SprintSection
              sprint={null}
              ids={lists[BACKLOG] ?? []}
              byId={byId}
              onOpen={(i) => setOpenIssueId(i.id)}
              onCreateSprint={() => createSprint(project.id)}
              onCreate={(summary) => createIssue({ projectId: project.id, type: "story", summary })}
            />
            <DragOverlay>{activeIssue ? <div className="w-[720px] rounded-ds bg-ds-surface shadow-ds-overlay"><BacklogRowContent issue={activeIssue} /></div> : null}</DragOverlay>
          </DndContext>
        </div>
      </div>

      <IssueModal issueId={openIssueId} onClose={() => setOpenIssueId(null)} />
      {startId && <StartSprintModal open onClose={() => setStartId(null)} sprintId={startId} />}
      {completeId && <CompleteSprintModal open onClose={() => setCompleteId(null)} sprintId={completeId} />}
      {editId && <EditSprintModal open onClose={() => setEditId(null)} sprintId={editId} />}
    </div>
  );
}

function SprintSection({
  sprint,
  ids,
  byId,
  canStart,
  onOpen,
  onStart,
  onComplete,
  onEdit,
  onDelete,
  onCreate,
  onCreateSprint,
}: {
  sprint: Sprint | null;
  ids: string[];
  byId: Map<string, Issue>;
  canStart?: boolean;
  onOpen: (i: Issue) => void;
  onStart?: () => void;
  onComplete?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onCreate: (summary: string) => void;
  onCreateSprint?: () => void;
}) {
  const id = sprint?.id ?? BACKLOG;
  const { setNodeRef, isOver } = useDroppable({ id });
  const [open, setOpen] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [text, setText] = React.useState("");
  const issues = ids.map((x) => byId.get(x)).filter(Boolean) as Issue[];
  const pts = (status: "todo" | "inprogress" | "done") => issues.filter((i) => (status === "inprogress" ? i.status === "inprogress" || i.status === "inreview" : i.status === status)).reduce((a, i) => a + (i.storyPoints ?? 0), 0);

  return (
    <section ref={setNodeRef} className={cn("mb-4 rounded-ds-md bg-ds-surface-sunken p-2 transition-colors", isOver && "bg-ds-selected")}>
      <header className="flex flex-wrap items-center gap-2 px-1 py-1">
        <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex size-6 items-center justify-center rounded-ds text-ds-icon hover:bg-ds-neutral-hovered">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        {/* below 640px the points and the sprint actions wrap under the name */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 max-sm:basis-[calc(100%_-_32px)]">
          <button type="button" onClick={onEdit} className="rounded-ds px-1 text-sm font-semibold hover:bg-ds-neutral-hovered">
            {sprint ? sprint.name : "Backlog"}
          </button>
          {sprint?.startDate && sprint.endDate && (
            <span className="text-xs text-ds-text-subtlest">
              {format(parseISO(sprint.startDate), "d MMM")} – {format(parseISO(sprint.endDate), "d MMM")}
            </span>
          )}
          <span className="text-xs text-ds-text-subtlest">({issues.length} work item{issues.length === 1 ? "" : "s"})</span>
          {sprint?.goal && <span className="w-full truncate pl-1 text-xs text-ds-text-subtle">{sprint.goal}</span>}
        </div>
        <div className="flex items-center gap-1 max-sm:ml-8 max-sm:mr-auto" title="Story points: to do / in progress / done">
          <Lozenge>{pts("todo")}</Lozenge>
          <Lozenge appearance="inprogress">{pts("inprogress")}</Lozenge>
          <Lozenge appearance="success">{pts("done")}</Lozenge>
        </div>
        {sprint ? (
          sprint.state === "active" ? (
            <Button onClick={onComplete}>Complete sprint</Button>
          ) : (
            <Button onClick={onStart} disabled={!canStart || issues.length === 0} title={issues.length === 0 ? "Add work items to start the sprint" : !canStart ? "Complete the active sprint first" : undefined}>
              Start sprint
            </Button>
          )
        ) : (
          <Button onClick={onCreateSprint}>Create sprint</Button>
        )}
        {sprint && (
          <DropdownMenu align="end" trigger={({ ref, toggle }) => <IconButton ref={ref} icon={<MoreHorizontal />} label="Sprint actions" onClick={toggle} />}>
            {({ close }) => (
              <>
                <MenuItem icon={<Pencil />} onClick={() => { onEdit?.(); close(); }}>Edit sprint</MenuItem>
                <MenuItem icon={<Trash2 />} className="text-ds-text-danger" onClick={() => { onDelete?.(); close(); }}>Delete sprint</MenuItem>
              </>
            )}
          </DropdownMenu>
        )}
      </header>

      {open && (
        <>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="mt-1 overflow-hidden rounded-ds">
              {issues.map((i) => (
                <SortableRow key={i.id} issue={i} onOpen={onOpen} />
              ))}
              {issues.length === 0 && (
                <div className="flex h-12 items-center justify-center rounded-ds border-2 border-dashed border-ds-border text-xs text-ds-text-subtlest">
                  {sprint ? "Plan your sprint: drag work items here or create new ones." : "Your backlog is empty."}
                </div>
              )}
            </div>
          </SortableContext>
          <div className="mt-1">
            {creating ? (
              <div className="flex items-center gap-2 rounded-ds bg-ds-surface px-2 py-1 ring-2 ring-ds-border-focused">
                <IssueTypeIcon type="story" size={14} />
                <input
                  autoFocus
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && text.trim()) { onCreate(text.trim()); setText(""); }
                    if (e.key === "Escape") { setCreating(false); setText(""); }
                  }}
                  onBlur={() => { if (text.trim()) onCreate(text.trim()); setText(""); setCreating(false); }}
                  placeholder="What needs to be done?"
                  className="h-8 flex-1 bg-transparent text-sm outline-none"
                />
              </div>
            ) : (
              <button type="button" onClick={() => setCreating(true)} className="flex h-8 w-full items-center gap-1 rounded-ds px-2 text-sm font-medium text-ds-text-subtle hover:bg-ds-neutral-hovered">
                <Plus size={16} /> Create
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function SortableRow({ issue, onOpen }: { issue: Issue; onOpen: (i: Issue) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: issue.id });
  const style: React.CSSProperties = { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="border-b border-ds-border bg-ds-surface last:border-b-0 hover:bg-ds-surface-hovered">
      <BacklogRowContent issue={issue} onOpen={onOpen} />
    </div>
  );
}

function BacklogRowContent({ issue, onOpen }: { issue: Issue; onOpen?: (i: Issue) => void }) {
  const update = useStore((s) => s.updateIssue);
  const parent = useStore((s) => (issue.parentId ? s.issues.find((i) => i.id === issue.parentId) : undefined));
  return (
    // below 640px the summary takes a line of its own, the key and the fields go below it
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-2 sm:h-10 sm:flex-nowrap sm:py-0">
      <IssueTypeIcon type={issue.type} />
      <span className={cn("w-16 shrink-0 text-xs text-ds-text-subtle", issue.status === "done" && "line-through")}>{issue.key}</span>
      <button type="button" onClick={() => onOpen?.(issue)} className="min-w-0 flex-1 truncate text-left text-sm hover:underline max-sm:order-first max-sm:basis-full">
        {issue.summary}
      </button>
      {parent && parent.type === "epic" && <EpicLozenge id={parent.id} name={parent.summary} className="max-lg:hidden" />}
      <PriorityIcon priority={issue.priority} className="max-sm:ml-auto" />
      <div onPointerDown={(e) => e.stopPropagation()} className="flex items-center gap-1">
        <StatusSelect value={issue.status} onChange={(v) => update(issue.id, { status: v })} compact />
        <span className="inline-flex w-8 justify-center">
          <PointsBadge points={issue.storyPoints} />
        </span>
        <UserSelect value={issue.assigneeId} onChange={(v) => update(issue.id, { assigneeId: v })} avatarOnly className="w-auto" projectId={issue.projectId} />
      </div>
    </div>
  );
}
