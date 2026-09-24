"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CircleHelp, Menu, Play, Plus, Search, Settings, Square, Grip, LogOut, RotateCcw, Timer, Check, Building2, CloudOff, CloudUpload, Cloud, AlertCircle, Sun, Moon, Monitor } from "lucide-react";
import { useSyncStatus } from "@/lib/sync";
import { useTheme, type Theme } from "@/lib/theme";
import { useStore } from "@/lib/store";
import { useHydrated, useNow } from "@/hooks/useHydrated";
import { useCurrentUser, useProject, useRunningEntry } from "@/hooks/useData";
import { cn, entryDuration, formatDurationClock } from "@/lib/utils";
import { Button, IconButton } from "@/components/ui/Button";
import { Avatar, ProjectAvatar } from "@/components/ui/Avatar";
import { DropdownMenu, MenuGroup, MenuItem, MenuSeparator, Popover } from "@/components/ui/Popover";
import { Kbd } from "@/components/ui/misc";
import { IssueTypeIcon } from "@/components/issues/icons";
import { ProjectSelect } from "@/components/issues/fields";

export function TopBar() {
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const openCreate = useStore((s) => s.openCreateIssue);
  const hydrated = useHydrated();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "c") {
        e.preventDefault();
        openCreate();
      }
      if (e.key === "/") {
        e.preventDefault();
        document.getElementById("global-search")?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openCreate]);

  return (
    <header className="flex h-[var(--topbar-height)] shrink-0 items-center gap-2 border-b border-ds-border bg-ds-surface px-3">
      <IconButton icon={<Menu />} label="Toggle sidebar" onClick={toggleSidebar} />
      <IconButton icon={<Grip />} label="Switch apps" className="hidden md:inline-flex" />
      <Link href="/for-you" className="mr-2 flex items-center gap-2 rounded-ds px-1.5 py-1 hover:bg-ds-neutral-subtle-hovered">
        <Logo />
        <span className="text-[15px] font-bold tracking-tight text-ds-text">Jiggl</span>
      </Link>

      <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
        <GlobalSearch />
        <Button appearance="primary" iconBefore={<Plus />} onClick={() => openCreate()} className="shrink-0">
          Create
        </Button>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {hydrated && <SyncIndicator />}
        {hydrated && <TopBarTimer />}
        <IconButton icon={<Bell />} label="Notifications" />
        <IconButton icon={<CircleHelp />} label="Help" />
        <Link href="/settings">
          <IconButton icon={<Settings />} label="Settings" />
        </Link>
        {hydrated && <ProfileMenu />}
      </div>
    </header>
  );
}

export function Logo({ size = 24 }: { size?: number }) {
  return (
    <span className="inline-flex items-center justify-center rounded-[6px] bg-ds-brand-bold text-white" style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 24 24" width={size * 0.66} height={size * 0.66} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="13" r="7" />
        <path d="M12 9v4l2.5 2" />
        <path d="M9 3h6" />
      </svg>
    </span>
  );
}

/* ---------- Sync indicator ---------- */
function SyncIndicator() {
  const status = useSyncStatus((s) => s.status);
  const pending = useSyncStatus((s) => s.pending);
  if (status === "idle") return null;
  const map = {
    saving: { icon: <CloudUpload size={14} />, label: pending ? `Saving ${pending}…` : "Saving…", cls: "text-ds-text-subtle" },
    saved: { icon: <Cloud size={14} />, label: "Saved", cls: "text-ds-text-subtlest" },
    error: { icon: <AlertCircle size={14} />, label: "Not saved, retrying", cls: "text-ds-text-danger" },
    offline: { icon: <CloudOff size={14} />, label: "Offline, will sync", cls: "text-ds-text-warning" },
  } as const;
  const m = map[status];
  return (
    <span className={`mr-1 hidden items-center gap-1 text-xs xl:inline-flex ${m.cls}`} title="Changes are saved to the server automatically">
      {m.icon} {m.label}
    </span>
  );
}

const THEMES: { id: Theme; label: string; icon: React.ReactNode }[] = [
  { id: "light", label: "Light", icon: <Sun /> },
  { id: "dark", label: "Dark", icon: <Moon /> },
  { id: "system", label: "Match system", icon: <Monitor /> },
];

