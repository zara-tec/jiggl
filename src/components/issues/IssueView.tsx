"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, formatISO, parse, parseISO } from "date-fns";
import { ChevronDown, ChevronUp, Clock, Eye, Link2, Maximize2, MoreHorizontal, Paperclip, Play, Plus, Square, Star, Trash2, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useIssue, useIssueEntries, useProject, useRunningEntry, totalSeconds } from "@/hooks/useData";
import { useNow } from "@/hooks/useHydrated";
import type { Issue } from "@/lib/types";
import { cn, formatDurationShort, parseDuration, relativeTime } from "@/lib/utils";
import { Avatar, ProjectAvatar } from "@/components/ui/Avatar";
import { Button, IconButton } from "@/components/ui/Button";
import { DropdownMenu, MenuItem } from "@/components/ui/Popover";
import { Modal } from "@/components/ui/Modal";
import { InlineEdit, ProgressBar, Tabs, Toggle } from "@/components/ui/misc";
import { IssueTypeIcon, StatusLozenge } from "./icons";
import { LabelsField, ParentSelect, PrioritySelect, SprintSelect, StatusButton, StatusSelect, UserSelect } from "./fields";
import { TimeEntriesList } from "@/components/time/TimeEntriesList";
import { lineAmount } from "@/lib/offers";
import { formatMoney } from "@/lib/rates";

/* ---------- Modal wrapper (board / backlog) ---------- */
export function IssueModal({ issueId, onClose }: { issueId: string | null; onClose: () => void }) {
  const issue = useIssue(issueId ?? undefined);
  return (
    <Modal open={!!issueId && !!issue} onClose={onClose} width={1100} bodyClassName="px-0 py-0" className="max-h-[90vh]">
      {issue && <IssueView issueId={issue.id} variant="modal" onClose={onClose} />}
    </Modal>
  );
}

