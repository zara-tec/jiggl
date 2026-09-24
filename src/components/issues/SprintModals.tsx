"use client";

import * as React from "react";
import { addDays, format, formatISO, parse } from "date-fns";
import { useStore } from "@/lib/store";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";

export function StartSprintModal({ open, onClose, sprintId }: { open: boolean; onClose: () => void; sprintId: string }) {
  const sprint = useStore((s) => s.sprints.find((sp) => sp.id === sprintId));
  const count = useStore((s) => s.issues.filter((i) => i.sprintId === sprintId).length);
  const startSprint = useStore((s) => s.startSprint);
  const [name, setName] = React.useState("");
  const [goal, setGoal] = React.useState("");
  const [duration, setDuration] = React.useState("2");
  const [startDate, setStartDate] = React.useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = React.useState(format(addDays(new Date(), 14), "yyyy-MM-dd"));

  React.useEffect(() => {
    if (open && sprint) {
      setName(sprint.name);
      setGoal(sprint.goal ?? "");
      setStartDate(format(new Date(), "yyyy-MM-dd"));
      setEndDate(format(addDays(new Date(), 14), "yyyy-MM-dd"));
      setDuration("2");
    }
  }, [open, sprint]);

  React.useEffect(() => {
    if (duration === "custom") return;
    const d = parse(startDate, "yyyy-MM-dd", new Date());
    setEndDate(format(addDays(d, Number(duration) * 7), "yyyy-MM-dd"));
  }, [duration, startDate]);

  if (!sprint) return null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Start sprint`}
      width={520}
      footer={
        <>
          <Button appearance="subtle" onClick={onClose}>Cancel</Button>
          <Button
            appearance="primary"
            disabled={!name.trim()}
            onClick={() => {
              startSprint(sprintId, {
                name: name.trim(),
                goal: goal.trim() || undefined,
                startDate: formatISO(parse(startDate, "yyyy-MM-dd", new Date())),
                endDate: formatISO(parse(endDate, "yyyy-MM-dd", new Date())),
              });
              onClose();
            }}
          >
            Start
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-ds-text-subtle">
        <b>{count}</b> work item{count === 1 ? "" : "s"} will be included in this sprint.
      </p>
      <label className="mb-4 block">
        <span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Sprint name *</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className="ds-input" />
      </label>
      <label className="mb-4 block">
        <span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Duration</span>
        <Select
          value={duration}
          onChange={(v) => v && setDuration(v)}
          searchable={false}
          options={[
            { value: "1", label: "1 week" },
            { value: "2", label: "2 weeks" },
            { value: "3", label: "3 weeks" },
            { value: "4", label: "4 weeks" },
            { value: "custom", label: "Custom" },
          ]}
        />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Start date</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="ds-input" />
        </label>
        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-semibold text-ds-text-subtle">End date</span>
          <input type="date" value={endDate} disabled={duration !== "custom"} onChange={(e) => setEndDate(e.target.value)} className="ds-input disabled:bg-ds-surface-sunken disabled:text-ds-text-subtlest" />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Sprint goal</span>
        <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={3} className="ds-input resize-y" />
      </label>
    </Modal>
  );
}

export function CompleteSprintModal({ open, onClose, sprintId }: { open: boolean; onClose: () => void; sprintId: string }) {
  const sprint = useStore((s) => s.sprints.find((sp) => sp.id === sprintId));
  const sprints = useStore((s) => s.sprints);
  const allIssues = useStore((s) => s.issues);
  const issues = React.useMemo(() => allIssues.filter((i) => i.sprintId === sprintId), [allIssues, sprintId]);
  const complete = useStore((s) => s.completeSprint);
  const [moveTo, setMoveTo] = React.useState<string>("new");
  const done = issues.filter((i) => i.status === "done").length;
  const open_ = issues.length - done;
  if (!sprint) return null;
  const future = sprints.filter((sp) => sp.projectId === sprint.projectId && sp.state === "future");
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Complete ${sprint.name}`}
      width={480}
      footer={
        <>
          <Button appearance="subtle" onClick={onClose}>Cancel</Button>
          <Button
            appearance="primary"
            onClick={() => {
              complete(sprintId, moveTo as "new" | "backlog" | string);
              onClose();
            }}
          >
            Complete sprint
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm">This sprint contains:</p>
      <ul className="mb-4 list-disc pl-5 text-sm text-ds-text-subtle">
        <li><b className="text-ds-text">{done}</b> completed work item{done === 1 ? "" : "s"}</li>
        <li><b className="text-ds-text">{open_}</b> open work item{open_ === 1 ? "" : "s"}</li>
      </ul>
      {open_ > 0 && (
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Move open work items to</span>
          <Select
            value={moveTo}
            onChange={(v) => v && setMoveTo(v)}
            searchable={false}
            options={[
              { value: "new", label: "New sprint" },
              ...future.map((sp) => ({ value: sp.id, label: sp.name })),
              { value: "backlog", label: "Backlog" },
            ]}
          />
        </label>
      )}
    </Modal>
  );
}

export function EditSprintModal({ open, onClose, sprintId }: { open: boolean; onClose: () => void; sprintId: string }) {
  const sprint = useStore((s) => s.sprints.find((sp) => sp.id === sprintId));
  const update = useStore((s) => s.updateSprint);
  const [name, setName] = React.useState("");
  const [goal, setGoal] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  React.useEffect(() => {
    if (open && sprint) {
      setName(sprint.name);
      setGoal(sprint.goal ?? "");
      setStartDate(sprint.startDate ? format(new Date(sprint.startDate), "yyyy-MM-dd") : "");
      setEndDate(sprint.endDate ? format(new Date(sprint.endDate), "yyyy-MM-dd") : "");
    }
  }, [open, sprint]);
  if (!sprint) return null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit sprint"
      width={480}
      footer={
        <>
          <Button appearance="subtle" onClick={onClose}>Cancel</Button>
          <Button
            appearance="primary"
            disabled={!name.trim()}
            onClick={() => {
              update(sprintId, {
                name: name.trim(),
                goal: goal.trim() || undefined,
                startDate: startDate ? formatISO(parse(startDate, "yyyy-MM-dd", new Date())) : undefined,
                endDate: endDate ? formatISO(parse(endDate, "yyyy-MM-dd", new Date())) : undefined,
              });
              onClose();
            }}
          >
            Update
          </Button>
        </>
      }
    >
      <label className="mb-4 block">
        <span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Sprint name *</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className="ds-input" />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Start date</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="ds-input" />
        </label>
        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-semibold text-ds-text-subtle">End date</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="ds-input" />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Sprint goal</span>
        <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={3} className="ds-input resize-y" />
      </label>
    </Modal>
  );
}
