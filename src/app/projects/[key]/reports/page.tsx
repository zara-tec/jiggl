"use client";

import * as React from "react";
import { use } from "react";
import Link from "next/link";
import { eachDayOfInterval, format, isAfter, parseISO, startOfDay } from "date-fns";
import { useStore } from "@/lib/store";
import { useLoggedByIssue, useProjectByKey, useProjectIssues, useProjectSprints } from "@/hooks/useData";
import { formatDurationShort } from "@/lib/utils";
import { Page } from "@/components/layout/AppShell";
import { EmptyState, ProgressBar } from "@/components/ui/misc";
import { IssueTypeIcon, StatusLozenge } from "@/components/issues/icons";
import { ChartCard, ColumnChart, LineChart } from "@/components/reports/charts";

export default function ProjectReportsPage({ params }: PageProps<"/projects/[key]/reports">) {
  const { key } = use(params);
  const project = useProjectByKey(key);
  const issues = useProjectIssues(project?.id);
  const sprints = useProjectSprints(project?.id);
  const logged = useLoggedByIssue();
  const users = useStore((s) => s.users);
  if (!project) return null;

  const active = sprints.find((s) => s.state === "active");
  const sprintIssues = active ? issues.filter((i) => i.sprintId === active.id && i.type !== "epic") : [];
  const totalPts = sprintIssues.reduce((a, i) => a + (i.storyPoints ?? 0), 0);

  // Burndown: remaining points per day of the sprint (based on resolvedAt)
  let burn: { points: { id: string; label: string }[]; remaining: (number | null)[]; ideal: (number | null)[] } | null = null;
  if (active?.startDate && active.endDate) {
    const days = eachDayOfInterval({ start: startOfDay(parseISO(active.startDate)), end: startOfDay(parseISO(active.endDate)) });
    const today = startOfDay(new Date());
    burn = {
      points: days.map((d) => ({ id: d.toISOString(), label: format(d, "d MMM") })),
      remaining: days.map((d) => {
        if (isAfter(d, today)) return null;
        const donePts = sprintIssues.filter((i) => i.resolvedAt && startOfDay(parseISO(i.resolvedAt)) <= d).reduce((a, i) => a + (i.storyPoints ?? 0), 0);
        return totalPts - donePts;
      }),
      ideal: days.map((_, i) => totalPts - (totalPts * i) / Math.max(1, days.length - 1)),
    };
  }

  // Velocity: closed + active sprints
  const velSprints = sprints.filter((s) => s.state !== "future");
  const velValues: Record<string, Record<string, number>> = {};
  velSprints.forEach((s) => {
    const list = issues.filter((i) => i.sprintId === s.id && i.type !== "epic");
    velValues[s.id] = { committed: list.reduce((a, i) => a + (i.storyPoints ?? 0), 0), completed: list.filter((i) => i.status === "done").reduce((a, i) => a + (i.storyPoints ?? 0), 0) };
  });

  // Time tracking report
  const tracked = issues.filter((i) => i.type !== "epic" && ((logged.get(i.id) ?? 0) > 0 || i.originalEstimate)).sort((a, b) => (logged.get(b.id) ?? 0) - (logged.get(a.id) ?? 0));

  return (
    <Page>
      <div className="mt-4 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard title="Sprint burndown" subtitle={active ? `${active.name} · remaining story points per day` : "No active sprint"}>
          {burn ? (
            <LineChart points={burn.points} series={[{ id: "rem", name: "Remaining points", color: "var(--ds-chart-blue)", values: burn.remaining }]} guide={burn.ideal} format={(v) => String(Math.round(v))} />
          ) : (
            <EmptyState title="Start a sprint to see the burndown" description="The burndown compares remaining story points against an ideal pace." className="py-8" />
          )}
        </ChartCard>
        <ChartCard title="Velocity" subtitle="Story points committed vs completed per sprint.">
          {velSprints.length ? (
            <ColumnChart categories={velSprints.map((s) => ({ id: s.id, label: s.name.replace(`${project.key} `, "") }))} series={[{ id: "committed", name: "Committed", color: "#2a78d6" }, { id: "completed", name: "Completed", color: "#eb6834" }]} values={velValues} format={(v) => String(Math.round(v))} grouped />
          ) : (
            <EmptyState title="No sprints yet" className="py-8" />
          )}
        </ChartCard>
        <ChartCard title="Time tracking report" subtitle="Estimated vs logged time per work item." className="xl:col-span-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ds-text-subtle">
                <th className="pb-2 font-semibold">Work item</th>
                <th className="pb-2 font-semibold">Assignee</th>
                <th className="pb-2 font-semibold">Status</th>
                <th className="w-48 pb-2 font-semibold">Progress</th>
                <th className="pb-2 text-right font-semibold">Estimate</th>
                <th className="pb-2 text-right font-semibold">Logged</th>
                <th className="pb-2 text-right font-semibold">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {tracked.map((i) => {
                const l = logged.get(i.id) ?? 0;
                const est = i.originalEstimate ?? 0;
                return (
                  <tr key={i.id} className="border-t border-ds-border">
                    <td className="py-1.5 pr-3">
                      <Link href={`/browse/${i.key}`} className="flex items-center gap-2 hover:underline"><IssueTypeIcon type={i.type} size={14} /> <span className="text-xs text-ds-text-subtle">{i.key}</span> <span className="truncate">{i.summary}</span></Link>
                    </td>
                    <td className="py-1.5 pr-3 text-ds-text-subtle">{users.find((u) => u.id === i.assigneeId)?.name ?? "—"}</td>
                    <td className="py-1.5 pr-3"><StatusLozenge status={i.status} /></td>
                    <td className="py-1.5 pr-3"><ProgressBar segments={[{ value: Math.min(l, est || l), color: l > est && est ? "var(--ds-chart-red)" : "var(--ds-chart-blue)" }, { value: Math.max(0, est - l), color: "var(--ds-chart-track)" }]} height={6} /></td>
                    <td className="tabular-nums py-1.5 text-right">{est ? formatDurationShort(est) : "—"}</td>
                    <td className="tabular-nums py-1.5 text-right">{formatDurationShort(l)}</td>
                    <td className={`tabular-nums py-1.5 text-right ${est && l > est ? "text-ds-text-danger" : ""}`}>{est ? (l > est ? `-${formatDurationShort(l - est)}` : formatDurationShort(est - l)) : "—"}</td>
                  </tr>
                );
              })}
              {tracked.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-ds-text-subtlest">No estimates or logged time yet.</td></tr>}
            </tbody>
          </table>
        </ChartCard>
      </div>
    </Page>
  );
}
