"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useStore, type CreateIssueInput } from "@/lib/store";
import type { IssuePriority, IssueStatus, IssueType } from "@/lib/types";
import { parseDuration } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/misc";
import { LabelsField, ParentSelect, PrioritySelect, ProjectSelect, SprintSelect, StatusSelect, TypeSelect, UserSelect } from "./fields";

function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-4">
      <label className="mb-1 block text-xs font-semibold text-ds-text-subtle">
        {label}
        {required && <span className="ml-0.5 text-ds-text-danger">*</span>}
      </label>
      {children}
      {hint && <div className="mt-1 text-xs text-ds-text-subtlest">{hint}</div>}
    </div>
  );
}

export function CreateIssueModal() {
  const open = useStore((s) => s.ui.createIssueOpen);
  const defaults = useStore((s) => s.ui.createIssueDefaults);
  const close = useStore((s) => s.closeCreateIssue);
  const createIssue = useStore((s) => s.createIssue);
  const projects = useStore((s) => s.projects);
  const recentProjects = useStore((s) => s.ui.recentProjectIds);
  const router = useRouter();

  const [projectId, setProjectId] = React.useState<string | undefined>();
  const [type, setType] = React.useState<IssueType>("task");
  const [status, setStatus] = React.useState<IssueStatus>("todo");
  const [summary, setSummary] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [assigneeId, setAssigneeId] = React.useState<string | undefined>();
  const [priority, setPriority] = React.useState<IssuePriority>("medium");
  const [labels, setLabels] = React.useState<string[]>([]);
  const [parentId, setParentId] = React.useState<string | undefined>();
  const [sprintId, setSprintId] = React.useState<string | undefined>();
  const [points, setPoints] = React.useState("");
  const [estimate, setEstimate] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [createAnother, setCreateAnother] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [created, setCreated] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const d = defaults ?? {};
    setProjectId(d.projectId ?? recentProjects[0] ?? projects[0]?.id);
    setType(d.type ?? "task");
    setStatus(d.status ?? "todo");
    setSummary(d.summary ?? "");
    setDescription(d.description ?? "");
    setAssigneeId(d.assigneeId);
    setPriority(d.priority ?? "medium");
    setLabels(d.labels ?? []);
    setParentId(d.parentId);
    setSprintId(d.sprintId);
    setPoints(d.storyPoints !== undefined ? String(d.storyPoints) : "");
    setEstimate("");
    setDueDate(d.dueDate ?? "");
    setError(null);
    setCreated(null);
  }, [open, defaults, projects, recentProjects]);

  const submit = () => {
    if (!projectId) return setError("Choose a project");
    if (!summary.trim()) return setError("Summary is required");
    const input: CreateIssueInput = {
      projectId,
      type,
      status,
      summary,
      description: description.trim() || undefined,
      assigneeId,
      priority,
      labels,
      parentId,
      sprintId,
      storyPoints: points ? Number(points) : undefined,
      originalEstimate: estimate ? parseDuration(estimate) : undefined,
      dueDate: dueDate || undefined,
    };
    const issue = createIssue(input);
    if (createAnother) {
      setSummary("");
      setDescription("");
      setCreated(issue.key);
      setError(null);
    } else {
      close();
      router.push(`/browse/${issue.key}`);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Create work item"
      width={640}
      footer={
        <>
          <Checkbox checked={createAnother} onChange={setCreateAnother} label="Create another" className="mr-auto" />
          <Button appearance="subtle" onClick={close}>
            Cancel
          </Button>
          <Button appearance="primary" onClick={submit}>
            Create
          </Button>
        </>
      }
    >
      {created && (
        <div className="mb-3 rounded-ds bg-ds-success px-3 py-2 text-sm text-ds-text-success">
          Work item <b>{created}</b> created.
        </div>
      )}
      <p className="mb-4 text-xs text-ds-text-subtlest">
        Required fields are marked with an asterisk <span className="text-ds-text-danger">*</span>
      </p>
      <div className="grid grid-cols-2 gap-x-4">
        <Field label="Project" required>
          <ProjectSelect
            value={projectId}
            onChange={(v) => {
              setProjectId(v);
              setSprintId(undefined);
              setParentId(undefined);
            }}
          />
        </Field>
        <Field label="Work type" required>
          <TypeSelect value={type} onChange={setType} />
        </Field>
      </div>
      <div className="mb-4 h-px bg-ds-border" />
      <Field label="Status">
        <StatusSelect value={status} onChange={setStatus} appearance="inline" />
      </Field>
      <Field label="Summary" required>
        <input
          autoFocus
          value={summary}
          onChange={(e) => {
            setSummary(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
          className="ds-input"
          placeholder="What needs to be done?"
        />
        {error && <div className="mt-1 text-xs text-ds-text-danger">{error}</div>}
      </Field>
      <Field label="Description">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} className="ds-input resize-y" placeholder="Add a description..." />
      </Field>
      <Field label="Assignee">
        <UserSelect value={assigneeId} onChange={setAssigneeId} appearance="default" showAssignToMe />
      </Field>
      <div className="grid grid-cols-2 gap-x-4">
        <Field label="Priority">
          <PrioritySelect value={priority} onChange={setPriority} appearance="default" />
        </Field>
        <Field label="Labels">
          <LabelsField value={labels} onChange={setLabels} appearance="default" placeholder="Select labels" />
        </Field>
      </div>
      {projectId && (
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Parent">
            <ParentSelect projectId={projectId} value={parentId} onChange={setParentId} appearance="default" type={type} />
          </Field>
          <Field label="Sprint">
            <SprintSelect projectId={projectId} value={sprintId} onChange={setSprintId} appearance="default" />
          </Field>
        </div>
      )}
      <div className="grid grid-cols-3 gap-x-4">
        <Field label="Story point estimate">
          <input value={points} onChange={(e) => setPoints(e.target.value.replace(/[^\d.]/g, ""))} className="ds-input" inputMode="decimal" />
        </Field>
        <Field label="Original estimate" hint="e.g. 2w 4d 6h 45m">
          <input value={estimate} onChange={(e) => setEstimate(e.target.value)} className="ds-input" placeholder="1h 30m" />
        </Field>
        <Field label="Due date">
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="ds-input" />
        </Field>
      </div>
    </Modal>
  );
}
