"use client";

import * as React from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { useProjectByKey } from "@/hooks/useData";
import { PROJECT_COLORS, type Pricing, type ProjectStatus, type ProjectType, type TimeMode } from "@/lib/types";
import { AllocationsTable } from "@/components/allocations/AllocationsTable";
import { currentRate } from "@/lib/rates";
import { cn } from "@/lib/utils";
import { Page } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/misc";
import { UserSelect } from "@/components/issues/fields";
import { Avatar, ProjectAvatar } from "@/components/ui/Avatar";
import { RateCell, RateModal } from "@/components/rates/RateModal";
import { ProjectTeamSection } from "@/components/team/ProjectTeamSection";
import { projectTeam } from "@/lib/team";

type RateTarget = { kind: "project" } | { kind: "member"; userId: string; rate: "cost" | "billing" };

export default function ProjectSettingsPage({ params }: PageProps<"/projects/[key]/settings">) {
  const { key } = use(params);
  const project = useProjectByKey(key);
  const clients = useStore((s) => s.clients);
  const users = useStore((s) => s.users);
  const entries = useStore((s) => s.timeEntries);
  const settings = useStore((s) => s.settings);
  const createClient = useStore((s) => s.createClient);
  const update = useStore((s) => s.updateProject);
  const remove = useStore((s) => s.deleteProject);
  const setProjectBillingRate = useStore((s) => s.setProjectBillingRate);
  const setMemberRate = useStore((s) => s.setMemberRate);
  const resetMemberRate = useStore((s) => s.resetMemberRate);
  const router = useRouter();
  const [name, setName] = React.useState(project?.name ?? "");
  const [saved, setSaved] = React.useState(false);
  const [target, setTarget] = React.useState<RateTarget | null>(null);
  React.useEffect(() => {
    setName(project?.name ?? "");
  }, [project?.id, project?.name]);
  if (!project) return null;

  const save = () => {
    update(project.id, { name: name.trim() || project.name });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const projectEntries = entries.filter((e) => e.projectId === project.id);
  const team = projectTeam(project, users);
  const ratesUsers = [...team, ...users.filter((u) => !team.includes(u) && projectEntries.some((e) => e.userId === u.id))];
  const defaultBilling = currentRate(project.billingRates);
  const targetUser = target?.kind === "member" ? users.find((u) => u.id === target.userId) : undefined;

  return (
    <Page>
      <div className="mt-4 max-w-3xl">
        <h2 className="ds-heading-md mb-4">Details</h2>
        <div className="mb-4 flex items-center gap-4">
          <ProjectAvatar name={project.name} color={project.color} size={64} />
          <div className="flex flex-wrap gap-1.5">
            {PROJECT_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => update(project.id, { color: c })} className={cn("size-6 rounded-full border-2", project.color === c ? "border-ds-text" : "border-transparent")} style={{ background: c }} aria-label={c} />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-[1fr_140px] gap-x-4">
          <label className="mb-4 block">
            <span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="ds-input" />
          </label>
          <label className="mb-4 block">
            <span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Key</span>
            <input value={project.key} disabled className="ds-input bg-ds-surface-sunken text-ds-text-subtlest" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-x-4">
          <label className="mb-4 block">
            <span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Type</span>
            <Select value={project.type} onChange={(v) => v && update(project.id, { type: v as ProjectType })} searchable={false} options={[{ value: "software", label: "Software (Scrum board, backlog, sprints)" }, { value: "business", label: "Business (Kanban board)" }]} />
          </label>
          <label className="mb-4 block">
            <span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Project lead</span>
            <UserSelect value={project.leadId} onChange={(v) => v && update(project.id, { leadId: v })} appearance="default" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-x-4">
          <label className="mb-4 block">
            <span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Client</span>
            <Select value={project.clientId ?? null} onChange={(v) => update(project.id, { clientId: v ?? undefined })} clearable placeholder="No client" options={clients.map((c) => ({ value: c.id, label: c.name }))} onCreate={(n) => update(project.id, { clientId: createClient(n).id })} createLabel={(n) => `Create client "${n}"`} />
          </label>
          <label className="mb-4 block">
            <span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Status</span>
            <Select
              value={project.status}
              onChange={(v) => v && update(project.id, { status: v as ProjectStatus })}
              searchable={false}
              options={[
                { value: "prospect", label: "Prospect", description: "Offers only, no work yet" },
                { value: "active", label: "Active", description: "Work in progress" },
                { value: "closed", label: "Closed", description: "Delivered, no more tracking expected" },
              ]}
            />
          </label>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Button appearance="primary" onClick={save}>Save changes</Button>
          {saved && <span className="text-sm text-ds-text-success">Saved</span>}
        </div>

        <h2 className="ds-heading-md mb-1 mt-10">Pricing and rates</h2>
        <p className="mb-4 text-sm text-ds-text-subtle">
          Every tracked hour is valued twice: at the member&apos;s <b>cost rate</b> and at the project&apos;s <b>billing rate</b>. Rates are dated, so changes can apply to new hours only or retroactively.
        </p>
        <div className="grid grid-cols-2 gap-x-4">
          <label className="mb-4 block">
            <span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Pricing</span>
            <Select
              value={project.pricing}
              onChange={(v) => v && update(project.id, { pricing: v as Pricing })}
              searchable={false}
              options={[
                { value: "fixed", label: "Fixed price", description: "Revenue is the order amount; hours drive cost" },
                { value: "tm", label: "Time & material", description: "Revenue is billable hours x billing rate" },
              ]}
            />
          </label>
          <div className="mb-4">
            <span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Default billing rate</span>
            <div className="flex h-8 items-center">
              <RateCell periods={project.billingRates} currency={settings.currency} onChange={() => setTarget({ kind: "project" })} />
            </div>
          </div>
        </div>
        <label className="mb-4 flex items-center gap-2 text-sm">
          <Toggle checked={project.billable} onChange={(v) => update(project.id, { billable: v })} /> New time entries are billable by default
        </label>

        <ProjectTeamSection project={project} />

        <h3 className="ds-heading-sm mb-2 mt-6">Member rates</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ds-text-subtle">
              <th className="border-b border-ds-border py-2 font-semibold">Member</th>
              <th className="border-b border-ds-border py-2 font-semibold">Cost rate on this project</th>
              <th className="border-b border-ds-border py-2 font-semibold">Billing rate on this project</th>
              <th className="border-b border-ds-border py-2 text-right font-semibold">Hours here</th>
            </tr>
          </thead>
          <tbody>
            {ratesUsers.map((u) => {
              const mr = project.memberRates?.[u.id] ?? {};
              const hours = projectEntries.filter((e) => e.userId === u.id).length;
              return (
                <tr key={u.id}>
                  <td className="border-b border-ds-border py-2 pr-4">
                    <span className="flex items-center gap-2"><Avatar user={u} size="sm" /> {u.name}{!team.includes(u) && <span className="text-xs text-ds-text-subtlest">not in the team, has hours here</span>}</span>
                  </td>
                  <td className="border-b border-ds-border py-2 pr-4">
                    <RateCell periods={mr.cost} inherited={currentRate(u.costRates)} currency={settings.currency} label={mr.cost?.length ? "override" : undefined} onChange={() => setTarget({ kind: "member", userId: u.id, rate: "cost" })} onReset={() => resetMemberRate(project.id, u.id, "cost")} />
                  </td>
                  <td className="border-b border-ds-border py-2 pr-4">
                    <RateCell periods={mr.billing} inherited={defaultBilling} currency={settings.currency} label={mr.billing?.length ? "override" : undefined} onChange={() => setTarget({ kind: "member", userId: u.id, rate: "billing" })} onReset={() => resetMemberRate(project.id, u.id, "billing")} />
                  </td>
                  <td className="tabular-nums border-b border-ds-border py-2 text-right text-ds-text-subtle">{hours} entries</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <h2 className="ds-heading-md mb-1 mt-10">Time mode</h2>
        <p className="mb-4 text-sm text-ds-text-subtle">
          <b>Timesheet</b>: members track their hours with the timer. <b>Allocation</b>: a share of each allocated member&apos;s working day is booked on this project automatically; the calendar and the timer show it as allocated time and members only track the rest elsewhere.
        </p>
        <div className="mb-4 max-w-sm">
          <Select
            value={project.timeMode}
            onChange={(v) => v && update(project.id, { timeMode: v as TimeMode })}
            searchable={false}
            options={[
              { value: "timesheet", label: "Timesheet", description: "Hours come from timer and manual entries" },
              { value: "allocation", label: "Allocation", description: "Hours come from fixed shares of members' time" },
            ]}
          />
        </div>
        {project.timeMode === "allocation" && <AllocationsTable project={project} />}

        <h2 className="ds-heading-md mb-3 mt-10">Danger zone</h2>
        <div className="flex items-center gap-3 rounded-ds border border-ds-border p-4">
          <div className="flex-1 text-sm">
            <div className="font-semibold">{project.archived ? "Restore project" : "Archive project"}</div>
            <div className="text-ds-text-subtle">Archived projects are hidden from lists but keep their data.</div>
          </div>
          <Button onClick={() => update(project.id, { archived: !project.archived })}>{project.archived ? "Restore" : "Archive"}</Button>
        </div>
        <div className="mt-3 flex items-center gap-3 rounded-ds border border-ds-border-danger p-4">
          <div className="flex-1 text-sm">
            <div className="font-semibold text-ds-text-danger">Delete project</div>
            <div className="text-ds-text-subtle">Deletes the project and all of its work items and sprints. Time entries are kept without a project.</div>
          </div>
          <Button appearance="danger" onClick={() => { if (confirm(`Delete ${project.name}?`)) { remove(project.id); router.push("/projects"); } }}>Delete</Button>
        </div>
      </div>

      {target?.kind === "project" && (
        <RateModal
          open
          onClose={() => setTarget(null)}
          title={`Billing rate · ${project.name}`}
          subtitle="Default selling price per hour for every member on this project, unless a member override exists."
          periods={project.billingRates}
          currency={settings.currency}
          affectedFrom={(from) => projectEntries.filter((e) => e.billable && e.start.slice(0, 10) >= from && !project.memberRates?.[e.userId]?.billing?.length).length}
          onApply={(r, from) => setProjectBillingRate(project.id, r, from)}
        />
      )}
      {target?.kind === "member" && targetUser && (
        <RateModal
          open
          onClose={() => setTarget(null)}
          title={`${target.rate === "cost" ? "Cost" : "Billing"} rate · ${targetUser.name} on ${project.name}`}
          subtitle={target.rate === "cost" ? "Overrides the member's default cost rate on this project only." : "Overrides the project's default billing rate for this member only."}
          periods={project.memberRates?.[target.userId]?.[target.rate]}
          inherited={target.rate === "cost" ? currentRate(targetUser.costRates) : defaultBilling}
          currency={settings.currency}
          affectedFrom={(from) => projectEntries.filter((e) => e.userId === target.userId && e.start.slice(0, 10) >= from && (target.rate === "cost" || e.billable)).length}
          onApply={(r, from) => setMemberRate(project.id, target.userId, target.rate, r, from)}
          onReset={() => resetMemberRate(project.id, target.userId, target.rate)}
        />
      )}
    </Page>
  );
}
