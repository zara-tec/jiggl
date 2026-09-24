"use client";

import * as React from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { useStore } from "@/lib/store";
import { OFFER_STATUS_META, OPEN_OFFER_STATUSES, offerTotals } from "@/lib/offers";
import { formatDays, formatMoney } from "@/lib/rates";
import { Page } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/misc";
import { Select } from "@/components/ui/Select";
import { Avatar, ProjectAvatar } from "@/components/ui/Avatar";
import { OfferStatusLozenge } from "@/components/offers/meta";
import { StatTile } from "@/components/reports/charts";
import type { OfferStatus } from "@/lib/types";

export default function OffersPage() {
  const offers = useStore((s) => s.offers);
  const projects = useStore((s) => s.projects);
  const clients = useStore((s) => s.clients);
  const users = useStore((s) => s.users);
  const settings = useStore((s) => s.settings);
  const [status, setStatus] = React.useState<string | null>(null);
  const [clientId, setClientId] = React.useState<string | null>(null);
  const [ownerId, setOwnerId] = React.useState<string | null>(null);

  const list = offers
    .filter((o) => !status || (status === "open" ? OPEN_OFFER_STATUSES.includes(o.status) : o.status === status))
    .filter((o) => !clientId || projects.find((p) => p.id === o.projectId)?.clientId === clientId)
    .filter((o) => !ownerId || o.ownerId === ownerId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const ordered = offers.filter((o) => o.status === "ordered");
  const pipeline = offers.filter((o) => OPEN_OFFER_STATUSES.includes(o.status));
  const sum = (l: typeof offers) => l.reduce((a, o) => a + offerTotals(o).total, 0);
  const hrs = (l: typeof offers) => l.reduce((a, o) => a + offerTotals(o).hours, 0);

  return (
    <>
      <PageHeader title="Offers" />
      <Page>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Select value={status} onChange={setStatus} searchable={false} clearable appearance="chip" chipLabel="Status" placeholder="All" options={[{ value: "open", label: "Open (draft, sent, accepted)" }, ...(Object.keys(OFFER_STATUS_META) as OfferStatus[]).map((s) => ({ value: s, label: OFFER_STATUS_META[s].name }))]} />
          <Select value={clientId} onChange={setClientId} clearable appearance="chip" chipLabel="Client" placeholder="All" options={clients.map((c) => ({ value: c.id, label: c.name }))} />
          <Select value={ownerId} onChange={setOwnerId} clearable appearance="chip" chipLabel="Owner" placeholder="All" options={users.map((u) => ({ value: u.id, label: u.name, icon: <Avatar user={u} size="xs" /> }))} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="Ordered" value={formatMoney(sum(ordered), settings.currency)} hint={`${ordered.length} orders · ${formatDays(hrs(ordered) * 3600, settings)}`} />
          <StatTile label="Pipeline" value={formatMoney(sum(pipeline), settings.currency)} hint={`${pipeline.length} open offers · ${formatDays(hrs(pipeline) * 3600, settings)}`} />
          <StatTile label="Sent, waiting" value={offers.filter((o) => o.status === "sent").length} hint="Offers at the client" />
          <StatTile label="Accepted, to convert" value={offers.filter((o) => o.status === "accepted").length} hint="Ready to become orders" />
        </div>
        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ds-text-subtle">
              <th className="border-b border-ds-border py-2 font-semibold">Number</th>
              <th className="border-b border-ds-border py-2 font-semibold">Title</th>
              <th className="border-b border-ds-border py-2 font-semibold">Client / project</th>
              <th className="border-b border-ds-border py-2 font-semibold">Status</th>
              <th className="border-b border-ds-border py-2 font-semibold">Owner</th>
              <th className="border-b border-ds-border py-2 text-right font-semibold">Hours</th>
              <th className="border-b border-ds-border py-2 text-right font-semibold">Total</th>
              <th className="border-b border-ds-border py-2 pl-3 font-semibold">Issued</th>
            </tr>
          </thead>
          <tbody>
            {list.map((o) => {
              const p = projects.find((x) => x.id === o.projectId);
              const c = clients.find((x) => x.id === p?.clientId);
              const owner = users.find((u) => u.id === o.ownerId);
              const t = offerTotals(o);
              return (
                <tr key={o.id} className="hover:bg-ds-surface-hovered">
                  <td className="border-b border-ds-border py-2 pr-3"><Link href={`/projects/${p?.key}/offers/${o.id}`} className="font-medium text-ds-link hover:underline">{o.number}</Link></td>
                  <td className="border-b border-ds-border py-2 pr-3"><Link href={`/projects/${p?.key}/offers/${o.id}`} className="hover:underline">{o.title}</Link></td>
                  <td className="border-b border-ds-border py-2 pr-3">
                    {p && (
                      <span className="flex items-center gap-2">
                        <ProjectAvatar name={p.name} color={p.color} size={16} />
                        <span>{c ? <Link href={`/clients/${c.id}`} className="hover:underline">{c.name}</Link> : <span className="text-ds-text-subtlest">No client</span>} <span className="text-ds-text-subtlest">/</span> <Link href={`/projects/${p.key}/offers`} className="hover:underline">{p.name}</Link></span>
                      </span>
                    )}
                  </td>
                  <td className="border-b border-ds-border py-2 pr-3"><OfferStatusLozenge status={o.status} /></td>
                  <td className="border-b border-ds-border py-2 pr-3"><span className="flex items-center gap-2"><Avatar user={owner} size="xs" /> {owner?.name}</span></td>
                  <td className="tabular-nums border-b border-ds-border py-2 text-right">{t.hours}h</td>
                  <td className="tabular-nums border-b border-ds-border py-2 text-right font-semibold">{formatMoney(t.total, settings.currency)}</td>
                  <td className="border-b border-ds-border py-2 pl-3 text-ds-text-subtle">{format(parseISO(o.issueDate), "d MMM yyyy")}</td>
                </tr>
              );
            })}
            {list.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-ds-text-subtlest">No offers match the filters.</td></tr>}
          </tbody>
        </table>
      </Page>
    </>
  );
}