/* ---------- Profile menu ---------- */
function ProfileMenu() {
  const me = useCurrentUser();
  const session = useStore((s) => s.session);
  const reset = useStore((s) => s.resetDemo);
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const { theme, setTheme } = useTheme();

  const switchWorkspace = async (workspaceId: string) => {
    setBusy(true);
    await fetch("/api/auth/switch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspaceId }) });
    window.location.assign(window.location.origin + "/for-you");
  };
  const createWorkspace = async () => {
    const name = prompt("Name of the new workspace");
    if (!name?.trim()) return;
    const demo = confirm("Load the demo dataset into it?");
    setBusy(true);
    const res = await fetch("/api/workspaces", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, demo }) });
    if (res.ok) window.location.assign(window.location.origin + "/for-you");
    else setBusy(false);
  };
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign(window.location.origin + "/login");
  };

  if (!me) return null;
  return (
    <DropdownMenu
      align="end"
      className="w-72"
      trigger={({ ref, toggle }) => (
        <button ref={ref} type="button" onClick={toggle} className="ml-1 rounded-full p-0.5 hover:bg-ds-neutral-subtle-hovered" aria-label="Account">
          <Avatar user={me} size="sm" />
        </button>
      )}
    >
      {({ close }) => (
        <>
          <div className="flex items-center gap-3 px-3 py-3">
            <Avatar user={me} size="lg" />
            <div className="min-w-0">
              <div className="truncate font-semibold">{me.name}</div>
              <div className="truncate text-xs text-ds-text-subtlest">{session?.accountEmail ?? me.email}</div>
            </div>
          </div>
          <MenuSeparator />
          <MenuGroup title="Workspaces">
            {session?.workspaces.map((w) => (
              <MenuItem key={w.id} icon={w.id === session.workspaceId ? <Check className="text-ds-icon-brand" /> : <Building2 />} isDisabled={busy} onClick={() => w.id !== session.workspaceId && switchWorkspace(w.id)} description={w.role}>
                {w.name}
              </MenuItem>
            ))}
            <MenuItem icon={<Plus />} isDisabled={busy} onClick={() => { close(); createWorkspace(); }}>
              Create workspace
            </MenuItem>
          </MenuGroup>
          <MenuSeparator />
          <MenuGroup title="Theme">
            {THEMES.map((t) => (
              <MenuItem key={t.id} icon={theme === t.id ? <Check className="text-ds-icon-brand" /> : t.icon} onClick={() => setTheme(t.id)}>
                {t.label}
              </MenuItem>
            ))}
          </MenuGroup>
          <MenuSeparator />
          <MenuItem
            icon={<RotateCcw />}
            isDisabled={busy}
            onClick={async () => {
              close();
              if (!confirm("Replace everything in this workspace with the demo dataset?")) return;
              try {
                await reset();
              } catch (e) {
                alert(String(e));
              }
            }}
          >
            Reset demo data
          </MenuItem>
          <MenuItem icon={<Settings />} onClick={() => { close(); router.push("/settings"); }}>
            Settings
          </MenuItem>
          <MenuItem icon={<LogOut />} onClick={logout}>
            Log out
          </MenuItem>
        </>
      )}
    </DropdownMenu>
  );
}

/* ---------- Timer widget in the top bar ---------- */
function TopBarTimer() {
  const running = useRunningEntry();
  const now = useNow(1000, !!running);
  const stop = useStore((s) => s.stopTimer);
  const start = useStore((s) => s.startTimer);
  const project = useProject(running?.projectId);
  const issue = useStore((s) => (running?.issueId ? s.issues.find((i) => i.id === running.issueId) : undefined));
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLButtonElement>(null);
  const [desc, setDesc] = React.useState("");
  const [projectId, setProjectId] = React.useState<string | undefined>();
  const router = useRouter();

  if (running) {
    return (
      <div className="mr-1 flex h-8 items-center gap-1 rounded-ds border border-ds-border bg-ds-surface pl-2 pr-1">
        <span className="size-2 rounded-full bg-ds-danger-bold timer-pulse" />
        <Link href="/timer" className="flex min-w-0 max-w-64 items-center gap-1.5 text-sm hover:underline">
          {project && <span className="size-2 shrink-0 rounded-full" style={{ background: project.color }} />}
          <span className="truncate">{running.description || issue?.summary || "(no description)"}</span>
          {issue && <span className="shrink-0 text-xs text-ds-text-subtlest">{issue.key}</span>}
        </Link>
        <span className="tabular-nums ml-1 text-sm font-semibold">{formatDurationClock(entryDuration(running, now))}</span>
        <button
          type="button"
          onClick={stop}
          title="Stop timer"
          className="ml-1 inline-flex size-6 items-center justify-center rounded-full bg-ds-danger-bold text-ds-text-on-brand hover:bg-ds-danger-bold-hovered"
        >
          <Square size={10} fill="currentColor" />
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn("mr-1 inline-flex h-8 items-center gap-1.5 rounded-ds px-2 text-sm font-medium text-ds-text hover:bg-ds-neutral-subtle-hovered", open && "bg-ds-neutral-subtle-hovered")}
      >
        <span className="inline-flex size-5 items-center justify-center rounded-full bg-ds-brand-bold text-ds-text-on-brand">
          <Play size={10} fill="currentColor" />
        </span>
        <span className="hidden lg:inline">Start timer</span>
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={ref} align="end" className="w-80 p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Timer size={16} className="text-ds-icon" /> Start a timer
        </div>
        <input
          autoFocus
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              start({ description: desc, projectId });
              setOpen(false);
              setDesc("");
            }
          }}
          placeholder="What are you working on?"
          className="ds-input mb-2"
        />
        <ProjectSelect value={projectId} onChange={setProjectId} clearable placeholder="No project" />
        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            className="text-xs text-ds-link hover:underline"
            onClick={() => {
              setOpen(false);
              router.push("/timer");
            }}
          >
            Open timer page
          </button>
          <Button
            appearance="primary"
            iconBefore={<Play />}
            onClick={() => {
              start({ description: desc, projectId });
              setOpen(false);
              setDesc("");
            }}
          >
            Start
          </Button>
        </div>
      </Popover>
    </>
  );
}

