"use client";

import * as React from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useProjectTeam } from "@/hooks/useData";
import { ISSUE_TYPES, PRIORITIES, STATUSES, type ID, type IssuePriority, type IssueStatus, type IssueType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Avatar, ProjectAvatar } from "@/components/ui/Avatar";
import { Select, type SelectOption } from "@/components/ui/Select";
import { Lozenge, boldStatusClasses } from "@/components/ui/Lozenge";
import { Popover } from "@/components/ui/Popover";
import { IssueTypeIcon, PriorityIcon, STATUS_META, StatusLozenge } from "./icons";

type Appearance = "default" | "subtle" | "inline";

/* ---------- Status ---------- */
export function StatusSelect({ value, onChange, appearance = "subtle", className, compact }: { value: IssueStatus; onChange: (v: IssueStatus) => void; appearance?: Appearance; className?: string; compact?: boolean }) {
  const options: SelectOption<IssueStatus>[] = STATUSES.map((s) => ({
    value: s.id,
    label: s.name,
    icon: <span className="size-2.5 rounded-sm" style={{ background: STATUS_META[s.id].color }} />,
  }));
  return (
    <Select
      value={value}
      options={options}
      onChange={(v) => v && onChange(v)}
      searchable={false}
      appearance={appearance}
      className={cn("w-auto", className)}
      compact={compact}
      renderTrigger={({ open }) => (
        <span className="inline-flex items-center gap-1">
          <StatusLozenge status={value} isBold />
          <ChevronDown size={14} className={cn("text-ds-icon transition-transform", open && "rotate-180")} />
        </span>
      )}
    />
  );
}

/** "Status" button in the work item view: big lozenge-like button */
export function StatusButton({ value, onChange }: { value: IssueStatus; onChange: (v: IssueStatus) => void }) {
  const meta = STATUS_META[value];
  const options: SelectOption<IssueStatus>[] = STATUSES.map((s) => ({
    value: s.id,
    label: s.name,
    icon: <span className="size-2.5 rounded-sm" style={{ background: STATUS_META[s.id].color }} />,
    keywords: s.category,
  }));
  const cls = boldStatusClasses(meta.appearance);
  return (
    <Select
      value={value}
      options={options}
      onChange={(v) => v && onChange(v)}
      searchable={false}
      appearance="inline"
      className={cn("h-8 rounded-ds px-3 font-semibold hover:bg-transparent", cls)}
      renderTrigger={({ open }) => (
        <span className="inline-flex items-center gap-1.5 text-sm">
          {meta.name}
          <ChevronDown size={16} className={cn("transition-transform", open && "rotate-180")} />
        </span>
      )}
    />
  );
}

/* ---------- Priority ---------- */
export function PrioritySelect({ value, onChange, appearance = "subtle", className, iconOnly }: { value: IssuePriority; onChange: (v: IssuePriority) => void; appearance?: Appearance; className?: string; iconOnly?: boolean }) {
  const options: SelectOption<IssuePriority>[] = PRIORITIES.map((p) => ({ value: p.id, label: p.name, icon: <PriorityIcon priority={p.id} /> }));
  return (
    <Select
      value={value}
      options={options}
      onChange={(v) => v && onChange(v)}
      searchable={false}
      appearance={appearance}
      className={className}
      renderTrigger={iconOnly ? () => <PriorityIcon priority={value} /> : undefined}
    />
  );
}

/* ---------- Type ---------- */
export function TypeSelect({ value, onChange, appearance = "default", className, exclude }: { value: IssueType; onChange: (v: IssueType) => void; appearance?: Appearance; className?: string; exclude?: IssueType[] }) {
  const options: SelectOption<IssueType>[] = ISSUE_TYPES.filter((t) => !exclude?.includes(t.id)).map((t) => ({ value: t.id, label: t.name, icon: <IssueTypeIcon type={t.id} /> }));
  return <Select value={value} options={options} onChange={(v) => v && onChange(v)} searchable={false} appearance={appearance} className={className} />;
}

