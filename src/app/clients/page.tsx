"use client";

import * as React from "react";
import Link from "next/link";
import { MoreHorizontal, Pencil, Trash2, Archive, ArchiveRestore, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { entryDuration, formatDurationShort } from "@/lib/utils";
import { Page } from "@/components/layout/AppShell";
import { PageHeader, InlineEdit } from "@/components/ui/misc";
import { Button } from "@/components/ui/Button";
import { ProjectAvatar } from "@/components/ui/Avatar";
import { DropdownMenu, MenuItem } from "@/components/ui/Popover";
import { useEffectiveEntries } from "@/hooks/useData";

export default function ClientsPage() {
  const clients = useStore((s) => s.clients);
  const projects = useStore((s) => s.projects);
  const entries = useEffectiveEntries();
  const create = useStore((s) => s.createClient);
  const update = useStore((s) => s.updateClient);
  const remove = useStore((s) => s.deleteClient);
  const [name, setName] = React.useState("");
  const [showArchived, setShowArchived] = React.useState(false);

  const list = clients.filter((c) => showArchived || !c.archived);

  return (
    <>
      <PageHeader title="Clients" actions={<Button appearance="subtle" onClick={() => setShowArchived((s) => !s)}>{showArchived ? "Hide archived" : "Show archived"}</Button>} />
      <Page>
        <div className="mt-4 flex max-w-md items-center gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) { create(name); setName(""); } }} placeholder="New client name" className="ds-input h-8 py-1" />
          <Button appearance="primary" iconBefore={<Plus />} disabled={!name.trim()} onClick={() => { create(name); setName(""); }}>Add</Button>
        </div>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ds-text-subtle">
              <th className="border-b border-ds-border py-2 font-semibold">Client</th>
              <th className="border-b border-ds-border py-2 font-semibold">Projects</th>
              <th className="border-b border-ds-border py-2 text-right font-semibold">Tracked time</th>
              <th className="border-b border-ds-border py-2 text-right font-semibold">Billable</th>
              <th className="w-10 border-b border-ds-border py-2" />
            </tr>
          </thead>
          <tbody>
            {list.map((c) => {
              const ps = projects.filter((p) => p.clientId === c.id);
              const es = entries.filter((e) => ps.some((p) => p.id === e.projectId));
              const total = es.reduce((a, e) => a + entryDuration(e), 0);
              const bill = es.filter((e) => e.billable).reduce((a, e) => a + entryDuration(e), 0);
              return (
                <tr key={c.id} className={c.archived ? "opacity-60" : ""}>
                  <td className="border-b border-ds-border py-2 pr-4 font-medium">
                    <Link href={`/clients/${c.id}`} className="text-ds-link hover:underline">{c.name}</Link>
                    <InlineEdit value={c.name} onSave={(v) => v && update(c.id, { name: v })} className="ml-2 inline-block px-1.5 py-0.5 text-xs font-normal text-ds-text-subtlest" as="span" />
                    {c.archived && <span className="ml-2 text-xs text-ds-text-subtlest">(archived)</span>}
                  </td>
                  <td className="border-b border-ds-border py-2 pr-4">
                    <div className="flex flex-wrap gap-2">
                      {ps.map((p) => (
                        <Link key={p.id} href={`/projects/${p.key}/board`} className="inline-flex items-center gap-1.5 rounded-ds bg-ds-neutral px-1.5 py-0.5 text-xs hover:bg-ds-neutral-hovered">
                          <ProjectAvatar name={p.name} color={p.color} size={14} /> {p.name}
                        </Link>
                      ))}
                      {ps.length === 0 && <span className="text-xs text-ds-text-subtlest">No projects</span>}
                    </div>
                  </td>
                  <td className="tabular-nums border-b border-ds-border py-2 text-right">{formatDurationShort(total)}</td>
                  <td className="tabular-nums border-b border-ds-border py-2 text-right text-ds-text-subtle">{formatDurationShort(bill)}</td>
                  <td className="border-b border-ds-border py-2">
                    <DropdownMenu align="end" trigger={({ ref, toggle }) => <button ref={ref} type="button" onClick={toggle} className="inline-flex size-6 items-center justify-center rounded-ds text-ds-icon hover:bg-ds-neutral-hovered"><MoreHorizontal size={16} /></button>}>
                      {({ close }) => (
                        <>
                          <MenuItem icon={<Pencil />} onClick={close}>Rename (click the name)</MenuItem>
                          <MenuItem icon={c.archived ? <ArchiveRestore /> : <Archive />} onClick={() => { update(c.id, { archived: !c.archived }); close(); }}>{c.archived ? "Restore" : "Archive"}</MenuItem>
                          <MenuItem icon={<Trash2 />} className="text-ds-text-danger" onClick={() => { if (confirm(`Delete client ${c.name}?`)) remove(c.id); close(); }}>Delete</MenuItem>
                        </>
                      )}
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-ds-text-subtlest">No clients yet.</td></tr>}
          </tbody>
        </table>
      </Page>
    </>
  );
}
