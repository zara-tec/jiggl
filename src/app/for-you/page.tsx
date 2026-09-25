"use client";

import * as React from "react";
import Link from "next/link";
import { format, isToday, isYesterday, parseISO, subDays, startOfDay, isSameDay } from "date-fns";
import { Play, Star, ArrowRight } from "lucide-react";
import { useStore } from "@/lib/store";
import { useNow } from "@/hooks/useHydrated";
import { daysBetween, entryDuration, formatDurationClock, formatDurationShort, inRange, weekRange, cn } from "@/lib/utils";
import { Page } from "@/components/layout/AppShell";
import { PageHeader, Tabs, EmptyState } from "@/components/ui/misc";
import { ProjectAvatar, Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ISSUE_TYPE_META, IssueTypeIcon, StatusLozenge } from "@/components/issues/icons";
import type { Issue } from "@/lib/types";
import { useEffectiveEntries } from "@/hooks/useData";

export default function ForYouPage() {
  const me = useStore((s) => s.currentUserId);
  const user = useStore((s) => s.users.find((u) => u.id === me));
  const projects = useStore((s) => s.projects);
  const issues = useStore((s) => s.issues);
  const entries = useEffectiveEntries();
  const recentProjectIds = useStore((s) => s.ui.recentProjectIds);
  const recentIssueIds = useStore((s) => s.ui.recentIssueIds);
  const starredIssueIds = useStore((s) => s.ui.starredIssueIds);
  const start = useStore((s) => s.startTimer);
  const now = useNow(1000, entries.some((e) => !e.stop));
  const [tab, setTab] = React.useState("worked");

  const recentProjects = React.useMemo(() => {
    const recent = recentProjectIds.map((id) => projects.find((p) => p.id === id)).filter(Boolean) as typeof projects;
    const rest = projects.filter((p) => !p.archived && !recent.includes(p));
    return [...recent, ...rest].slice(0, 4);
  }, [projects, recentProjectIds]);

  const workedOn = React.useMemo(() => {
    const ids = new Set(entries.filter((e) => e.userId === me && e.issueId).sort((a, b) => b.start.localeCompare(a.start)).map((e) => e.issueId!));
    const fromEntries = Array.from(ids).map((id) => issues.find((i) => i.id === id)).filter(Boolean) as Issue[];
    const updatedByMe = issues.filter((i) => i.assigneeId === me && !ids.has(i.id)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return [...fromEntries, ...updatedByMe].slice(0, 20);
  }, [entries, issues, me]);
  const viewed = recentIssueIds.map((id) => issues.find((i) => i.id === id)).filter(Boolean) as Issue[];
  const assigned = issues.filter((i) => i.assigneeId === me && i.status !== "done").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const starred = starredIssueIds.map((id) => issues.find((i) => i.id === id)).filter(Boolean) as Issue[];

  const list = tab === "worked" ? workedOn : tab === "viewed" ? viewed : tab === "assigned" ? assigned : starred;

  // Time this week
  const { start: ws, end: we } = weekRange(now);
  const mine = entries.filter((e) => e.userId === me);
  const weekEntries = mine.filter((e) => inRange(e.start, ws, we));
  const weekTotal = weekEntries.reduce((a, e) => a + entryDuration(e, now), 0);
  const todayTotal = mine.filter((e) => isSameDay(parseISO(e.start), now)).reduce((a, e) => a + entryDuration(e, now), 0);
  const days = daysBetween(ws, we);
  const perDay = days.map((d) => weekEntries.filter((e) => isSameDay(parseISO(e.start), d)).reduce((a, e) => a + entryDuration(e, now), 0));
  const maxDay = Math.max(1, ...perDay);

  const dueSoon = issues
    .filter((i) => i.assigneeId === me && i.status !== "done" && i.dueDate && parseISO(i.dueDate) <= subDays(startOfDay(now), -7))
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
    .slice(0, 5);

  return (
    <>
      <PageHeader title="For you" />
      <Page>
        <div className="mt-4 grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="ds-heading-md">Recent projects</h2>
                <Link href="/projects" className="text-sm text-ds-link hover:underline">
                  View all projects
                </Link>
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2 sm:gap-4">
                {recentProjects.map((p) => {
                  const open = issues.filter((i) => i.projectId === p.id && i.status !== "done").length;
                  const done = issues.filter((i) => i.projectId === p.id && i.status === "done").length;
                  return (
                    // on phones only avatar, name and type, as compact as the list of spaces there
                    <div key={p.id} className="relative overflow-hidden rounded-ds-lg border border-ds-border bg-ds-surface p-3 shadow-ds-raised sm:p-4">
                      <span className="absolute left-0 top-0 h-full w-2 sm:w-5" style={{ background: p.color, opacity: 0.85 }} />
                      <div className="ml-1 flex items-start gap-3 sm:ml-4">
                        <ProjectAvatar name={p.name} color={p.color} size={32} />
                        <div className="min-w-0 flex-1">
                          <Link href={`/projects/${p.key}/board`} className="block truncate font-semibold hover:underline">
                            {p.name}
                          </Link>
                          <div className="truncate text-xs text-ds-text-subtlest">{p.type === "software" ? "Software project" : "Business project"}</div>
                        </div>
                      </div>
                      <div className="ml-4 mt-4 space-y-1 text-xs text-ds-text-subtle max-sm:hidden">
                        <Link href={`/projects/${p.key}/list?status=open`} className="flex items-center justify-between rounded-ds px-1 py-0.5 hover:bg-ds-neutral-subtle-hovered">
                          <span>Open work items</span>
                          <span className="rounded-lg bg-ds-neutral px-1.5 font-semibold">{open}</span>
                        </Link>
                        <Link href={`/projects/${p.key}/list?status=done`} className="flex items-center justify-between rounded-ds px-1 py-0.5 hover:bg-ds-neutral-subtle-hovered">
                          <span>Done work items</span>
                          <span className="rounded-lg bg-ds-neutral px-1.5 font-semibold">{done}</span>
                        </Link>
                      </div>
                      <div className="ml-4 mt-3 flex gap-3 text-xs max-sm:hidden">
                        <Link href={`/projects/${p.key}/board`} className="text-ds-link hover:underline">
                          Board
                        </Link>
                        {p.type === "software" && (
                          <Link href={`/projects/${p.key}/backlog`} className="text-ds-link hover:underline">
                            Backlog
                          </Link>
                        )}
                        <Link href={`/projects/${p.key}/time`} className="text-ds-link hover:underline">
                          Time
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="mt-8">
              <Tabs
                value={tab}
                onChange={setTab}
                tabs={[
                  { id: "worked", label: "Worked on" },
                  { id: "viewed", label: "Viewed" },
                  { id: "assigned", label: "Assigned to me", badge: assigned.length ? <span className="rounded-lg bg-ds-neutral px-1.5 text-[11px] font-semibold text-ds-text-subtle">{assigned.length}</span> : undefined },
                  { id: "starred", label: "Starred" },
                ]}
              />
              {list.length === 0 ? (
                <EmptyState
                  icon={<Star />}
                  title={tab === "starred" ? "You haven't starred anything yet" : tab === "viewed" ? "Nothing viewed yet" : "Nothing here yet"}
                  description={tab === "starred" ? "Star work items from the work item view to find them quickly here." : "Work items you interact with will show up here."}
                />
              ) : (
                <GroupedIssueList issues={list} projects={projects} tab={tab} />
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <div className="rounded-ds-lg border border-ds-border bg-ds-surface p-4 shadow-ds-raised">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="ds-heading-sm">Your time this week</h3>
                <Link href="/reports" className="text-xs text-ds-link hover:underline">
                  Reports
                </Link>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <div className="tabular-nums ds-heading-xl">{formatDurationClock(weekTotal)}</div>
                  <div className="text-xs text-ds-text-subtlest">Today {formatDurationShort(todayTotal)}</div>
                </div>
                <Button appearance="primary" iconBefore={<Play />} spacing="compact" onClick={() => start()}>
                  Start timer
                </Button>
              </div>
              <div className="mt-4 flex h-20 items-end gap-1.5">
                {days.map((d, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1" title={`${format(d, "EEE d")}: ${formatDurationShort(perDay[i])}`}>
                    <div className="flex h-14 w-full items-end rounded-[2px] bg-ds-surface-sunken">
                      <div className={cn("w-full rounded-[2px]", isToday(d) ? "bg-ds-brand-bold" : "bg-chart-blue/50")} style={{ height: `${(perDay[i] / maxDay) * 100}%` }} />
                    </div>
                    <span className={cn("text-[10px]", isToday(d) ? "font-bold text-ds-text" : "text-ds-text-subtlest")}>{format(d, "EEEEE")}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-ds-lg border border-ds-border bg-ds-surface p-4 shadow-ds-raised">
              <h3 className="ds-heading-sm mb-3">Due soon</h3>
              {dueSoon.length === 0 && <div className="text-sm text-ds-text-subtlest">Nothing due in the next 7 days.</div>}
              <ul className="space-y-1">
                {dueSoon.map((i) => {
                  const overdue = parseISO(i.dueDate!) < startOfDay(now);
                  return (
                    <li key={i.id}>
                      <Link href={`/browse/${i.key}`} className="flex items-center gap-2 rounded-ds px-1 py-1 hover:bg-ds-neutral-subtle-hovered">
                        <IssueTypeIcon type={i.type} size={14} />
                        <span className="min-w-0 flex-1 truncate text-sm">{i.summary}</span>
                        <span className={cn("shrink-0 text-xs", overdue ? "font-semibold text-ds-text-danger" : "text-ds-text-subtlest")}>{format(parseISO(i.dueDate!), "d MMM")}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>

            {user && (
              <div className="rounded-ds-lg border border-ds-border bg-ds-surface p-4 shadow-ds-raised">
                <div className="flex items-center gap-3">
                  <Avatar user={user} size="lg" />
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{user.name}</div>
                    <div className="truncate text-xs text-ds-text-subtlest">{user.role === "admin" ? "Workspace admin" : "Member"}</div>
                  </div>
                </div>
                <Link href="/team" className="mt-3 inline-flex items-center gap-1 text-xs text-ds-link hover:underline">
                  Manage team <ArrowRight size={12} />
                </Link>
              </div>
            )}
          </aside>
        </div>
      </Page>
    </>
  );
}

function GroupedIssueList({ issues, projects, tab }: { issues: Issue[]; projects: { id: string; name: string }[]; tab: string }) {
  const groups: { label: string; items: Issue[] }[] = [];
  const bucket = (i: Issue) => {
    const d = parseISO(i.updatedAt);
    if (isToday(d)) return "Today";
    if (isYesterday(d)) return "Yesterday";
    if (d >= subDays(startOfDay(new Date()), 7)) return "In the last week";
    return "In the last month";
  };
  if (tab === "worked" || tab === "assigned") {
    for (const i of issues) {
      const b = bucket(i);
      const g = groups.find((x) => x.label === b) ?? (groups.push({ label: b, items: [] }), groups[groups.length - 1]);
      g.items.push(i);
    }
  } else {
    groups.push({ label: "", items: issues });
  }
  return (
    <div className="mt-2">
      {groups.map((g) => (
        <div key={g.label || "_"} className="mb-4">
          {g.label && <div className="ds-heading-xxs mb-1 mt-3 text-ds-text-subtlest">{g.label}</div>}
          <ul>
            {g.items.map((i) => (
              <li key={i.id}>
                <Link href={`/browse/${i.key}`} className="hidden h-10 items-center gap-3 rounded-ds px-2 hover:bg-ds-neutral-subtle-hovered sm:flex">
                  <IssueTypeIcon type={i.type} />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="text-sm">{i.summary}</span>
                    <span className="ml-2 text-xs text-ds-text-subtlest">
                      {i.key} · {projects.find((p) => p.id === i.projectId)?.name}
                    </span>
                  </span>
                  <StatusLozenge status={i.status} />
                </Link>
                {/* below 640px a row has no room for summary, key and status: one card per work item */}
                <Link href={`/browse/${i.key}`} className="mb-2 block rounded-ds-lg border border-ds-border bg-ds-surface p-4 hover:bg-ds-neutral-subtle-hovered sm:hidden">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex size-8 items-center justify-center rounded-ds bg-ds-neutral">
                      <IssueTypeIcon type={i.type} />
                    </span>
                    <StatusLozenge status={i.status} />
                  </div>
                  <div className="mt-3 truncate text-sm font-medium">{i.summary}</div>
                  <div className="mt-0.5 truncate text-xs text-ds-text-subtlest">
                    {ISSUE_TYPE_META[i.type].name} • {i.key} • {projects.find((p) => p.id === i.projectId)?.name}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
