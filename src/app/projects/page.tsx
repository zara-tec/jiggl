"use client";

import * as React from "react";
import Link from "next/link";
import { MoreHorizontal, Search, Star, Trash2, Archive, ArchiveRestore } from "lucide-react";
import { useStore } from "@/lib/store";
import { PROJECT_COLORS, type Pricing, type ProjectStatus, type ProjectType } from "@/lib/types";
import { Lozenge } from "@/components/ui/Lozenge";
import { PROJECT_STATUS_META } from "@/components/offers/meta";
import { currentRate } from "@/lib/rates";
import { cn } from "@/lib/utils";
import { Page } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/misc";
import { Button } from "@/components/ui/Button";
import { Avatar, ProjectAvatar } from "@/components/ui/Avatar";
import { DropdownMenu, MenuItem } from "@/components/ui/Popover";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/misc";
import { UserSelect } from "@/components/issues/fields";

export default function ProjectsPage() {
  const projects = useStore((s) => s.projects);
  const users = useStore((s) => s.users);
  const clients = useStore((s) => s.clients);
  const issues = useStore((s) => s.issues);
  const toggleStar = useStore((s) => s.toggleStarProject);
  const updateProject = useStore((s) => s.updateProject);
  const deleteProject = useStore((s) => s.deleteProject);
  const [q, setQ] = React.useState("");
  const [type, setType] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [showArchived, setShowArchived] = React.useState(false);

  const list = projects
    .filter((p) => (showArchived ? true : !p.archived))
    .filter((p) => !type || p.type === type)
    .filter((p) => !status || p.status === status)
    .filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.key.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(!!b.starred) - Number(!!a.starred) || a.name.localeCompare(b.name));

  return (
    <>
      <PageHeader
        title="Projects"
        actions={
          <Button appearance="primary" onClick={() => setCreateOpen(true)}>
            Create project
          </Button>
        }
      />
      <Page>
        <div className="mt-4 flex items-center gap-2">
          <div className="relative w-56">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-ds-icon-subtle" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects" className="ds-input h-8 py-1 pl-8" />
          </div>
          <Select
            value={type}
            onChange={setType}
            searchable={false}
            clearable
            appearance="chip"
            chipLabel="Type"
            placeholder="All types"
            options={[
              { value: "software", label: "Software" },
              { value: "business", label: "Business" },
              { value: "service", label: "Service management" },
            ]}
          />
          <Select
            value={status}
            onChange={setStatus}
            searchable={false}
            clearable
            appearance="chip"
            chipLabel="Status"
            placeholder="All"
            options={[
              { value: "prospect", label: "Prospect" },
              { value: "active", label: "Active" },
              { value: "closed", label: "Closed" },
            ]}
          />
          <label className="ml-2 flex items-center gap-2 text-sm text-ds-text-subtle">
            <Toggle checked={showArchived} onChange={setShowArchived} label="Show archived" /> Show archived
          </label>
        </div>

        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-ds-text-subtle">
              <th className="w-8 border-b border-ds-border py-2" />
              <th className="border-b border-ds-border py-2 pr-4 font-semibold">Name</th>
              <th className="border-b border-ds-border py-2 pr-4 font-semibold">Key</th>
              <th className="border-b border-ds-border py-2 pr-4 font-semibold">Status</th>
              <th className="border-b border-ds-border py-2 pr-4 font-semibold">Type</th>
              <th className="border-b border-ds-border py-2 pr-4 font-semibold">Lead</th>
              <th className="border-b border-ds-border py-2 pr-4 font-semibold">Client</th>
              <th className="border-b border-ds-border py-2 pr-4 font-semibold">Pricing</th>
              <th className="border-b border-ds-border py-2 pr-4 text-right font-semibold">Open</th>
              <th className="w-10 border-b border-ds-border py-2" />
            </tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const lead = users.find((u) => u.id === p.leadId);
              const client = clients.find((c) => c.id === p.clientId);
              const open = issues.filter((i) => i.projectId === p.id && i.status !== "done").length;
              return (
                <tr key={p.id} className={cn("group/row hover:bg-ds-surface-hovered", p.archived && "opacity-60")}>
                  <td className="border-b border-ds-border py-2">
                    <button type="button" onClick={() => toggleStar(p.id)} className="inline-flex size-6 items-center justify-center rounded-ds hover:bg-ds-neutral-hovered" aria-label="Star">
                      <Star size={16} className={p.starred ? "fill-ds-star text-ds-star" : "text-ds-icon-subtle opacity-0 group-hover/row:opacity-100"} />
                    </button>
                  </td>
                  <td className="border-b border-ds-border py-2 pr-4">
                    <Link href={`/projects/${p.key}/board`} className="flex items-center gap-2 font-medium text-ds-link hover:underline">
                      <ProjectAvatar name={p.name} color={p.color} size={24} />
                      {p.name}
                      {p.archived && <span className="text-xs text-ds-text-subtlest">(archived)</span>}
                    </Link>
                  </td>
                  <td className="border-b border-ds-border py-2 pr-4 text-ds-text-subtle">{p.key}</td>
                  <td className="border-b border-ds-border py-2 pr-4"><Lozenge appearance={PROJECT_STATUS_META[p.status].appearance}>{PROJECT_STATUS_META[p.status].name}</Lozenge></td>
                  <td className="border-b border-ds-border py-2 pr-4 text-ds-text-subtle">{p.type === "software" ? "Software" : p.type === "business" ? "Business" : "Service"}</td>
                  <td className="border-b border-ds-border py-2 pr-4">
                    <span className="flex items-center gap-2">
                      <Avatar user={lead} size="sm" /> {lead?.name}
                    </span>
                  </td>
                  <td className="border-b border-ds-border py-2 pr-4 text-ds-text-subtle">{client?.name ?? "—"}</td>
                  <td className="border-b border-ds-border py-2 pr-4 text-ds-text-subtle">
                    {p.pricing === "tm" ? "Time & material" : "Fixed price"}
                    {currentRate(p.billingRates) !== undefined && <span className="ml-1 text-xs text-ds-text-subtlest">· €{currentRate(p.billingRates)}/h</span>}
                  </td>
                  <td className="border-b border-ds-border py-2 pr-4 text-right tabular-nums">{open}</td>
                  <td className="border-b border-ds-border py-2">
                    <DropdownMenu
                      align="end"
                      trigger={({ ref, toggle }) => (
                        <button ref={ref} type="button" onClick={toggle} className="inline-flex size-6 items-center justify-center rounded-ds text-ds-icon hover:bg-ds-neutral-hovered">
                          <MoreHorizontal size={16} />
                        </button>
                      )}
                    >
                      {({ close }) => (
                        <>
                          <Link href={`/projects/${p.key}/settings`} onClick={close}>
                            <MenuItem>Project settings</MenuItem>
                          </Link>
                          <MenuItem
                            icon={p.archived ? <ArchiveRestore /> : <Archive />}
                            onClick={() => {
                              updateProject(p.id, { archived: !p.archived });
                              close();
                            }}
                          >
                            {p.archived ? "Restore" : "Archive"}
                          </MenuItem>
                          <MenuItem
                            icon={<Trash2 />}
                            className="text-ds-text-danger"
                            onClick={() => {
                              if (confirm(`Delete project ${p.name} and all its work items?`)) deleteProject(p.id);
                              close();
                            }}
                          >
                            Delete
                          </MenuItem>
                        </>
                      )}
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr>
                <td colSpan={10} className="py-10 text-center text-ds-text-subtlest">
                  No projects match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Page>
      <CreateProjectModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

export function CreateProjectModal({ open, onClose, defaultClientId }: { open: boolean; onClose: () => void; defaultClientId?: string }) {
  const createProject = useStore((s) => s.createProject);
  const projects = useStore((s) => s.projects);
  const clients = useStore((s) => s.clients);
  const createClient = useStore((s) => s.createClient);
  const me = useStore((s) => s.currentUserId);
  const [name, setName] = React.useState("");
  const [key, setKey] = React.useState("");
  const [keyTouched, setKeyTouched] = React.useState(false);
  const [type, setType] = React.useState<ProjectType>("software");
  const [leadId, setLeadId] = React.useState<string | undefined>(me);
  const [clientId, setClientId] = React.useState<string | undefined>();
  const [color, setColor] = React.useState(PROJECT_COLORS[0]);
  const [billable, setBillable] = React.useState(true);
  const [pricing, setPricing] = React.useState<Pricing>("fixed");
  const [pstatus, setPstatus] = React.useState<ProjectStatus>("active");
  const [rate, setRate] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setName("");
      setKey("");
      setKeyTouched(false);
      setType("software");
      setLeadId(me);
      setClientId(defaultClientId);
      setColor(PROJECT_COLORS[projects.length % PROJECT_COLORS.length]);
      setBillable(true);
      setPricing("fixed");
      setPstatus("active");
      setRate("");
      setError(null);
    }
  }, [open, me, projects.length, defaultClientId]);

  React.useEffect(() => {
    if (keyTouched) return;
    const words = name.trim().split(/\s+/).filter(Boolean);
    const k = words.length >= 2 ? words.map((w) => w[0]).join("") : name.replace(/[^a-z]/gi, "").slice(0, 4);
    setKey(k.toUpperCase().slice(0, 6));
  }, [name, keyTouched]);

  const submit = () => {
    if (!name.trim()) return setError("Name is required");
    if (!/^[A-Z][A-Z0-9]{1,9}$/.test(key)) return setError("Key must be 2-10 uppercase letters/digits and start with a letter");
    if (projects.some((p) => p.key === key)) return setError("A project with this key already exists");
    createProject({
      name: name.trim(),
      key,
      type,
      leadId: leadId ?? me,
      clientId,
      color,
      billable,
      pricing,
      timeMode: "timesheet",
      status: pstatus,
      billingRates: rate ? [{ from: "1970-01-01", rate: Number(rate) }] : [],
      memberRates: {},
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create project"
      width={560}
      footer={
        <>
          <Button appearance="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button appearance="primary" onClick={submit}>
            Create
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-[1fr_140px] gap-x-4">
        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Name *</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="ds-input" placeholder="Try a team name, project goal, milestone..." />
        </label>
        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Key *</span>
          <input
            value={key}
            onChange={(e) => {
              setKeyTouched(true);
              setKey(e.target.value.toUpperCase());
            }}
            className="ds-input uppercase"
          />
        </label>
      </div>
      {error && <div className="mb-3 text-xs text-ds-text-danger">{error}</div>}
      <div className="grid grid-cols-2 gap-x-4">
        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Type</span>
          <Select
            value={type}
            onChange={(v) => v && setType(v as ProjectType)}
            searchable={false}
            options={[
              { value: "software", label: "Software", description: "Scrum board, backlog and sprints" },
              { value: "business", label: "Business", description: "Kanban board and list" },
            ]}
          />
        </label>
        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Lead</span>
          <UserSelect value={leadId} onChange={setLeadId} appearance="default" placeholder="Select lead" />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-x-4">
        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Client</span>
          <Select
            value={clientId ?? null}
            onChange={(v) => setClientId(v ?? undefined)}
            clearable
            placeholder="No client"
            options={clients.map((c) => ({ value: c.id, label: c.name }))}
            onCreate={(n) => setClientId(createClient(n).id)}
            createLabel={(n) => `Create client "${n}"`}
          />
        </label>
        <div className="mb-4">
          <span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Colour</span>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {PROJECT_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)} className={cn("size-6 rounded-full border-2", color === c ? "border-ds-text" : "border-transparent")} style={{ background: c }} aria-label={c} />
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4">
        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Pricing</span>
          <Select
            value={pricing}
            onChange={(v) => v && setPricing(v as Pricing)}
            searchable={false}
            options={[
              { value: "fixed", label: "Fixed price", description: "Revenue is the order amount" },
              { value: "tm", label: "Time & material", description: "Revenue is billable hours x price" },
            ]}
          />
        </label>
        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Default billing rate</span>
          <input value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ""))} className="ds-input" placeholder="€ / h" />
        </label>
      </div>
      <div className="grid grid-cols-2 items-end gap-x-4">
        <label className="mb-1 block">
          <span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Status</span>
          <Select
            value={pstatus}
            onChange={(v) => v && setPstatus(v as ProjectStatus)}
            searchable={false}
            options={[
              { value: "prospect", label: "Prospect", description: "Offers only, no work yet" },
              { value: "active", label: "Active", description: "Work in progress" },
            ]}
          />
        </label>
        <label className="mb-2 flex items-center gap-2 text-sm">
          <Toggle checked={billable} onChange={setBillable} /> Time entries are billable by default
        </label>
      </div>
    </Modal>
  );
}