/* ---------- Assignee / user ---------- */
export function UserSelect({
  value,
  onChange,
  appearance = "subtle",
  placeholder = "Unassigned",
  className,
  showAssignToMe,
  avatarOnly,
  projectId,
}: {
  value?: ID;
  onChange: (v: ID | undefined) => void;
  appearance?: Appearance;
  placeholder?: string;
  className?: string;
  showAssignToMe?: boolean;
  avatarOnly?: boolean;
  /** Offer only the team of this project (plus the current value) */
  projectId?: ID;
}) {
  const users = useStore((s) => s.users);
  const team = useProjectTeam(projectId);
  const me = useStore((s) => s.currentUserId);
  const pool = projectId ? team : users;
  const selected = users.find((u) => u.id === value);
  const listed = selected && !pool.includes(selected) ? [...pool, selected] : pool;
  const options: SelectOption[] = listed.map((u) => ({ value: u.id, label: u.name, icon: <Avatar user={u} size="sm" />, description: pool.includes(u) ? u.email : "Not in the project team" }));
  return (
    <div className={cn("flex min-w-0 flex-col", className)}>
      <Select
        value={value ?? null}
        options={options}
        onChange={(v) => onChange(v ?? undefined)}
        placeholder={placeholder}
        placeholderIcon={<Avatar size="sm" />}
        clearable
        appearance={appearance}
        renderTrigger={
          avatarOnly
            ? () => <Avatar user={selected} size="sm" />
            : ({ selected: sel }) => (
                <span className="inline-flex min-w-0 items-center gap-2">
                  <Avatar user={selected} size="sm" />
                  <span className={cn("truncate", !sel && "text-ds-text-subtlest")}>{sel?.label ?? placeholder}</span>
                </span>
              )
        }
      />
      {showAssignToMe && value !== me && (
        <button type="button" onClick={() => onChange(me)} className="mt-0.5 self-start px-1.5 text-xs text-ds-link hover:underline">
          Assign to me
        </button>
      )}
    </div>
  );
}

/* ---------- Project ---------- */
export function ProjectSelect({ value, onChange, appearance = "default", className, clearable, placeholder = "Select project", compact }: { value?: ID; onChange: (v: ID | undefined) => void; appearance?: Appearance; className?: string; clearable?: boolean; placeholder?: string; compact?: boolean }) {
  const projects = useStore((s) => s.projects);
  const clients = useStore((s) => s.clients);
  const options: SelectOption[] = projects
    .filter((p) => !p.archived)
    .map((p) => ({
      value: p.id,
      label: p.name,
      icon: <ProjectAvatar name={p.name} color={p.color} size={20} />,
      description: [p.key, clients.find((c) => c.id === p.clientId)?.name].filter(Boolean).join(" · "),
      keywords: p.key,
    }));
  return <Select value={value ?? null} options={options} onChange={(v) => onChange(v ?? undefined)} appearance={appearance} className={className} clearable={clearable} placeholder={placeholder} compact={compact} />;
}

/* ---------- Sprint ---------- */
export function SprintSelect({ projectId, value, onChange, appearance = "subtle", className }: { projectId: ID; value?: ID; onChange: (v: ID | undefined) => void; appearance?: Appearance; className?: string }) {
  const sprints = useStore((s) => s.sprints);
  const options: SelectOption[] = sprints
    .filter((sp) => sp.projectId === projectId && sp.state !== "closed")
    .sort((a, b) => a.order - b.order)
    .map((sp) => ({ value: sp.id, label: sp.name, description: sp.state === "active" ? "Active sprint" : "Future sprint" }));
  return <Select value={value ?? null} options={options} onChange={(v) => onChange(v ?? undefined)} appearance={appearance} className={className} clearable placeholder="None" searchable={false} />;
}

