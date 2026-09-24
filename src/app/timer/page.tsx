"use client";

import * as React from "react";
import { subDays, startOfDay } from "date-fns";
import { CalendarDays, List } from "lucide-react";
import { useStore } from "@/lib/store";
import { useNow } from "@/hooks/useHydrated";
import { entryDuration, formatDurationClock, inRange, weekRange } from "@/lib/utils";
import { Page } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/misc";
import { Button } from "@/components/ui/Button";
import { TimerBar } from "@/components/time/TimerBar";
import { TimeEntriesList } from "@/components/time/TimeEntriesList";
import Link from "next/link";
import { useEffectiveEntries } from "@/hooks/useData";

export default function TimerPage() {
  const me = useStore((s) => s.currentUserId);
  const entries = useEffectiveEntries();
  const now = useNow(1000, entries.some((e) => !e.stop));
  const [days, setDays] = React.useState(7);

  const mine = React.useMemo(() => entries.filter((e) => e.userId === me), [entries, me]);
  const { start, end } = weekRange(now);
  const weekTotal = mine.filter((e) => inRange(e.start, start, end)).reduce((a, e) => a + entryDuration(e, now), 0);
  const todayList = mine.filter((e) => inRange(e.start, now, now));
  const todayTotal = todayList.reduce((a, e) => a + entryDuration(e, now), 0);
  const todayAllocated = todayList.filter((e) => e.virtual).reduce((a, e) => a + entryDuration(e, now), 0);
  const hoursPerDay = useStore((s) => s.settings.hoursPerDay);
  const free = Math.max(0, hoursPerDay * 3600 - todayTotal);

  const visible = React.useMemo(() => {
    const cutoff = startOfDay(subDays(new Date(), days - 1));
    return mine.filter((e) => new Date(e.start) >= cutoff);
  }, [mine, days]);
  const hasMore = mine.some((e) => new Date(e.start) < startOfDay(subDays(new Date(), days - 1)));

  return (
    <>
      <PageHeader
        title="Timer"
        actions={
          <div className="flex items-center rounded-ds bg-ds-neutral p-0.5">
            <span className="inline-flex h-7 items-center gap-1 rounded-[2px] bg-ds-surface px-2 text-xs font-medium shadow-ds-raised">
              <List size={14} /> List
            </span>
            <Link href="/calendar" className="inline-flex h-7 items-center gap-1 rounded-[2px] px-2 text-xs font-medium text-ds-text-subtle hover:text-ds-text">
              <CalendarDays size={14} /> Calendar
            </Link>
          </div>
        }
      />
      <Page>
        <TimerBar className="mt-4" />
        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm text-ds-text-subtle">
            <span>
              Today <span className="tabular-nums ml-1 font-semibold text-ds-text">{formatDurationClock(todayTotal)}</span>
            </span>
            <span>
              This week <span className="tabular-nums ml-1 font-semibold text-ds-text">{formatDurationClock(weekTotal)}</span>
            </span>
            {todayAllocated > 0 && (
              <span className="text-xs text-ds-text-subtlest">
                {formatDurationClock(todayAllocated)} allocated · {formatDurationClock(todayTotal - todayAllocated)} tracked · {formatDurationClock(free)} free of {hoursPerDay}h
              </span>
            )}
          </div>
        </div>
        <TimeEntriesList entries={visible} className="mt-3" emptyText="No time entries yet. Start the timer above or switch to manual mode to add one." />
        {hasMore && (
          <div className="mt-4 flex justify-center">
            <Button onClick={() => setDays((d) => d + 7)}>Load more</Button>
          </div>
        )}
      </Page>
    </>
  );
}
