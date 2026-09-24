"use client";

import * as React from "react";
import { Check, DollarSign, FolderPlus, Plus, Search, Tag as TagIcon, X } from "lucide-react";
import { useStore } from "@/lib/store";
import type { ID } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Popover } from "@/components/ui/Popover";
import { IssueTypeIcon } from "@/components/issues/icons";

/* ---------- Project + work item picker ---------- */
export function ProjectIssuePicker({
  projectId,
  issueId,
  onChange,
  className,
  compact,
  align = "start",
}: {
  projectId?: ID;
  issueId?: ID;
  onChange: (v: { projectId?: ID; issueId?: ID }) => void;
  className?: string;
  compact?: boolean;
  align?: "start" | "end";
}) {
  const projects = useStore((s) => s.projects);
  const issues = useStore((s) => s.issues);
  const clients = useStore((s) => s.clients);
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const ref = React.useRef<HTMLButtonElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const project = projects.find((p) => p.id === projectId);
  const issue = issues.find((i) => i.id === issueId);
  const client = clients.find((c) => c.id === project?.clientId);

  React.useEffect(() => {
    if (open) {
      setQ("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const query = q.trim().toLowerCase();
  const projectResults = projects.filter((p) => !p.archived && (!query || p.name.toLowerCase().includes(query) || p.key.toLowerCase().includes(query)));
  const issueResults = issues
    .filter((i) => i.type !== "epic" && i.status !== "done")
    .filter((i) => (query ? i.key.toLowerCase().includes(query) || i.summary.toLowerCase().includes(query) : projectId ? i.projectId === projectId : true))
    .slice(0, query ? 12 : 8);

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={project ? `${project.name}${issue ? ` · ${issue.key}` : ""}` : "Select project"}
        className={cn(
          "inline-flex h-8 max-w-[260px] items-center gap-1.5 rounded-ds px-2 text-sm font-medium hover:bg-ds-neutral-subtle-hovered",
          open && "bg-ds-neutral-subtle-hovered",
          !project && "text-ds-text-subtle",
          compact && "h-6 px-1 text-xs",
          className,
        )}
      >
        {project ? (
          <>
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: project.color }} />
            <span className="truncate" style={{ color: project.color }}>
              {project.name}
            </span>
            {client && !compact && <span className="truncate text-ds-text-subtlest">· {client.name}</span>}
            {issue && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-[3px] bg-ds-neutral px-1 text-[11px] font-semibold text-ds-text-subtle">
                <IssueTypeIcon type={issue.type} size={12} /> {issue.key}
              </span>
            )}
          </>
        ) : (
          <>
            <FolderPlus size={16} className="shrink-0 text-ds-icon" />
            <span>Project</span>
          </>
        )}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={ref} align={align} className="w-[380px] py-1">
        <div className="relative px-2 pb-1 pt-1.5">
          <Search size={14} className="pointer-events-none absolute left-4 top-[15px] text-ds-icon-subtle" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects or work items" className="ds-input h-8 py-1 pl-7 text-sm" />
        </div>
        <div className="max-h-80 overflow-y-auto pb-1">
          {(projectId || issueId) && !query && (
            <button
              type="button"
              onClick={() => {
                onChange({ projectId: undefined, issueId: undefined });
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-ds-text-subtle hover:bg-ds-neutral-subtle-hovered"
            >
              <X size={14} /> No project
            </button>
          )}
          <div className="ds-heading-xxs px-3 pb-1 pt-2 text-ds-text-subtlest">Projects</div>
          {projectResults.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onChange({ projectId: p.id, issueId: undefined });
                setOpen(false);
              }}
              className={cn("flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-ds-neutral-subtle-hovered", p.id === projectId && !issueId && "bg-ds-selected")}
            >
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
              <span className="truncate font-medium" style={{ color: p.color }}>
                {p.name}
              </span>
              <span className="truncate text-xs text-ds-text-subtlest">{clients.find((c) => c.id === p.clientId)?.name ?? "No client"}</span>
              {p.id === projectId && !issueId && <Check size={14} className="ml-auto text-ds-icon-brand" />}
            </button>
          ))}
          {projectResults.length === 0 && <div className="px-3 py-1.5 text-sm text-ds-text-subtlest">No projects</div>}
          <div className="ds-heading-xxs px-3 pb-1 pt-2 text-ds-text-subtlest">Work items</div>
          {issueResults.map((i) => {
            const p = projects.find((x) => x.id === i.projectId);
            return (
              <button
                key={i.id}
                type="button"
                onClick={() => {
                  onChange({ projectId: i.projectId, issueId: i.id });
                  setOpen(false);
                }}
                className={cn("flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-ds-neutral-subtle-hovered", i.id === issueId && "bg-ds-selected")}
              >
                <IssueTypeIcon type={i.type} size={14} />
                <span className="shrink-0 text-xs text-ds-text-subtlest">{i.key}</span>
                <span className="truncate">{i.summary}</span>
                {p && <span className="ml-auto size-2 shrink-0 rounded-full" style={{ background: p.color }} />}
              </button>
            );
          })}
          {issueResults.length === 0 && <div className="px-3 py-1.5 text-sm text-ds-text-subtlest">No work items</div>}
        </div>
      </Popover>
    </>
  );
}

