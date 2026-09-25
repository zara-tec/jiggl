"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  ChevronDown,
  ChevronRight,
  Clock,
  Filter,
  Home,
  LayoutDashboard,
  MoreHorizontal,
  Play,
  Plus,
  SlidersHorizontal,
  Star,
  Tag,
  Users,
  FolderKanban,
  CalendarDays,
  FileText,
  TrendingUp,
} from "lucide-react";
import { create } from "zustand";
import { useStore } from "@/lib/store";
import { useHydrated } from "@/hooks/useHydrated";
import { cn } from "@/lib/utils";
import { ProjectAvatar } from "@/components/ui/Avatar";

/** From this width the sidebar is a docked column (Tailwind `lg`); below it, an overlay drawer. */
const DOCKED = "(min-width: 1024px)";

/** Open state of the overlay drawer: transient, unlike the persisted `ui.sidebarCollapsed` of the docked sidebar. */
const useDrawer = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({ open: false, setOpen: (open) => set({ open }) }));

/** The top bar toggle: collapses the docked sidebar, or opens and closes the drawer on narrow screens. */
export function toggleNavigation() {
  if (window.matchMedia(DOCKED).matches) useStore.getState().toggleSidebar();
  else useDrawer.setState((s) => ({ open: !s.open }));
}

export const SIDEBAR_TOGGLE_ID = "sidebar-toggle";
import { IssueTypeIcon } from "@/components/issues/icons";

function NavItem({
  href,
  icon,
  label,
  active,
  onClick,
  children,
  expandable,
  expanded,
  onToggle,
  elemAfter,
  depth = 0,
}: {
  href?: string;
  icon?: React.ReactNode;
  label: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
  expandable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  elemAfter?: React.ReactNode;
  depth?: number;
}) {
  const cls = cn(
    "group/nav flex h-8 w-full items-center gap-2 rounded-ds pr-1 text-left text-sm font-medium transition-colors",
    active ? "bg-ds-selected text-ds-text-selected" : "text-ds-text-subtle hover:bg-ds-neutral-subtle-hovered hover:text-ds-text",
  );
  const main = (
    <>
      <span className={cn("inline-flex w-6 shrink-0 items-center justify-center [&>svg]:size-4", active ? "text-ds-icon-brand" : "text-ds-icon")}>{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </>
  );
  const trailing = (
    <>
      {elemAfter}
      {expandable && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggle?.();
          }}
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-ds text-ds-icon hover:bg-ds-neutral-hovered"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      )}
    </>
  );
  const inner = "flex h-8 min-w-0 flex-1 items-center gap-2 rounded-ds text-left";
  return (
    <div>
      <div className={cls} style={{ paddingLeft: 8 + depth * 16 }}>
        {href ? (
          <Link href={href} className={inner} onClick={onClick}>
            {main}
          </Link>
        ) : (
          <button type="button" className={inner} onClick={onClick ?? onToggle}>
            {main}
          </button>
        )}
        {trailing}
      </div>
      {expandable && expanded && <div className="mt-0.5 space-y-0.5">{children}</div>}
    </div>
  );
}