/* ---------- Full issue view ---------- */
export function IssueView({ issueId, variant, onClose }: { issueId: string; variant: "page" | "modal"; onClose?: () => void }) {
  const issue = useIssue(issueId)!;
  const project = useProject(issue.projectId)!;
  const parent = useIssue(issue.parentId);
  const allIssues = useStore((s) => s.issues);
  const children = React.useMemo(() => allIssues.filter((i) => i.parentId === issue.id).sort((a, b) => a.rank - b.rank), [allIssues, issue.id]);
  const users = useStore((s) => s.users);
  const me = useStore((s) => s.currentUserId);
  const update = useStore((s) => s.updateIssue);
  const remove = useStore((s) => s.deleteIssue);
  const createIssue = useStore((s) => s.createIssue);
  const addComment = useStore((s) => s.addComment);
  const deleteComment = useStore((s) => s.deleteComment);
  const touch = useStore((s) => s.touchRecentIssue);
  const starred = useStore((s) => s.ui.starredIssueIds.includes(issue.id));
  const toggleStar = useStore((s) => s.toggleStarIssue);
  const start = useStore((s) => s.startTimer);
  const stop = useStore((s) => s.stopTimer);
  const running = useRunningEntry();
  const entries = useIssueEntries(issue.id);
  const offer = useStore((s) => (issue.offerId ? s.offers.find((o) => o.id === issue.offerId) : undefined));
  const offerLine = offer?.lines.find((l) => l.id === issue.offerLineId);
  const currency = useStore((s) => s.settings.currency);
  const now = useNow(1000, entries.some((e) => !e.stop));
  const logged = totalSeconds(entries, now);
  const router = useRouter();

  const [comment, setComment] = React.useState("");
  const [commentFocus, setCommentFocus] = React.useState(false);
  const [detailsOpen, setDetailsOpen] = React.useState(true);
  const [logOpen, setLogOpen] = React.useState(false);
  const [childText, setChildText] = React.useState("");
  const [childOpen, setChildOpen] = React.useState(false);
  const [activityTab, setActivityTab] = React.useState("comments");

  React.useEffect(() => {
    touch(issue.id);
  }, [issue.id, touch]);

  const isRunningHere = running?.issueId === issue.id;
  const estimate = issue.originalEstimate ?? 0;
  const remaining = Math.max(0, estimate - logged);

  const onDelete = () => {
    if (!confirm(`Delete ${issue.key}? This cannot be undone.`)) return;
    remove(issue.id);
    if (variant === "modal") onClose?.();
    else router.push(`/projects/${project.key}/board`);
  };

  return (
    <div className={cn("flex min-h-0 flex-col", variant === "modal" ? "max-h-[90vh]" : "flex-1")}>
      {/* Header */}
      <div className={cn("flex shrink-0 items-center justify-between gap-4 px-8 pt-5", variant === "modal" && "px-6 pt-4")}>
        <nav className="flex min-w-0 items-center gap-1 text-sm text-ds-text-subtle">
          <Link href={`/projects/${project.key}/board`} className="flex items-center gap-1.5 rounded-ds px-1 hover:bg-ds-neutral-subtle-hovered hover:text-ds-link">
            <ProjectAvatar name={project.name} color={project.color} size={16} /> {project.name}
          </Link>
          {parent && (
            <>
              <span className="text-ds-text-subtlest">/</span>
              <Link href={`/browse/${parent.key}`} className="flex items-center gap-1.5 rounded-ds px-1 hover:bg-ds-neutral-subtle-hovered hover:text-ds-link">
                <IssueTypeIcon type={parent.type} size={16} /> {parent.key}
              </Link>
            </>
          )}
          <span className="text-ds-text-subtlest">/</span>
          <span className="flex items-center gap-1.5 px-1">
            <IssueTypeIcon type={issue.type} size={16} /> {issue.key}
          </span>
        </nav>
        <div className="flex shrink-0 items-center gap-1">
          <IconButton icon={<Star className={starred ? "fill-ds-star text-ds-star" : ""} />} label={starred ? "Unstar" : "Star"} onClick={() => toggleStar(issue.id)} />
          <Button appearance="subtle" iconBefore={<Eye />} title="Watchers">
            {issue.watchers.length}
          </Button>
          <DropdownMenu align="end" trigger={({ ref, toggle }) => <IconButton ref={ref} icon={<MoreHorizontal />} label="Actions" onClick={toggle} />}>
            {({ close }) => (
              <>
                <MenuItem icon={<Link2 />} onClick={() => { navigator.clipboard?.writeText(`${location.origin}/browse/${issue.key}`); close(); }}>
                  Copy link
                </MenuItem>
                <MenuItem icon={<Trash2 />} className="text-ds-text-danger" onClick={() => { close(); onDelete(); }}>
                  Delete
                </MenuItem>
              </>
            )}
          </DropdownMenu>
          {variant === "modal" && (
            <>
              <Link href={`/browse/${issue.key}`} onClick={onClose}>
                <IconButton icon={<Maximize2 />} label="Open in full page" />
              </Link>
              <IconButton icon={<X />} label="Close" onClick={onClose} />
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div className={cn("flex min-h-0 flex-1 gap-8 overflow-y-auto px-8 pb-10 pt-3", variant === "modal" && "px-6")}>
        <div className="min-w-0 flex-1">
          <InlineEdit as="h1" value={issue.summary} onSave={(v) => v && update(issue.id, { summary: v })} className="ds-heading-xl -mx-1.5 px-1.5 py-1" inputClassName="ds-heading-xl py-1" />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <DropdownMenu
              trigger={({ ref, toggle }) => (
                <Button ref={ref} onClick={toggle} iconBefore={<Plus />} iconAfter={<ChevronDown />}>
                  Add
                </Button>
              )}
            >
              {({ close }) => (
                <>
                  <MenuItem icon={<Paperclip />} isDisabled>
                    Attachment
                  </MenuItem>
                  {issue.type !== "subtask" && (
                    <MenuItem icon={<IssueTypeIcon type="subtask" size={14} />} onClick={() => { setChildOpen(true); close(); }}>
                      Child work item
                    </MenuItem>
                  )}
                  <MenuItem icon={<Link2 />} isDisabled>
                    Linked work item
                  </MenuItem>
                </>
              )}
            </DropdownMenu>
            <Button iconBefore={<Clock />} onClick={() => setLogOpen(true)}>
              Log work
            </Button>
            {isRunningHere ? (
              <Button appearance="danger" iconBefore={<Square fill="currentColor" />} onClick={stop}>
                Stop timer
              </Button>
            ) : (
              <Button appearance="primary" iconBefore={<Play fill="currentColor" />} onClick={() => start({ description: issue.summary, projectId: issue.projectId, issueId: issue.id, tagIds: [], billable: project.billable })}>
                Start timer
              </Button>
            )}
          </div>

          <section className="mt-6">
            <h3 className="ds-heading-sm mb-2">Description</h3>
            <InlineEdit value={issue.description ?? ""} onSave={(v) => update(issue.id, { description: v || undefined })} placeholder="Add a description..." multiline className="-mx-1.5 min-h-8 px-1.5 py-1 text-sm leading-5" />
          </section>

          {issue.type !== "subtask" && (children.length > 0 || childOpen) && (
            <section className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="ds-heading-sm">Child work items</h3>
                <IconButton icon={<Plus />} label="Create child work item" spacing="compact" onClick={() => setChildOpen(true)} />
              </div>
              {children.length > 0 && (
                <ProgressBar
                  className="mb-2"
                  segments={[
                    { value: children.filter((c) => c.status === "done").length, color: "var(--ds-chart-green)", label: "Done" },
                    { value: children.filter((c) => c.status === "inprogress" || c.status === "inreview").length, color: "var(--ds-chart-blue)", label: "In progress" },
                    { value: children.filter((c) => c.status === "todo").length, color: "var(--ds-chart-track)", label: "To do" },
                  ]}
                />
              )}
              <div className="divide-y divide-ds-border rounded-ds border border-ds-border">
                {children.map((c) => (
                  <ChildRow key={c.id} child={c} />
                ))}
                {childOpen && (
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    <IssueTypeIcon type={issue.type === "epic" ? "story" : "subtask"} size={14} />
                    <input
                      autoFocus
                      value={childText}
                      onChange={(e) => setChildText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && childText.trim()) {
                          createIssue({ projectId: issue.projectId, type: issue.type === "epic" ? "story" : "subtask", summary: childText.trim(), parentId: issue.id, sprintId: issue.type === "epic" ? undefined : issue.sprintId });
                          setChildText("");
                        }
                        if (e.key === "Escape") { setChildOpen(false); setChildText(""); }
                      }}
                      placeholder="What needs to be done?"
                      className="h-8 flex-1 rounded-ds border-2 border-ds-border-focused px-2 text-sm outline-none"
                    />
                    <Button appearance="subtle" spacing="compact" onClick={() => { setChildOpen(false); setChildText(""); }}>
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="ds-heading-sm">
                Time tracking <span className="ml-1 text-xs font-normal text-ds-text-subtlest">{entries.length} entr{entries.length === 1 ? "y" : "ies"} · {formatDurationShort(logged)} logged</span>
              </h3>
            </div>
            <TimeEntriesList entries={entries.slice(0, 20)} showUser emptyText="No time logged on this work item yet. Start the timer or log work." />
          </section>

          <section className="mt-8">
            <h3 className="ds-heading-sm mb-2">Activity</h3>
            <div className="mb-3 flex items-center gap-2 text-sm">
              <span className="text-ds-text-subtle">Show:</span>
              <Tabs
                value={activityTab}
                onChange={setActivityTab}
                className="border-b-0"
                tabs={[
                  { id: "comments", label: "Comments" },
                  { id: "history", label: "History" },
                ]}
              />
            </div>
            {activityTab === "comments" ? (
              <>
                <div className="flex gap-3">
                  <Avatar user={users.find((u) => u.id === me)} size="md" />
                  <div className="flex-1">
                    <textarea
                      value={comment}
                      onFocus={() => setCommentFocus(true)}
                      onChange={(e) => setComment(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && comment.trim()) {
                          addComment(issue.id, comment.trim());
                          setComment("");
                          setCommentFocus(false);
                        }
                      }}
                      rows={commentFocus ? 3 : 1}
                      placeholder="Add a comment..."
                      className="ds-input resize-y"
                    />
                    {commentFocus && (
                      <div className="mt-2 flex items-center gap-2">
                        <Button
                          appearance="primary"
                          disabled={!comment.trim()}
                          onClick={() => {
                            addComment(issue.id, comment.trim());
                            setComment("");
                            setCommentFocus(false);
                          }}
                        >
                          Save
                        </Button>
                        <Button appearance="subtle" onClick={() => { setComment(""); setCommentFocus(false); }}>
                          Cancel
                        </Button>
                        <span className="ml-auto text-xs text-ds-text-subtlest">Pro tip: press Ctrl+Enter to comment</span>
                      </div>
                    )}
                  </div>
                </div>
                <ul className="mt-4 space-y-4">
                  {[...issue.comments].reverse().map((c) => {
                    const author = users.find((u) => u.id === c.authorId);
                    return (
                      <li key={c.id} className="flex gap-3">
                        <Avatar user={author} size="md" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-semibold">{author?.name ?? "Unknown"}</span>
                            <span className="text-xs text-ds-text-subtlest">{relativeTime(c.createdAt)}</span>
                          </div>
                          <p className="mt-0.5 whitespace-pre-wrap text-sm">{c.body}</p>
                          {c.authorId === me && (
                            <button type="button" onClick={() => deleteComment(issue.id, c.id)} className="mt-1 text-xs text-ds-text-subtle hover:underline">
                              Delete
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <ul className="space-y-2 text-sm text-ds-text-subtle">
                <li>
                  <b className="text-ds-text">{users.find((u) => u.id === issue.reporterId)?.name}</b> created the work item · {relativeTime(issue.createdAt)}
                </li>
                <li>Last updated {relativeTime(issue.updatedAt)}</li>
                {issue.resolvedAt && <li>Resolved {relativeTime(issue.resolvedAt)}</li>}
              </ul>
            )}
          </section>
        </div>

        {/* Right column */}
        <aside className="w-80 shrink-0">
          <div className="mb-3 flex items-center gap-2">
            <StatusButton value={issue.status} onChange={(v) => update(issue.id, { status: v })} />
          </div>
          <div className="rounded-ds border border-ds-border">
            <button type="button" onClick={() => setDetailsOpen((o) => !o)} className="flex h-10 w-full items-center justify-between px-3 text-sm font-semibold">
              Details
              {detailsOpen ? <ChevronUp size={16} className="text-ds-icon" /> : <ChevronDown size={16} className="text-ds-icon" />}
            </button>
            {detailsOpen && (
              <div className="space-y-1 border-t border-ds-border px-3 py-3">
                <DetailRow label="Assignee">
                  <UserSelect value={issue.assigneeId} onChange={(v) => update(issue.id, { assigneeId: v })} showAssignToMe />
                </DetailRow>
                <DetailRow label="Labels">
                  <LabelsField value={issue.labels} onChange={(v) => update(issue.id, { labels: v })} />
                </DetailRow>
                {issue.type !== "epic" && (
                  <DetailRow label="Parent">
                    <ParentSelect projectId={issue.projectId} value={issue.parentId} onChange={(v) => update(issue.id, { parentId: v })} type={issue.type} />
                  </DetailRow>
                )}
                {project.type === "software" && issue.type !== "epic" && (
                  <DetailRow label="Sprint">
                    <SprintSelect projectId={issue.projectId} value={issue.sprintId} onChange={(v) => update(issue.id, { sprintId: v })} />
                  </DetailRow>
                )}
                <DetailRow label="Story points">
                  <NumberField value={issue.storyPoints} onChange={(v) => update(issue.id, { storyPoints: v })} />
                </DetailRow>
                <DetailRow label="Priority">
                  <PrioritySelect value={issue.priority} onChange={(v) => update(issue.id, { priority: v })} />
                </DetailRow>
                <DetailRow label="Due date">
                  <DateField value={issue.dueDate} onChange={(v) => update(issue.id, { dueDate: v })} />
                </DetailRow>
                <DetailRow label="Start date">
                  <DateField value={issue.startDate} onChange={(v) => update(issue.id, { startDate: v })} />
                </DetailRow>
                <DetailRow label="Reporter">
                  <UserSelect value={issue.reporterId} onChange={(v) => v && update(issue.id, { reporterId: v })} placeholder="Unknown" />
                </DetailRow>
                <DetailRow label="Time tracking">
                  <div className="px-1.5 py-1">
                    <ProgressBar
                      segments={[
                        { value: logged, color: isRunningHere ? "var(--ds-chart-red)" : "var(--ds-chart-blue)", label: "Logged" },
                        { value: estimate > logged ? remaining : 0, color: "var(--ds-chart-track)", label: "Remaining" },
                      ]}
                    />
                    <div className="mt-1 flex justify-between text-xs text-ds-text-subtle">
                      <span>{formatDurationShort(logged)} logged</span>
                      <span>{estimate ? `${formatDurationShort(remaining)} remaining` : "No estimate"}</span>
                    </div>
                  </div>
                </DetailRow>
                <DetailRow label="Original estimate">
                  <DurationField value={issue.originalEstimate} onChange={(v) => update(issue.id, { originalEstimate: v })} />
                </DetailRow>
                {offer && offerLine && (
                  <DetailRow label="Offer">
                    <Link href={`/projects/${project.key}/offers/${offer.id}`} className="block px-1.5 py-1.5 text-sm hover:underline">
                      <span className="font-medium text-ds-link">{offer.number}</span>
                      <span className="block text-xs text-ds-text-subtlest">Sold {offerLine.hours}h · {formatMoney(lineAmount(offerLine), currency)}</span>
                    </Link>
                  </DetailRow>
                )}
              </div>
            )}
          </div>
          <div className="mt-3 space-y-0.5 px-1 text-xs text-ds-text-subtlest">
            <div>Created {relativeTime(issue.createdAt)}</div>
            <div>Updated {relativeTime(issue.updatedAt)}</div>
            {issue.resolvedAt && <div>Resolved {relativeTime(issue.resolvedAt)}</div>}
          </div>
        </aside>
      </div>

      <LogWorkModal open={logOpen} onClose={() => setLogOpen(false)} issue={issue} />
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[112px_1fr] items-start gap-2">
      <div className="pt-2 text-xs font-semibold text-ds-text-subtle">{label}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function ChildRow({ child }: { child: Issue }) {
  const update = useStore((s) => s.updateIssue);
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-ds-surface-hovered">
      <IssueTypeIcon type={child.type} size={14} />
      <Link href={`/browse/${child.key}`} className="shrink-0 text-xs text-ds-text-subtle hover:underline">
        {child.key}
      </Link>
      <Link href={`/browse/${child.key}`} className={cn("min-w-0 flex-1 truncate text-sm hover:underline", child.status === "done" && "text-ds-text-subtlest line-through")}>
        {child.summary}
      </Link>
      <UserSelect value={child.assigneeId} onChange={(v) => update(child.id, { assigneeId: v })} avatarOnly className="w-auto" />
      <StatusSelect value={child.status} onChange={(v) => update(child.id, { status: v })} compact />
    </div>
  );
}

function NumberField({ value, onChange }: { value?: number; onChange: (v: number | undefined) => void }) {
  const [text, setText] = React.useState(value !== undefined ? String(value) : "");
  React.useEffect(() => setText(value !== undefined ? String(value) : ""), [value]);
  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value.replace(/[^\d.]/g, ""))}
      onBlur={() => onChange(text ? Number(text) : undefined)}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      placeholder="None"
      className="ds-inline-edit h-8 w-full bg-transparent px-1.5 text-sm outline-none placeholder:text-ds-text-subtlest"
    />
  );
}

function DateField({ value, onChange }: { value?: string; onChange: (v: string | undefined) => void }) {
  const v = value ? format(parseISO(value), "yyyy-MM-dd") : "";
  return (
    <input
      type="date"
      value={v}
      onChange={(e) => onChange(e.target.value ? formatISO(parse(e.target.value, "yyyy-MM-dd", new Date())) : undefined)}
      className={cn("ds-inline-edit h-8 w-full bg-transparent px-1.5 text-sm outline-none", !v && "text-ds-text-subtlest")}
    />
  );
}

function DurationField({ value, onChange }: { value?: number; onChange: (v: number | undefined) => void }) {
  const [text, setText] = React.useState(value ? formatDurationShort(value) : "");
  React.useEffect(() => setText(value ? formatDurationShort(value) : ""), [value]);
  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onChange(text.trim() ? parseDuration(text) : undefined)}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      placeholder="e.g. 2h 30m"
      className="ds-inline-edit h-8 w-full bg-transparent px-1.5 text-sm outline-none placeholder:text-ds-text-subtlest"
    />
  );
}

/* ---------- Log work modal (creates a time entry on the work item) ---------- */
export function LogWorkModal({ open, onClose, issue }: { open: boolean; onClose: () => void; issue: Issue }) {
  const add = useStore((s) => s.addTimeEntry);
  const project = useProject(issue.projectId);
  const [spent, setSpent] = React.useState("1h");
  const [started, setStarted] = React.useState(() => format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [desc, setDesc] = React.useState("");
  const [billable, setBillable] = React.useState(project?.billable ?? false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setSpent("1h");
      setStarted(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
      setDesc("");
      setBillable(project?.billable ?? false);
      setError(null);
    }
  }, [open, project?.billable]);

  const submit = () => {
    const secs = parseDuration(spent);
    if (!secs) return setError("Enter a valid duration, e.g. 1h 30m");
    const startAt = new Date(started);
    if (isNaN(startAt.getTime())) return setError("Enter a valid start date");
    add({ description: desc.trim() || issue.summary, projectId: issue.projectId, issueId: issue.id, tagIds: [], billable, start: formatISO(startAt), stop: formatISO(new Date(startAt.getTime() + secs * 1000)) });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log work"
      width={480}
      footer={
        <>
          <Button appearance="subtle" onClick={onClose}>Cancel</Button>
          <Button appearance="primary" onClick={submit}>Log</Button>
        </>
      }
    >
      <div className="mb-3 flex items-center gap-2 text-sm text-ds-text-subtle">
        <IssueTypeIcon type={issue.type} size={14} /> {issue.key} <span className="truncate text-ds-text">{issue.summary}</span> <StatusLozenge status={issue.status} />
      </div>
      <label className="mb-4 block">
        <span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Time spent *</span>
        <input autoFocus value={spent} onChange={(e) => setSpent(e.target.value)} className="ds-input" placeholder="2h 30m" />
        <span className="mt-1 block text-xs text-ds-text-subtlest">Use the format: 2w 4d 6h 45m</span>
      </label>
      <label className="mb-4 block">
        <span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Date started *</span>
        <input type="datetime-local" value={started} onChange={(e) => setStarted(e.target.value)} className="ds-input" />
      </label>
      <label className="mb-4 block">
        <span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Work description</span>
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} className="ds-input resize-y" placeholder={issue.summary} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Toggle checked={billable} onChange={setBillable} /> Billable
      </label>
      {error && <div className="mt-3 text-xs text-ds-text-danger">{error}</div>}
    </Modal>
  );
}
