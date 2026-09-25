"use client";

import * as React from "react";
import { format } from "date-fns";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Project } from "@/lib/types";
import { allocatedPercent } from "@/lib/allocations";
import { useProjectTeam } from "@/hooks/useData";
import { pickable } from "@/lib/team";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Select } from "@/components/ui/Select";
import { IssueTypeIcon } from "@/components/issues/icons";

/** Fixed allocations of members to a project (Settings → Time mode: Allocation) */
export function AllocationsTable({ project }: { project: Project }) {
  const users = useStore((s) => s.users);
  const team = useProjectTeam(project.id);
  const allocations = useStore((s) => s.allocations);
  const issues = useStore((s) => s.issues);
  const settings = useStore((s) => s.settings);
  const add = useStore((s) => s.addAllocation);
  const update = useStore((s) => s.updateAllocation);
  const remove = useStore((s) => s.removeAllocation);
  const list = allocations.filter((a) => a.projectId === project.id);
  const epics = issues.filter((i) => i.projectId === project.id && i.type === "epic");
  const today = new Date();

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-ds-text-subtle">
            <th className="border-b border-ds-border py-2 font-semibold">Member</th>
            <th className="w-24 border-b border-ds-border py-2 font-semibold">Share</th>
            <th className="w-36 border-b border-ds-border py-2 font-semibold">From</th>
            <th className="w-36 border-b border-ds-border py-2 font-semibold">To</th>
            <th className="border-b border-ds-border py-2 font-semibold">Epic (optional)</th>
            <th className="w-28 border-b border-ds-border py-2 text-right font-semibold">Hours / day</th>
            <th className="w-10 border-b border-ds-border py-2" />
          </tr>
        </thead>
        <tbody>
          {list.map((a) => {
            const u = users.find((x) => x.id === a.userId);
            const total = allocatedPercent(a.userId, today, allocations);
            return (
              <tr key={a.id}>
                <td className="border-b border-ds-border py-2 pr-3">
                  <span className="flex items-center gap-2">
                    <Avatar user={u} size="sm" /> {u?.name}
                    {total > 100 && (
                      <span className="inline-flex items-center gap-1 rounded-[3px] bg-ds-warning px-1 text-[11px] font-semibold text-ds-text-warning" title={`${total}% allocated across projects today`}>
                        <AlertTriangle size={11} /> {total}%
                      </span>
                    )}
                  </span>
                </td>
                <td className="border-b border-ds-border py-2 pr-3">
                  <span className="inline-flex items-center gap-1">
                    <input type="number" min={1} max={100} value={a.percent} onChange={(e) => update(a.id, { percent: Math.max(1, Math.min(100, Number(e.target.value) || 0)) })} className="ds-inline-edit h-7 w-14 bg-transparent px-1 text-right outline-none" />%
                  </span>
                </td>
                <td className="border-b border-ds-border py-2 pr-3"><input type="date" value={a.from} onChange={(e) => update(a.id, { from: e.target.value })} className="ds-inline-edit h-7 w-full bg-transparent px-1 text-sm outline-none" /></td>
                <td className="border-b border-ds-border py-2 pr-3"><input type="date" value={a.to ?? ""} onChange={(e) => update(a.id, { to: e.target.value || undefined })} className="ds-inline-edit h-7 w-full bg-transparent px-1 text-sm outline-none" placeholder="Open ended" /></td>
                <td className="border-b border-ds-border py-2 pr-3">
                  <Select value={a.issueId ?? null} onChange={(v) => update(a.id, { issueId: v ?? undefined })} clearable placeholder="Whole project" appearance="subtle" options={epics.map((e) => ({ value: e.id, label: e.summary, icon: <IssueTypeIcon type="epic" />, description: e.key }))} />
                </td>
                <td className="tabular-nums border-b border-ds-border py-2 text-right text-ds-text-subtle">{Math.round((a.percent / 100) * settings.hoursPerDay * 10) / 10}h</td>
                <td className="border-b border-ds-border py-2 text-center">
                  <button type="button" onClick={() => remove(a.id)} className="inline-flex size-6 items-center justify-center rounded-ds text-ds-icon-subtle hover:bg-ds-neutral-hovered hover:text-ds-text-danger" aria-label="Remove allocation"><Trash2 size={14} /></button>
                </td>
              </tr>
            );
          })}
          {list.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-ds-text-subtlest">No allocations yet. Allocated members get their share of every working day booked on this project automatically.</td></tr>}
        </tbody>
      </table>
      <div className="mt-2 flex items-center gap-2">
        <Select
          value={null}
          onChange={(v) => v && add({ projectId: project.id, userId: v, percent: 20, from: format(new Date(), "yyyy-MM-dd") })}
          placeholder="Add member"
          appearance="chip"
          chipLabel="Add allocation"
          options={pickable(team).map((u) => ({ value: u.id, label: u.name, icon: <Avatar user={u} size="xs" />, description: `${allocatedPercent(u.id, today, allocations)}% allocated today` }))}
        />
        <Button appearance="subtle" iconBefore={<Plus />} disabled={!team.length} onClick={() => add({ projectId: project.id, userId: team[0].id, percent: 20, from: format(new Date(), "yyyy-MM-dd") })}>Quick add</Button>
      </div>
    </div>
  );
}