/* ---------- Parent (epic) ---------- */
export function ParentSelect({ projectId, value, onChange, appearance = "subtle", className, type }: { projectId: ID; value?: ID; onChange: (v: ID | undefined) => void; appearance?: Appearance; className?: string; type?: IssueType }) {
  const issues = useStore((s) => s.issues);
  const candidates = issues.filter((i) => i.projectId === projectId && (type === "subtask" ? i.type !== "epic" && i.type !== "subtask" : i.type === "epic"));
  const options: SelectOption[] = candidates.map((i) => ({ value: i.id, label: i.summary, icon: <IssueTypeIcon type={i.type} />, description: i.key, keywords: i.key }));
  return <Select value={value ?? null} options={options} onChange={(v) => onChange(v ?? undefined)} appearance={appearance} className={className} clearable placeholder="None" />;
}

/* ---------- Labels ---------- */
export function LabelsField({ value, onChange, appearance = "subtle", className, placeholder = "None" }: { value: string[]; onChange: (v: string[]) => void; appearance?: Appearance; className?: string; placeholder?: string }) {
  const issues = useStore((s) => s.issues);
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const ref = React.useRef<HTMLButtonElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const all = React.useMemo(() => Array.from(new Set(issues.flatMap((i) => i.labels))).sort(), [issues]);
  const suggestions = all.filter((l) => !value.includes(l) && l.toLowerCase().includes(q.trim().toLowerCase()));
  const canCreate = q.trim() && !all.includes(q.trim()) && !value.includes(q.trim());

  React.useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
    else setQ("");
  }, [open]);

  const add = (l: string) => {
    onChange([...value, l]);
    setQ("");
  };

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex min-h-8 w-full flex-wrap items-center gap-1 rounded-ds px-1.5 py-1 text-left text-sm",
          appearance === "default" && "border-2 border-ds-border-input bg-ds-input hover:bg-ds-surface-sunken",
          appearance !== "default" && "hover:bg-ds-neutral-subtle-hovered",
          open && "border-ds-border-focused bg-ds-neutral-subtle-hovered",
          className,
        )}
      >
        {value.length === 0 && <span className="text-ds-text-subtlest">{placeholder}</span>}
        {value.map((l) => (
          <span key={l} className="inline-flex h-5 items-center gap-0.5 rounded-[3px] bg-ds-neutral px-1.5 text-xs font-medium">
            {l}
            <X
              size={12}
              className="cursor-pointer text-ds-icon-subtle hover:text-ds-text"
              onClick={(e) => {
                e.stopPropagation();
                onChange(value.filter((x) => x !== l));
              }}
            />
          </span>
        ))}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={ref} className="w-64 py-1" matchWidth>
        <div className="px-2 pb-1 pt-1.5">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && q.trim()) {
                e.preventDefault();
                add(q.trim());
              }
            }}
            placeholder="Type a label"
            className="ds-input h-8 py-1 text-sm"
          />
        </div>
        <div className="max-h-56 overflow-y-auto py-1">
          {suggestions.map((l) => (
            <button key={l} type="button" onClick={() => add(l)} className="flex w-full items-center px-3 py-1.5 text-left text-sm hover:bg-ds-neutral-subtle-hovered">
              {l}
            </button>
          ))}
          {canCreate && (
            <button type="button" onClick={() => add(q.trim())} className="flex w-full items-center gap-1 px-3 py-1.5 text-left text-sm text-ds-link hover:bg-ds-neutral-subtle-hovered">
              <Plus size={14} /> Create &quot;{q.trim()}&quot;
            </button>
          )}
          {suggestions.length === 0 && !canCreate && <div className="px-3 py-2 text-sm text-ds-text-subtlest">Type to add a label</div>}
        </div>
      </Popover>
    </>
  );
}

/* ---------- Story points ---------- */
export function PointsBadge({ points, className }: { points?: number; className?: string }) {
  if (points === undefined || points === null) return null;
  return <Lozenge className={cn("rounded-full px-1.5 normal-case", className)}>{points}</Lozenge>;
}
