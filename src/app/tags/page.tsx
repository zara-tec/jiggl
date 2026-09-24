"use client";

import * as React from "react";
import { Plus, Trash2, Tag as TagIcon } from "lucide-react";
import { useStore } from "@/lib/store";
import { entryDuration, formatDurationShort } from "@/lib/utils";
import { Page } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/misc";
import { Button, IconButton } from "@/components/ui/Button";

export default function TagsPage() {
  const tags = useStore((s) => s.tags);
  const entries = useStore((s) => s.timeEntries);
  const create = useStore((s) => s.createTag);
  const remove = useStore((s) => s.deleteTag);
  const [name, setName] = React.useState("");
  return (
    <>
      <PageHeader title="Tags" />
      <Page>
        <p className="mt-2 text-sm text-ds-text-subtle">Tags describe time entries across projects (e.g. meeting, review, design).</p>
        <div className="mt-4 flex max-w-md items-center gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) { create(name); setName(""); } }} placeholder="New tag" className="ds-input h-8 py-1" />
          <Button appearance="primary" iconBefore={<Plus />} disabled={!name.trim()} onClick={() => { create(name); setName(""); }}>Add</Button>
        </div>
        <table className="mt-4 w-full max-w-2xl text-sm">
          <thead>
            <tr className="text-left text-xs text-ds-text-subtle">
              <th className="border-b border-ds-border py-2 font-semibold">Tag</th>
              <th className="border-b border-ds-border py-2 text-right font-semibold">Entries</th>
              <th className="border-b border-ds-border py-2 text-right font-semibold">Tracked time</th>
              <th className="w-10 border-b border-ds-border py-2" />
            </tr>
          </thead>
          <tbody>
            {tags.map((t) => {
              const es = entries.filter((e) => e.tagIds.includes(t.id));
              return (
                <tr key={t.id}>
                  <td className="border-b border-ds-border py-2"><span className="inline-flex items-center gap-2"><TagIcon size={14} className="text-ds-icon" /> {t.name}</span></td>
                  <td className="tabular-nums border-b border-ds-border py-2 text-right text-ds-text-subtle">{es.length}</td>
                  <td className="tabular-nums border-b border-ds-border py-2 text-right">{formatDurationShort(es.reduce((a, e) => a + entryDuration(e), 0))}</td>
                  <td className="border-b border-ds-border py-2"><IconButton icon={<Trash2 />} label="Delete tag" spacing="compact" onClick={() => { if (confirm(`Delete tag "${t.name}"?`)) remove(t.id); }} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Page>
    </>
  );
}
