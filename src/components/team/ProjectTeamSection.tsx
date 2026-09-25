"use client";

import * as React from "react";
import { X } from "lucide-react";
import { useStore } from "@/lib/store";
import type { ID, Project } from "@/lib/types";
import { forecastMembers } from "@/lib/forecast";
import { isTeamOpen, projectTeam } from "@/lib/team";
import { Avatar } from "@/components/ui/Avatar";
import { Select } from "@/components/ui/Select";

/**
 * Project settings → Team: everyone in the workspace, or a chosen list of
 * members. Assignees, forecast columns, allocations and filters of the
 * project only offer the team.
 */
export function ProjectTeamSection({ project }: { project: Project }) {
  const users = useStore((s) => s.users);
  const issues = useStore((s) => s.issues);
  const allocations = useStore((s) => s.allocations);
  const offers = useStore((s) => s.offers);
  const setTeam = useStore((s) => s.setProjectTeam);
  const addMember = useStore((s) => s.addProjectMember);
  const removeMember = useStore((s) => s.removeProjectMember);
  const open = isTeamOpen(project);
  const team = projectTeam(project, users);
  const outside = users.filter((u) => !team.some((t) => t.id === u.id)).sort((a, b) => a.name.localeCompare(b.name));

  /** People already working on the project: the natural first team */
  const suggested = (): ID[] => {
    const ids = new Set<ID>();
    for (const i of issues) if (i.projectId === project.id && i.assigneeId) ids.add(i.assigneeId);
    for (const a of allocations) if (a.projectId === project.id) ids.add(a.userId);
    for (const o of offers) if (o.projectId === project.id) for (const id of forecastMembers(o.lines)) ids.add(id);
    return [...ids];
  };

  return (
    <div>
      <h3 className="ds-heading-sm mb-1 mt-6">Team</h3>
      <p className="mb-2 text-sm text-ds-text-subtle">Who works on this project. With a chosen team, assignees, forecast columns, allocations and filters only offer these people; the lead is always in.</p>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={open ? "everyone" : "selected"}
          onChange={(v) => v && (v === "everyone" ? setTeam(project.id, undefined) : setTeam(project.id, suggested()))}
          searchable={false}
          appearance="chip"
          chipLabel="Team"
          options={[
            { value: "everyone", label: "Everyone in the workspace", description: "No restriction, as before" },
            { value: "selected", label: "Selected members", description: "Starts with the people already assigned, allocated or planned here" },
          ]}
          menuClassName="w-80"
        />
        {!open && (
          <Select
            value={null}
            onChange={(v) => v && addMember(project.id, v)}
            appearance="chip"
            chipLabel="Add member"
            placeholder="Add member"
            isDisabled={outside.length === 0}
            options={outside.map((u) => ({ value: u.id, label: u.name, icon: <Avatar user={u} size="xs" />, description: u.email }))}
            menuClassName="w-72"
          />
        )}
        {!open &&
          team.map((u) => (
            <span key={u.id} className="inline-flex h-8 items-center gap-1.5 rounded-ds bg-ds-neutral pl-1.5 pr-2 text-sm" data-testid="team-member">
              <Avatar user={u} size="xs" /> {u.name}
              {u.id === project.leadId ? (
                <span className="text-xs text-ds-text-subtlest">lead</span>
              ) : (
                <button type="button" onClick={() => removeMember(project.id, u.id)} className="inline-flex size-5 items-center justify-center rounded-ds text-ds-icon-subtle hover:bg-ds-neutral-hovered hover:text-ds-text-danger" aria-label={`Remove ${u.name} from the team`}>
                  <X size={12} />
                </button>
              )}
            </span>
          ))}
        {open && <span className="text-sm text-ds-text-subtlest">All {users.length} members of the workspace.</span>}
      </div>
    </div>
  );
}