/* ---------- Tags picker ---------- */
export function TagsPicker({ value, onChange, className, compact, showNames = true }: { value: ID[]; onChange: (v: ID[]) => void; className?: string; compact?: boolean; showNames?: boolean }) {
  const tags = useStore((s) => s.tags);
  const createTag = useStore((s) => s.createTag);
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const ref = React.useRef<HTMLButtonElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const selected = tags.filter((t) => value.includes(t.id));

  React.useEffect(() => {
    if (open) {
      setQ("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const filtered = tags.filter((t) => t.name.toLowerCase().includes(q.trim().toLowerCase()));
  const canCreate = q.trim() && !tags.some((t) => t.name.toLowerCase() === q.trim().toLowerCase());
  const toggleTag = (id: ID) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={selected.length ? selected.map((t) => t.name).join(", ") : "Add tags"}
        className={cn(
          "inline-flex h-8 max-w-[200px] items-center gap-1.5 rounded-ds px-2 text-sm hover:bg-ds-neutral-subtle-hovered",
          open && "bg-ds-neutral-subtle-hovered",
          compact && "h-6 px-1 text-xs",
          !showNames && "w-8 justify-center px-0",
          className,
        )}
      >
        <TagIcon size={16} className={cn("shrink-0", selected.length ? "text-ds-icon-brand" : "text-ds-icon")} />
        {showNames && selected.length > 0 && <span className="truncate text-ds-text-subtle">{selected.map((t) => t.name).join(", ")}</span>}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={ref} className="w-64 py-1">
        <div className="px-2 pb-1 pt-1.5">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canCreate) {
                const t = createTag(q.trim());
                onChange([...value, t.id]);
                setQ("");
              }
            }}
            placeholder="Add or find tags"
            className="ds-input h-8 py-1 text-sm"
          />
        </div>
        <div className="max-h-60 overflow-y-auto py-1">
          {filtered.map((t) => {
            const on = value.includes(t.id);
            return (
              <button key={t.id} type="button" onClick={() => toggleTag(t.id)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-ds-neutral-subtle-hovered">
                <span className={cn("inline-flex size-4 items-center justify-center rounded-[3px] border", on ? "border-ds-brand-bold bg-ds-brand-bold text-ds-text-on-brand" : "border-ds-border-input")}>{on && <Check size={12} />}</span>
                {t.name}
              </button>
            );
          })}
          {canCreate && (
            <button
              type="button"
              onClick={() => {
                const t = createTag(q.trim());
                onChange([...value, t.id]);
                setQ("");
              }}
              className="flex w-full items-center gap-1 px-3 py-1.5 text-left text-sm text-ds-link hover:bg-ds-neutral-subtle-hovered"
            >
              <Plus size={14} /> Create tag &quot;{q.trim()}&quot;
            </button>
          )}
          {filtered.length === 0 && !canCreate && <div className="px-3 py-2 text-sm text-ds-text-subtlest">No tags</div>}
        </div>
      </Popover>
    </>
  );
}

/* ---------- Billable toggle ---------- */
export function BillableToggle({ value, onChange, className, compact }: { value: boolean; onChange: (v: boolean) => void; className?: string; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      title={value ? "Billable" : "Non-billable"}
      className={cn(
        "inline-flex items-center justify-center rounded-ds hover:bg-ds-neutral-subtle-hovered",
        compact ? "size-6" : "size-8",
        value ? "text-ds-text-success" : "text-ds-icon-subtle",
        className,
      )}
    >
      <DollarSign size={compact ? 14 : 16} strokeWidth={value ? 2.75 : 2} />
    </button>
  );
}
