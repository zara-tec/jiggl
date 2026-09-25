"use client";

import * as React from "react";
import { use } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MoreHorizontal, Star, Plus, Share2, Settings } from "lucide-react";
import { useStore } from "@/lib/store";
import { useProjectByKey } from "@/hooks/useData";
import { ProjectAvatar } from "@/components/ui/Avatar";
import { Button, IconButton } from "@/components/ui/Button";
import { DropdownMenu, MenuItem } from "@/components/ui/Popover";
import { EmptyState, Tabs } from "@/components/ui/misc";
import { Lozenge } from "@/components/ui/Lozenge";
import { PROJECT_STATUS_META } from "@/components/offers/meta";

export default function ProjectLayout({ children, params }: LayoutProps<"/projects/[key]">) {
  const { key } = use(params);
  const project = useProjectByKey(key);
  const pathname = usePathname();
  const router = useRouter();
  const touch = useStore((s) => s.touchRecentProject);
  const toggleStar = useStore((s) => s.toggleStarProject);
  const openCreate = useStore((s) => s.openCreateIssue);

  React.useEffect(() => {
    if (project) touch(project.id);
  }, [project?.id, touch, project]);

  if (!project) {
    return (
      <EmptyState
        title="Project not found"
        description={`There is no project with key "${key.toUpperCase()}".`}
        action={
          <Link href="/projects">
            <Button>View all projects</Button>
          </Link>
        }
      />
    );
  }

  const base = `/projects/${project.key}`;
  const tabs = [
    { id: "summary", label: "Summary" },
    { id: "timeline", label: "Timeline" },
    ...(project.type === "software" ? [{ id: "backlog", label: "Backlog" }] : []),
    { id: "board", label: "Board" },
    { id: "calendar", label: "Calendar" },
    { id: "list", label: "List" },
    { id: "time", label: "Time" },
    { id: "offers", label: "Offers" },
    { id: "budget", label: "Budget" },
    { id: "reports", label: "Reports" },
    { id: "settings", label: "Settings" },
  ];
  const active = pathname.replace(base, "").split("/")[1] || "board";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-page pt-4">
        <nav className="mb-1 flex items-center gap-1 text-sm text-ds-text-subtle">
          <Link href="/projects" className="hover:text-ds-link hover:underline">
            Projects
          </Link>
          <span className="text-ds-text-subtlest">/</span>
          <span>{project.name}</span>
        </nav>
        <div className="flex items-center justify-between gap-2 md:gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <ProjectAvatar name={project.name} color={project.color} size={24} />
            <h1 className="ds-heading-xl truncate">{project.name}</h1>
            {project.status !== "active" && <Lozenge appearance={PROJECT_STATUS_META[project.status].appearance}>{PROJECT_STATUS_META[project.status].name}</Lozenge>}
            <button type="button" onClick={() => toggleStar(project.id)} className="inline-flex size-8 items-center justify-center rounded-ds hover:bg-ds-neutral-subtle-hovered" aria-label="Star project">
              <Star size={16} className={project.starred ? "fill-ds-star text-ds-star" : "text-ds-icon"} />
            </button>
            <DropdownMenu
              trigger={({ ref, toggle }) => <IconButton ref={ref} icon={<MoreHorizontal />} label="More actions" onClick={toggle} />}
            >
              {({ close }) => (
                <>
                  <MenuItem
                    icon={<Plus />}
                    onClick={() => {
                      openCreate({ projectId: project.id });
                      close();
                    }}
                  >
                    Create work item
                  </MenuItem>
                  <MenuItem
                    icon={<Settings />}
                    onClick={() => {
                      router.push(`${base}/settings`);
                      close();
                    }}
                  >
                    Project settings
                  </MenuItem>
                </>
              )}
            </DropdownMenu>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button appearance="subtle" iconBefore={<Share2 />} className="max-md:hidden">
              Share
            </Button>
            <IconButton icon={<Share2 />} label="Share" className="md:hidden" />
            <Button appearance="primary" iconBefore={<Plus />} onClick={() => openCreate({ projectId: project.id })}>
              Create
            </Button>
          </div>
        </div>
        <Tabs className="mt-2" value={active} tabs={tabs.map((t) => ({ ...t, href: `${base}/${t.id}` }))} />
      </div>
      {children}
    </div>
  );
}
