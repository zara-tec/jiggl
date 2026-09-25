"use client";

import * as React from "react";
import { useStore } from "@/lib/store";
import { useCurrentUser } from "@/hooks/useData";
import { Page } from "@/components/layout/AppShell";
import { PageHeader, Toggle } from "@/components/ui/misc";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { AVATAR_COLORS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { HolidaysSection } from "@/components/allocations/HolidaysSection";
import { ChangePasswordSection } from "@/components/settings/ChangePassword";
import { InstanceSection } from "@/components/settings/InstanceSection";
import { MailSection } from "@/components/settings/MailSection";
import { useTheme, type Theme } from "@/lib/theme";
import { Moon, Monitor, Sun } from "lucide-react";

export default function SettingsPage() {
  const me = useCurrentUser();
  const updateUser = useStore((s) => s.updateUser);
  const reset = useStore((s) => s.resetDemo);
  const mode = useStore((s) => s.ui.timerMode);
  const setMode = useStore((s) => s.setTimerMode);
  const draft = useStore((s) => s.ui.timerDraft);
  const setDraft = useStore((s) => s.setTimerDraft);
  const [name, setName] = React.useState(me.name);
  const [email, setEmail] = React.useState(me.email);
  const [saved, setSaved] = React.useState(false);
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const { theme, setTheme } = useTheme();
  const nProjects = useStore((s) => s.projects.length);
  const nIssues = useStore((s) => s.issues.length);
  const nEntries = useStore((s) => s.timeEntries.length);

  return (
    <>
      <PageHeader title="Settings" />
      <Page>
        <div className="mt-4 max-w-2xl space-y-10">
          <section>
            <h2 className="ds-heading-md mb-3">Profile</h2>
            <div className="mb-4 flex items-center gap-4">
              <Avatar user={me} size="xl" />
              <div className="flex flex-wrap gap-1.5">
                {AVATAR_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => updateUser(me.id, { color: c })} className={cn("size-6 rounded-full border-2", me.color === c ? "border-ds-text" : "border-transparent")} style={{ background: c }} aria-label={c} />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="block"><span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Full name</span><input value={name} onChange={(e) => setName(e.target.value)} className="ds-input" /></label>
              <label className="block"><span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Email</span><input value={email} onChange={(e) => setEmail(e.target.value)} className="ds-input" /></label>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Button appearance="primary" onClick={() => { updateUser(me.id, { name: name.trim() || me.name, email: email.trim() || me.email }); setSaved(true); setTimeout(() => setSaved(false), 1500); }}>Save</Button>
              {saved && <span className="text-sm text-ds-text-success">Saved</span>}
            </div>
          </section>

          <ChangePasswordSection />

          <InstanceSection />

          <section>
            <h2 className="ds-heading-md mb-1">Appearance</h2>
            <p className="mb-3 text-sm text-ds-text-subtle">Choose how Jiggl looks on this browser.</p>
            <div className="flex gap-2">
              {(
                [
                  { id: "light", label: "Light", icon: <Sun size={16} /> },
                  { id: "dark", label: "Dark", icon: <Moon size={16} /> },
                  { id: "system", label: "Match system", icon: <Monitor size={16} /> },
                ] as { id: Theme; label: string; icon: React.ReactNode }[]
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id)}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-ds border-2 px-3 text-sm font-medium",
                    theme === t.id ? "border-ds-border-selected bg-ds-selected text-ds-text-selected" : "border-ds-border text-ds-text-subtle hover:bg-ds-neutral-subtle-hovered",
                  )}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="ds-heading-md mb-3">Timer</h2>
            <div className="space-y-3 text-sm">
              <label className="flex items-center gap-3"><Toggle checked={mode === "manual"} onChange={(v) => setMode(v ? "manual" : "timer")} /> Default to manual mode on the Timer page</label>
              <label className="flex items-center gap-3"><Toggle checked={draft.billable} onChange={(v) => setDraft({ billable: v })} /> New entries are billable by default</label>
              <p className="text-xs text-ds-text-subtlest">Keyboard: <kbd className="rounded border border-ds-border bg-ds-surface-sunken px-1">c</kbd> create work item · <kbd className="rounded border border-ds-border bg-ds-surface-sunken px-1">/</kbd> search</p>
            </div>
          </section>

          <section>
            <h2 className="ds-heading-md mb-3">Workspace</h2>
            <div className="grid grid-cols-3 gap-4">
              <label className="block"><span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Workspace name</span><input value={settings.name} onChange={(e) => updateSettings({ name: e.target.value })} className="ds-input" /></label>
              <label className="block"><span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Currency</span>
                <select value={settings.currency} onChange={(e) => updateSettings({ currency: e.target.value as typeof settings.currency })} className="ds-input h-9">
                  <option value="EUR">EUR</option><option value="USD">USD</option><option value="GBP">GBP</option>
                </select>
              </label>
              <label className="block"><span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Hours per day</span><input type="number" min={1} max={24} value={settings.hoursPerDay} onChange={(e) => updateSettings({ hoursPerDay: Math.max(1, Number(e.target.value) || 8) })} className="ds-input" /></label>
            </div>
            <p className="mt-2 text-xs text-ds-text-subtlest">Hours per day converts tracked and sold hours into days across budgets and reports.</p>
          </section>

          <MailSection />

          <HolidaysSection />

          <section>
            <h2 className="ds-heading-md mb-3">Workspace data</h2>
            <p className="mb-3 text-sm text-ds-text-subtle">This workspace holds {nProjects} projects, {nIssues} work items and {nEntries} time entries on the server. Resetting replaces everything with the demo dataset.</p>
            <Button appearance="danger" onClick={() => { if (confirm("Reset all data to the demo dataset?")) reset().catch((e) => alert(String(e))); }}>Reset demo data</Button>
          </section>
        </div>
      </Page>
    </>
  );
}
