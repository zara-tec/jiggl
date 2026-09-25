"use client";

import * as React from "react";
import { use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ArrowDown, ArrowUp, Plus, Search, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useLoggedByIssue, useProjectByKey, useProjectIssues, useProjectTeam } from "@/hooks/useData";
import { STATUSES, ISSUE_TYPES, type Issue, type IssueStatus, type IssueType } from "@/lib/types";
import { cn, formatDurationShort, relativeTime } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { IssueTypeIcon, EpicLozenge, STATUS_META } from "@/components/issues/icons";
import { PointsBadge, PrioritySelect, StatusSelect, UserSelect } from "@/components/issues/fields";
import { IssueModal } from "@/components/issues/IssueView";

type SortKey = "key" | "summary" | "status" | "assignee" | "priority" | "updated" | "due" | "logged";

export default function ListPage({ params }: PageProps<"/projects/[key]/list">) {
  const { key } = use(params);
  const project = useProjectByKey(key);
  const team = useProjectTeam(project?.id);
  const issues = useProjectIssues(project?.id);
  const users = useStore((s) => s.users);
  const sprints = useStore((s) => s.sprints);
  const update = useStore((s) => s.updateIssue);
  const createIssue = useStore((s) => s.createIssue);
  const logged = useLoggedByIssue();
  const sp = useSearchParams();

  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<string | null>(sp.get("status") === "open" ? "open" : sp.get("status") === "done" ? "done" : null);
  const [type, setType] = React.useState<string | null>(null);
  const [assignee, setAssignee] = React.useState<string | null>(null);
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 1 | -1 }>({ key: "updated", dir: -1 });
  const [openIssueId, setOpenIssueId] = React.useState<string | null>(null);
  const [text, setText] = React.useState("");

  const priorityRank = { highest: 0, high: 1, medium: 2, low: 3, lowest: 4 };
  const list = React.useMemo(() => {
    let l = issues;
    if (q) l = l.filter((i) => i.summary.toLowerCase().includes(q.toLowerCase()) || i.key.toLowerCase().includes(q.toLowerCase()));
    if (status === "open") l = l.filter((i) => i.status !== "done");
    else if (status === "done") l = l.filter((i) => i.status === "done");
    else if (status) l = l.filter((i) => i.status === status);
    if (type) l = l.filter((i) => i.type === type);
    if (assignee) l = l.filter((i) => (assignee === "unassigned" ? !i.assigneeId : i.assigneeId === assignee));
    const cmp = (a: Issue, b: Issue) => {
      switch (sort.key) {
        case "key":
          return Number(a.key.split("-")[1]) - Number(b.key.split("-")[1]);
        case "summary":
          return a.summary.localeCompare(b.summary);
        case "status":
          return STATUSES.findIndex((s) => s.id === a.status) - STATUSES.findIndex((s) => s.id === b.status);
        case "assignee":
          return (users.find((u) => u.id === a.assigneeId)?.name ?? "zzz").localeCompare(users.find((u) => u.id === b.assigneeId)?.name ?? "zzz");
        case "priority":
          return priorityRank[a.priority] - priorityRank[b.priority];
        case "due":
          return (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
        case "logged":
          return (logged.get(a.id) ?? 0) - (logged.get(b.id) ?? 0);
        default:
          return a.updatedAt.localeCompare(b.updatedAt);
      }
    };
    return [...l].sort((a, b) => cmp(a, b) * sort.dir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issues, q, status, type, assignee, sort, users, logged]);

  if (!project) return null;

  const th = (label: string, k: SortKey, cls?: string) => (
    <th className={cn("border-b border-ds-border py-2 pr-3 text-left text-xs font-semibold text-ds-text-subtle", cls)}>
      <button type="button" onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? (s.dir === 1 ? -1 : 1) : 1 }))} className="inline-flex items-center gap-1 hover:text-ds-text">
        {label}
        {sort.key === k && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </button>
    </th>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 px-page pb-3 pt-4">
        <div className="relative w-52">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-ds-icon-subtle" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search list" className="ds-input h-8 py-1 pl-8" />
        </div>
        <Select
          value={status}
          onChange={setStatus}
          searchable={false}
          clearable
          appearance="chip"
          chipLabel="Status"
          placeholder="All"
          options={[
            { value: "open", label: "Open" },
            { value: "done", label: "Done" },
            ...STATUSES.map((s) => ({ value: s.id, label: s.name, icon: <span className="size-2.5 rounded-sm" style={{ background: STATUS_META[s.id as IssueStatus].color }} /> })),
          ]}
        />
        <Select value={type} onChange={setType} searchable={false} clearable appearance="chip" chipLabel="Type" placeholder="All" options={ISSUE_TYPES.map((t) => ({ value: t.id, label: t.name, icon: <IssueTypeIcon type={t.id as IssueType} /> }))} />
        <Select value={assignee} onChange={setAssignee} clearable appearance="chip" chipLabel="Assignee" placeholder="All" options={[{ value: "unassigned", label: "Unassigned" }, ...team.map((u) => ({ value: u.id, label: u.name }))]} />
        {(q || status || type || assignee) && (
          <Button appearance="subtle" iconBefore={<X />} onClick={() => { setQ(""); setStatus(null); setType(null); setAssignee(null); }}>
            Clear filters
          </Button>
        )}
        <span className="ml-auto text-xs text-ds-text-subtlest">{list.length} of {issues.length} work items</span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-page pb-6">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-ds-surface">
            <tr>
              <th className="w-8 border-b border-ds-border py-2 text-left text-xs font-semibold text-ds-text-subtle">Type</th>
              {th("Key", "key", "w-20")}
              {th("Summary", "summary")}
              {th("Status", "status", "w-32")}
              {th("Assignee", "assignee", "w-44")}
              {th("Priority", "priority", "w-28")}
              <th className="w-32 border-b border-ds-border py-2 pr-3 text-left text-xs font-semibold text-ds-text-subtle">Sprint</th>
              <th className="w-12 border-b border-ds-border py-2 pr-3 text-right text-xs font-semibold text-ds-text-subtle">Pts</th>
              {th("Due", "due", "w-24")}
              {th("Logged", "logged", "w-20")}
              {th("Updated", "updated", "w-28")}
            </tr>
          </thead>
          <tbody>
            {list.map((i) => {
              const parent = i.parentId ? issues.find((x) => x.id === i.parentId) : undefined;
              const sprint = sprints.find((s) => s.id === i.sprintId);
              return (
                <tr key={i.id} className="group/row hover:bg-ds-surface-hovered">
                  <td className="border-b border-ds-border py-1.5"><IssueTypeIcon type={i.type} /></td>
                  <td className="border-b border-ds-border py-1.5 pr-3 text-xs text-ds-text-subtle">
                    <Link href={`/browse/${i.key}`} className="hover:underline">{i.key}</Link>
                  </td>
                  <td className="border-b border-ds-border py-1.5 pr-3">
                    <button type="button" onClick={() => setOpenIssueId(i.id)} className="mr-2 text-left hover:underline">{i.summary}</button>
                    {parent?.type === "epic" && <EpicLozenge id={parent.id} name={parent.summary} />}
                  </td>
                  <td className="border-b border-ds-border py-1.5 pr-3"><StatusSelect value={i.status} onChange={(v) => update(i.id, { status: v })} compact /></td>
                  <td className="border-b border-ds-border py-1.5 pr-3"><UserSelect value={i.assigneeId} onChange={(v) => update(i.id, { assigneeId: v })} projectId={i.projectId} /></td>
                  <td className="border-b border-ds-border py-1.5 pr-3"><PrioritySelect value={i.priority} onChange={(v) => update(i.id, { priority: v })} /></td>
                  <td className="border-b border-ds-border py-1.5 pr-3 text-xs text-ds-text-subtle">{sprint?.name ?? "—"}</td>
                  <td className="border-b border-ds-border py-1.5 pr-3 text-right"><PointsBadge points={i.storyPoints} /></td>
                  <td className={cn("border-b border-ds-border py-1.5 pr-3 text-xs", i.dueDate && parseISO(i.dueDate) < new Date() && i.status !== "done" ? "font-semibold text-ds-text-danger" : "text-ds-text-subtle")}>{i.dueDate ? format(parseISO(i.dueDate), "d MMM") : "—"}</td>
                  <td className="border-b border-ds-border py-1.5 pr-3 text-xs text-ds-text-subtle tabular-nums">{logged.get(i.id) ? formatDurationShort(logged.get(i.id)!) : "—"}</td>
                  <td className="border-b border-ds-border py-1.5 pr-3 text-xs text-ds-text-subtlest">{relativeTime(i.updatedAt)}</td>
                </tr>
              );
            })}
            <tr>
              <td className="py-1.5"><Plus size={16} className="text-ds-icon-subtle" /></td>
              <td colSpan={10} className="py-1.5">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && text.trim()) {
                      createIssue({ projectId: project.id, type: "task", summary: text.trim() });
                      setText("");
                    }
                  }}
                  placeholder="Create a work item"
                  className="h-8 w-full rounded-ds border border-transparent bg-transparent px-2 text-sm hover:border-ds-border focus:border-ds-border-focused focus:outline-none"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <IssueModal issueId={openIssueId} onClose={() => setOpenIssueId(null)} />
    </div>
  );
}