export function Sidebar() {
  const collapsed = useStore((s) => s.ui.sidebarCollapsed);
  const pathname = usePathname();
  const hydrated = useHydrated();
  const projects = useStore((s) => s.projects);
  const issues = useStore((s) => s.issues);
  const recentIssueIds = useStore((s) => s.ui.recentIssueIds);
  const starredIssueIds = useStore((s) => s.ui.starredIssueIds);
  const recentProjectIds = useStore((s) => s.ui.recentProjectIds);
  const openCreate = useStore((s) => s.openCreateIssue);

  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({ projects: true, recent: false, starred: false });
  const toggle = (k: string) => setExpanded((e) => ({ ...e, [k]: !e[k] }));

  const is = (prefix: string) => pathname === prefix || pathname.startsWith(prefix + "/");

  const activeProjectKey = pathname.match(/^\/projects\/([^/]+)/)?.[1]?.toUpperCase();

  const sidebarProjects = React.useMemo(() => {
    const recent = recentProjectIds.map((id) => projects.find((p) => p.id === id)).filter(Boolean) as typeof projects;
    const rest = projects.filter((p) => !p.archived && !recent.includes(p));
    return [...recent, ...rest].slice(0, 6);
  }, [projects, recentProjectIds]);

  const recentIssues = recentIssueIds.map((id) => issues.find((i) => i.id === id)).filter(Boolean).slice(0, 6) as typeof issues;
  const starredIssues = starredIssueIds.map((id) => issues.find((i) => i.id === id)).filter(Boolean) as typeof issues;
  const starredProjects = projects.filter((p) => p.starred);

  const drawerOpen = useDrawer((s) => s.open);
  const setDrawerOpen = useDrawer((s) => s.setOpen);
  const ref = React.useRef<HTMLElement>(null);

  React.useEffect(() => setDrawerOpen(false), [pathname, setDrawerOpen]);

  React.useEffect(() => {
    if (!drawerOpen) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element;
      if (ref.current?.contains(t) || t.closest(`#${SIDEBAR_TOGGLE_ID}`)) return;
      setDrawerOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    const mq = window.matchMedia(DOCKED);
    const onDocked = () => mq.matches && setDrawerOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onDocked);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onDocked);
    };
  }, [drawerOpen, setDrawerOpen]);

  return (
    <aside
      ref={ref}
      // a click on a link to the current page does not change the pathname, so close here too
      onClick={(e) => (e.target as Element).closest("a") && setDrawerOpen(false)}
      className={cn(
        "flex-col border-ds-border bg-ds-surface",
        "lg:w-[var(--sidebar-width)] lg:shrink-0 lg:border-r",
        collapsed ? "lg:hidden" : "lg:flex",
        "max-lg:fixed max-lg:bottom-0 max-lg:left-0 max-lg:top-[var(--topbar-height)] max-lg:z-[800] max-lg:w-[min(var(--drawer-width),calc(100vw_-_48px))] max-lg:shadow-ds-overlay",
        drawerOpen ? "max-lg:flex" : "max-lg:hidden",
      )}
    >
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        <NavItem href="/for-you" icon={<Home />} label="For you" active={is("/for-you")} />
        <NavItem
          icon={<Clock />}
          label="Recent"
          expandable
          expanded={expanded.recent}
          onToggle={() => toggle("recent")}
        >
          {hydrated && recentIssues.length === 0 && <div className="px-3 py-1 pl-10 text-xs text-ds-text-subtlest">No recent work items</div>}
          {hydrated &&
            recentIssues.map((i) => (
              <NavItem key={i.id} href={`/browse/${i.key}`} icon={<IssueTypeIcon type={i.type} size={14} />} label={i.summary} active={is(`/browse/${i.key}`)} depth={1} />
            ))}
        </NavItem>
        <NavItem icon={<Star />} label="Starred" expandable expanded={expanded.starred} onToggle={() => toggle("starred")}>
          {hydrated && starredProjects.length === 0 && starredIssues.length === 0 && <div className="px-3 py-1 pl-10 text-xs text-ds-text-subtlest">Star items to find them here</div>}
          {hydrated &&
            starredProjects.map((p) => (
              <NavItem key={p.id} href={`/projects/${p.key}/board`} icon={<ProjectAvatar name={p.name} color={p.color} size={16} />} label={p.name} active={activeProjectKey === p.key} depth={1} />
            ))}
          {hydrated &&
            starredIssues.map((i) => (
              <NavItem key={i.id} href={`/browse/${i.key}`} icon={<IssueTypeIcon type={i.type} size={14} />} label={i.summary} active={is(`/browse/${i.key}`)} depth={1} />
            ))}
        </NavItem>

        <div className="my-2 h-px bg-ds-border" />
        <div className="ds-heading-xxs px-2 pb-1 pt-1 text-ds-text-subtlest">Track</div>
        <NavItem href="/timer" icon={<Play />} label="Timer" active={is("/timer")} />
        <NavItem href="/calendar" icon={<CalendarDays />} label="Calendar" active={is("/calendar")} />
        <NavItem href="/reports" icon={<BarChart3 />} label="Reports" active={is("/reports")} />
        <NavItem href="/insights" icon={<TrendingUp />} label="Insights" active={is("/insights")} />

        <div className="my-2 h-px bg-ds-border" />
        <div className="ds-heading-xxs px-2 pb-1 pt-1 text-ds-text-subtlest">Work</div>
        <NavItem
          href="/projects"
          icon={<FolderKanban />}
          label="Projects"
          active={pathname === "/projects"}
          expandable
          expanded={expanded.projects}
          onToggle={() => toggle("projects")}
          elemAfter={
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openCreate();
              }}
              className="hidden size-6 items-center justify-center rounded-ds text-ds-icon hover:bg-ds-neutral-hovered group-hover/nav:inline-flex"
              aria-label="Create work item"
            >
              <Plus size={14} />
            </button>
          }
        >
          {hydrated &&
            sidebarProjects.map((p) => (
              <NavItem key={p.id} href={`/projects/${p.key}/board`} icon={<ProjectAvatar name={p.name} color={p.color} size={16} />} label={p.name} active={activeProjectKey === p.key} depth={1} />
            ))}
          <Link href="/projects" className="flex h-7 items-center pl-10 text-xs text-ds-text-subtle hover:text-ds-link hover:underline">
            View all projects
          </Link>
        </NavItem>
        <NavItem href="/offers" icon={<FileText />} label="Offers" active={is("/offers")} />
        <NavItem href="/filters" icon={<Filter />} label="Filters" active={is("/filters")} />
        <NavItem href="/dashboards" icon={<LayoutDashboard />} label="Dashboards" active={is("/dashboards")} />

        <div className="my-2 h-px bg-ds-border" />
        <div className="ds-heading-xxs px-2 pb-1 pt-1 text-ds-text-subtlest">Manage</div>
        <NavItem href="/clients" icon={<Building2 />} label="Clients" active={is("/clients")} />
        <NavItem href="/tags" icon={<Tag />} label="Tags" active={is("/tags")} />
        <NavItem href="/team" icon={<Users />} label="Team" active={is("/team")} />
        <NavItem icon={<MoreHorizontal />} label="More" />
      </nav>
      <div className="border-t border-ds-border px-2 py-2">
        <Link href="/settings" className="flex h-8 items-center gap-2 rounded-ds px-2 text-sm text-ds-text-subtle hover:bg-ds-neutral-subtle-hovered hover:text-ds-text">
          <SlidersHorizontal size={16} className="text-ds-icon" />
          Customize sidebar
        </Link>
      </div>
    </aside>
  );
}