/* ---------- Global search ---------- */
function GlobalSearch() {
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const router = useRouter();
  const issues = useStore((s) => s.issues);
  const projects = useStore((s) => s.projects);
  const recentIds = useStore((s) => s.ui.recentIssueIds);
  const hydrated = useHydrated();

  const query = q.trim().toLowerCase();
  const issueResults = React.useMemo(() => {
    if (!hydrated) return [];
    if (!query) {
      const recent = recentIds.map((id) => issues.find((i) => i.id === id)).filter(Boolean) as typeof issues;
      const fallback = [...issues].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).filter((i) => !recentIds.includes(i.id));
      return [...recent, ...fallback].slice(0, 6);
    }
    return issues.filter((i) => i.key.toLowerCase().includes(query) || i.summary.toLowerCase().includes(query)).slice(0, 8);
  }, [issues, query, recentIds, hydrated]);
  const projectResults = React.useMemo(() => {
    if (!hydrated) return [];
    const list = query ? projects.filter((p) => p.name.toLowerCase().includes(query) || p.key.toLowerCase().includes(query)) : projects.filter((p) => p.starred);
    return list.slice(0, 4);
  }, [projects, query, hydrated]);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  return (
    <div ref={ref} className="relative w-full max-w-[780px]">
      <Search size={16} className="pointer-events-none absolute left-2.5 top-2 text-ds-icon-subtle" />
      <input
        id="global-search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const first = issueResults[0];
            if (first) go(`/browse/${first.key}`);
            else if (projectResults[0]) go(`/projects/${projectResults[0].key}/board`);
          }
          if (e.key === "Escape") {
            setOpen(false);
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder="Search"
        className="h-8 w-full rounded-ds border border-ds-border-input bg-ds-input pl-8 pr-10 text-sm text-ds-text placeholder:text-ds-text-subtlest hover:bg-ds-surface-sunken focus:border-ds-border-focused focus:outline-none focus:ring-1 focus:ring-ds-border-focused"
      />
      <span className="pointer-events-none absolute right-2 top-1.5 hidden md:inline">
        <Kbd>/</Kbd>
      </span>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={ref} matchWidth className="max-h-[70vh] overflow-y-auto py-2">
        <MenuGroup title={query ? "Work items" : "Recent work items"}>
          {issueResults.length === 0 && <div className="px-3 py-2 text-sm text-ds-text-subtlest">No work items found</div>}
          {issueResults.map((i) => (
            <MenuItem key={i.id} icon={<IssueTypeIcon type={i.type} />} onClick={() => go(`/browse/${i.key}`)} description={`${i.key} · ${projects.find((p) => p.id === i.projectId)?.name ?? ""}`}>
              {i.summary}
            </MenuItem>
          ))}
        </MenuGroup>
        {projectResults.length > 0 && (
          <>
            <MenuSeparator />
            <MenuGroup title={query ? "Projects" : "Starred projects"}>
              {projectResults.map((p) => (
                <MenuItem key={p.id} icon={<ProjectAvatar name={p.name} color={p.color} size={20} />} onClick={() => go(`/projects/${p.key}/board`)} description={`${p.key} · ${p.type === "software" ? "Software project" : "Business project"}`}>
                  {p.name}
                </MenuItem>
              ))}
            </MenuGroup>
          </>
        )}
        <MenuSeparator />
        <div className="px-3 py-1.5 text-xs text-ds-text-subtlest">
          Press <Kbd>Enter</Kbd> to open the first result · <Kbd>c</Kbd> to create a work item
        </div>
      </Popover>
    </div>
  );
}
