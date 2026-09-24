"use client";

import * as React from "react";
import Link from "next/link";
import { addDays, parseISO, startOfDay, subDays } from "date-fns";
import { Star } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Issue } from "@/lib/types";
import { cn, relativeTime } from "@/lib/utils";
import { PageHeader } from "@/components/ui/misc";
import { Avatar } from "@/components/ui/Avatar";
import { IssueTypeIcon, PriorityIcon, StatusLozenge } from "@/components/issues/icons";
import { IssueModal } from "@/components/issues/IssueView";

export default function FiltersPage() {
  const issues = useStore((s) => s.issues);
  const projects = useStore((s) => s.projects);
  const users = useStore((s) => s.users);
  const me = useStore((s) => s.currentUserId);
  const recent = useStore((s) => s.ui.recentIssueIds);
  const [active, setActive] = React.useState("my-open");
  const [openIssueId, setOpenIssueId] = React.useState<string | null>(null);
  const today = startOfDay(new Date());

  const filters: { id: string; name: string; description: string; fn: (i: Issue) => boolean; starred?: boolean }[] = [
    { id: "my-open", name: "My open work items", description: "assignee = currentUser() AND status != Done", fn: (i) => i.assigneeId === me && i.status !== "done", starred: true },
    { id: "reported", name: "Reported by me", description: "reporter = currentUser()", fn: (i) => i.reporterId === me, starred: true },
    { id: "all", name: "All work items", description: "ORDER BY updated DESC", fn: () => true },
    { id: "open", name: "Open work items", description: "status != Done", fn: (i) => i.status !== "done" },
    { id: "done", name: "Done work items", description: "status = Done", fn: (i) => i.status === "done" },
    { id: "viewed", name: "Viewed recently", description: "issuekey in issueHistory()", fn: (i) => recent.includes(i.id) },
    { id: "created", name: "Created recently", description: "created >= -7d", fn: (i) => parseISO(i.createdAt) >= subDays(today, 7) },
    { id: "resolved", name: "Resolved recently", description: "resolved >= -7d", fn: (i) => !!i.resolvedAt && parseISO(i.resolvedAt) >= subDays(today, 7) },
    { id: "updated", name: "Updated recently", description: "updated >= -7d", fn: (i) => parseISO(i.updatedAt) >= subDays(today, 7) },
    { id: "due", name: "Due this week", description: "due <= endOfWeek() AND status != Done", fn: (i) => !!i.dueDate && parseISO(i.dueDate) <= addDays(today, 7) && i.status !== "done" },
    { id: "overdue", name: "Overdue", description: "due < now() AND status != Done", fn: (i) => !!i.dueDate && parseISO(i.dueDate) < today && i.status !== "done" },
    { id: "bugs", name: "Open bugs", description: "type = Bug AND status != Done", fn: (i) => i.type === "bug" && i.status !== "done" },
    { id: "unassigned", name: "Unassigned", description: "assignee is EMPTY AND status != Done", fn: (i) => !i.assigneeId && i.status !== "done" && i.type !== "epic" },
  ];
  const f = filters.find((x) => x.id === active)!;
  const results = issues.filter(f.fn).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <>
      <PageHeader title="Filters" />
      <div className="flex min-h-0 flex-1 gap-6 overflow-hidden px-8 pb-6 pt-4">
        <aside className="w-72 shrink-0 overflow-y-auto">
          <div className="ds-heading-xxs mb-2 text-ds-text-subtlest">Starred</div>
          {filters.filter((x) => x.starred).map((x) => (
            <FilterItem key={x.id} f={x} active={active === x.id} onClick={() => setActive(x.id)} count={issues.filter(x.fn).length} />
          ))}
          <div className="ds-heading-xxs mb-2 mt-4 text-ds-text-subtlest">Default filters</div>
          {filters.filter((x) => !x.starred).map((x) => (
            <FilterItem key={x.id} f={x} active={active === x.id} onClick={() => setActive(x.id)} count={issues.filter(x.fn).length} />
          ))}
        </aside>
        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="mb-1 flex items-center gap-2">
            <h2 className="ds-heading-md">{f.name}</h2>
            {f.starred && <Star size={14} className="fill-ds-star text-ds-star" />}
          </div>
          <code className="mb-3 block rounded-ds bg-ds-surface-sunken px-2 py-1 font-mono text-xs text-ds-text-subtle">{f.description}</code>
          <div className="mb-2 text-xs text-ds-text-subtlest">{results.length} work item{results.length === 1 ? "" : "s"}</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ds-text-subtle">
                <th className="w-8 border-b border-ds-border py-2 font-semibold">T</th>
                <th className="w-20 border-b border-ds-border py-2 font-semibold">Key</th>
                <th className="border-b border-ds-border py-2 font-semibold">Summary</th>
                <th className="w-36 border-b border-ds-border py-2 font-semibold">Project</th>
                <th className="w-40 border-b border-ds-border py-2 font-semibold">Assignee</th>
                <th className="w-8 border-b border-ds-border py-2 font-semibold">P</th>
                <th className="w-28 border-b border-ds-border py-2 font-semibold">Status</th>
                <th className="w-28 border-b border-ds-border py-2 font-semibold">Updated</th>
              </tr>
            </thead>
            <tbody>
              {results.map((i) => {
                const p = projects.find((x) => x.id === i.projectId);
                const u = users.find((x) => x.id === i.assigneeId);
                return (
                  <tr key={i.id} className="hover:bg-ds-surface-hovered">
                    <td className="border-b border-ds-border py-1.5"><IssueTypeIcon type={i.type} /></td>
                    <td className="border-b border-ds-border py-1.5 text-xs text-ds-text-subtle"><Link href={`/browse/${i.key}`} className="hover:underline">{i.key}</Link></td>
                    <td className="border-b border-ds-border py-1.5 pr-3"><button type="button" onClick={() => setOpenIssueId(i.id)} className="text-left hover:underline">{i.summary}</button></td>
                    <td className="border-b border-ds-border py-1.5 pr-3 text-ds-text-subtle">{p?.name}</td>
                    <td className="border-b border-ds-border py-1.5 pr-3"><span className="flex items-center gap-2"><Avatar user={u} size="xs" />{u?.name ?? <span className="text-ds-text-subtlest">Unassigned</span>}</span></td>
                    <td className="border-b border-ds-border py-1.5"><PriorityIcon priority={i.priority} /></td>
                    <td className="border-b border-ds-border py-1.5"><StatusLozenge status={i.status} /></td>
                    <td className="border-b border-ds-border py-1.5 text-xs text-ds-text-subtlest">{relativeTime(i.updatedAt)}</td>
                  </tr>
                );
              })}
              {results.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-ds-text-subtlest">No work items match this filter.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <IssueModal issueId={openIssueId} onClose={() => setOpenIssueId(null)} />
    </>
  );
}

function FilterItem({ f, active, onClick, count }: { f: { id: string; name: string }; active: boolean; onClick: () => void; count: number }) {
  return (
    <button type="button" onClick={onClick} className={cn("mb-0.5 flex h-8 w-full items-center gap-2 rounded-ds px-2 text-left text-sm", active ? "bg-ds-selected text-ds-text-selected" : "text-ds-text-subtle hover:bg-ds-neutral-subtle-hovered hover:text-ds-text")}>
      <span className="min-w-0 flex-1 truncate">{f.name}</span>
      <span className="rounded-lg bg-ds-neutral px-1.5 text-[11px] font-semibold text-ds-text-subtle">{count}</span>
    </button>
  );
}
