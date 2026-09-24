"use client";

import * as React from "react";
import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { FileText, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { useProjectByKey, useProjectOffers } from "@/hooks/useData";
import { OPEN_OFFER_STATUSES, offerTotals } from "@/lib/offers";
import { formatDays, formatMoney } from "@/lib/rates";
import { Page } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/misc";
import { OfferStatusLozenge } from "@/components/offers/meta";
import { StatTile } from "@/components/reports/charts";

export default function ProjectOffersPage({ params }: PageProps<"/projects/[key]/offers">) {
  const { key } = use(params);
  const project = useProjectByKey(key);
  const offers = useProjectOffers(project?.id);
  const users = useStore((s) => s.users);
  const settings = useStore((s) => s.settings);
  const createOffer = useStore((s) => s.createOffer);
  const router = useRouter();
  if (!project) return null;

  const ordered = offers.filter((o) => o.status === "ordered");
  const pipeline = offers.filter((o) => OPEN_OFFER_STATUSES.includes(o.status));
  const sum = (list: typeof offers) => list.reduce((a, o) => a + offerTotals(o).total, 0);
  const hours = (list: typeof offers) => list.reduce((a, o) => a + offerTotals(o).hours, 0);

  const create = () => {
    const o = createOffer(project.id, { title: `${project.name} offer` });
    router.push(`/projects/${project.key}/offers/${o.id}`);
  };

  return (
    <Page>
      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-ds-text-subtle">Offers are the sold side of the budget. Once converted into an order, each line becomes a work item whose tracked time is compared with what was sold.</p>
        <Button appearance="primary" iconBefore={<Plus />} onClick={create} className="shrink-0">
          Create offer
        </Button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Ordered" value={formatMoney(sum(ordered), settings.currency)} hint={`${ordered.length} order${ordered.length === 1 ? "" : "s"} · ${formatDays(hours(ordered) * 3600, settings)}`} />
        <StatTile label="Pipeline" value={formatMoney(sum(pipeline), settings.currency)} hint={`${pipeline.length} open offer${pipeline.length === 1 ? "" : "s"}`} />
        <StatTile label="Sold hours" value={`${hours(ordered)}h`} hint={formatDays(hours(ordered) * 3600, settings)} />
        <StatTile label="Pricing" value={project.pricing === "tm" ? "T&M" : "Fixed"} hint={project.pricing === "tm" ? "Orders are ceilings" : "Orders are the revenue"} />
      </div>

      {offers.length === 0 ? (
        <EmptyState icon={<FileText />} title="No offers yet" description="Create an offer, add its lines, send it to the client and convert it into an order when accepted." action={<Button appearance="primary" onClick={create}>Create offer</Button>} />
      ) : (
        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ds-text-subtle">
              <th className="border-b border-ds-border py-2 font-semibold">Number</th>
              <th className="border-b border-ds-border py-2 font-semibold">Title</th>
              <th className="border-b border-ds-border py-2 font-semibold">Status</th>
              <th className="border-b border-ds-border py-2 font-semibold">Owner</th>
              <th className="border-b border-ds-border py-2 text-right font-semibold">Lines</th>
              <th className="border-b border-ds-border py-2 text-right font-semibold">Hours</th>
              <th className="border-b border-ds-border py-2 text-right font-semibold">Total</th>
              <th className="border-b border-ds-border py-2 font-semibold">Issued</th>
              <th className="border-b border-ds-border py-2 font-semibold">Valid until</th>
            </tr>
          </thead>
          <tbody>
            {offers.map((o) => {
              const t = offerTotals(o);
              const owner = users.find((u) => u.id === o.ownerId);
              return (
                <tr key={o.id} className="hover:bg-ds-surface-hovered">
                  <td className="border-b border-ds-border py-2 pr-3"><Link href={`/projects/${project.key}/offers/${o.id}`} className="font-medium text-ds-link hover:underline">{o.number}</Link></td>
                  <td className="border-b border-ds-border py-2 pr-3"><Link href={`/projects/${project.key}/offers/${o.id}`} className="hover:underline">{o.title}</Link></td>
                  <td className="border-b border-ds-border py-2 pr-3"><OfferStatusLozenge status={o.status} /></td>
                  <td className="border-b border-ds-border py-2 pr-3"><span className="flex items-center gap-2"><Avatar user={owner} size="xs" /> {owner?.name}</span></td>
                  <td className="tabular-nums border-b border-ds-border py-2 text-right">{o.lines.length}</td>
                  <td className="tabular-nums border-b border-ds-border py-2 text-right">{t.hours}h</td>
                  <td className="tabular-nums border-b border-ds-border py-2 text-right font-semibold">{formatMoney(t.total, settings.currency)}</td>
                  <td className="border-b border-ds-border py-2 pl-3 text-ds-text-subtle">{format(parseISO(o.issueDate), "d MMM yyyy")}</td>
                  <td className="border-b border-ds-border py-2 text-ds-text-subtle">{o.validUntil ? format(parseISO(o.validUntil), "d MMM yyyy") : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Page>
  );
}
