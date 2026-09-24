"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import type { Offer, OfferLineIssueType } from "@/lib/types";
import { lineAmount, offerTotals } from "@/lib/offers";
import { formatMoney } from "@/lib/rates";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Checkbox, SectionMessage } from "@/components/ui/misc";
import { Select } from "@/components/ui/Select";
import { IssueTypeIcon } from "@/components/issues/icons";
import { UserSelect } from "@/components/issues/fields";
import { ProjectAvatar } from "@/components/ui/Avatar";

interface Row {
  lineId: string;
  issueType: OfferLineIssueType;
  assigneeId?: string;
  include: boolean;
}

export function ConvertOfferModal({ open, onClose, offer }: { open: boolean; onClose: () => void; offer: Offer }) {
  const project = useStore((s) => s.projects.find((p) => p.id === offer.projectId));
  const settings = useStore((s) => s.settings);
  const convert = useStore((s) => s.convertOffer);
  const router = useRouter();
  const lines = React.useMemo(() => [...offer.lines].sort((a, b) => a.order - b.order), [offer.lines]);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [done, setDone] = React.useState<{ key: string; summary: string }[] | null>(null);

  // Initialise only when the dialog opens: after conversion the lines change
  // (they gain issue ids) and the result view must stay visible.
  const wasOpen = React.useRef(false);
  React.useEffect(() => {
    if (open && !wasOpen.current) {
      setRows(lines.map((l) => ({ lineId: l.id, issueType: l.issueType, assigneeId: project?.leadId, include: !l.issueId })));
      setDone(null);
    }
    wasOpen.current = open;
  }, [open, lines, project?.leadId]);

  if (!project) return null;
  const included = rows.filter((r) => r.include).length;
  const totals = offerTotals(offer);

  const run = () => {
    const created = convert(offer.id, rows);
    setDone(created.map((i) => ({ key: i.key, summary: i.summary })));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={done ? "Order created" : "Convert to order"}
      width={760}
      footer={
        done ? (
          <>
            <Button appearance="subtle" onClick={onClose}>Close</Button>
            <Button appearance="primary" onClick={() => { onClose(); router.push(`/projects/${project.key}/timeline`); }}>Open timeline</Button>
          </>
        ) : (
          <>
            <Button appearance="subtle" onClick={onClose}>Cancel</Button>
            <Button appearance="primary" disabled={included === 0} onClick={run}>
              Create {included} work item{included === 1 ? "" : "s"}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <>
          <SectionMessage appearance="success" title={`${offer.number} is now an order`}>
            {done.length} work item{done.length === 1 ? "" : "s"} created in {project.name}. Sold hours became the original estimate, planned dates became start and due dates, and every item is labelled {offer.number}.
          </SectionMessage>
          <ul className="mt-4 divide-y divide-ds-border rounded-ds border border-ds-border text-sm">
            {done.map((d) => (
              <li key={d.key} className="flex items-center gap-2 px-3 py-2">
                <span className="w-16 shrink-0 text-xs text-ds-text-subtle">{d.key}</span>
                <span className="truncate">{d.summary}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-3 rounded-ds bg-ds-surface-sunken px-3 py-2 text-sm">
            <ProjectAvatar name={project.name} color={project.color} size={24} />
            <span>
              Work items will be created in <b>{project.name}</b>{project.status === "prospect" ? ", which becomes Active" : ""}.
            </span>
            <span className="ml-auto text-ds-text-subtle">
              {formatMoney(totals.total, settings.currency)} · {totals.hours}h
            </span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ds-text-subtle">
                <th className="w-8 pb-2" />
                <th className="pb-2 font-semibold">Line</th>
                <th className="w-32 pb-2 font-semibold">Work item type</th>
                <th className="w-48 pb-2 font-semibold">Assignee</th>
                <th className="w-24 pb-2 text-right font-semibold">Sold</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const row = rows.find((r) => r.lineId === l.id);
                if (!row) return null;
                const already = !!l.issueId;
                return (
                  <tr key={l.id} className={row.include ? "" : "opacity-50"}>
                    <td className="py-1.5">
                      <Checkbox checked={row.include} onChange={(v) => !already && setRows((rs) => rs.map((r) => (r.lineId === l.id ? { ...r, include: v } : r)))} />
                    </td>
                    <td className="py-1.5 pr-3">
                      <div className="font-medium">{l.description || `Line ${l.order}`}</div>
                      {already && <div className="text-xs text-ds-text-subtlest">Already converted</div>}
                    </td>
                    <td className="py-1.5 pr-3">
                      <Select
                        value={row.issueType}
                        onChange={(v) => v && setRows((rs) => rs.map((r) => (r.lineId === l.id ? { ...r, issueType: v as OfferLineIssueType } : r)))}
                        searchable={false}
                        appearance="subtle"
                        isDisabled={already}
                        options={[
                          { value: "epic", label: "Epic", icon: <IssueTypeIcon type="epic" /> },
                          { value: "story", label: "Story", icon: <IssueTypeIcon type="story" /> },
                          { value: "task", label: "Task", icon: <IssueTypeIcon type="task" /> },
                        ]}
                      />
                    </td>
                    <td className="py-1.5 pr-3">
                      <UserSelect value={row.assigneeId} onChange={(v) => setRows((rs) => rs.map((r) => (r.lineId === l.id ? { ...r, assigneeId: v } : r)))} />
                    </td>
                    <td className="tabular-nums py-1.5 text-right text-ds-text-subtle">
                      {l.hours}h
                      <div className="text-xs text-ds-text-subtlest">{formatMoney(lineAmount(l), settings.currency)}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </Modal>
  );
}
