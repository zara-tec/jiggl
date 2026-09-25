"use client";

import * as React from "react";
import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, MoreHorizontal, Trash2, FileText } from "lucide-react";
import { useStore } from "@/lib/store";
import { useOffer, useProjectByKey } from "@/hooks/useData";
import type { OfferStatus } from "@/lib/types";
import { OFFER_STATUS_META, isOrder, offerTotals } from "@/lib/offers";
import { currentForecast } from "@/lib/forecast";
import { formatDays, formatMoney } from "@/lib/rates";
import { cn, relativeTime } from "@/lib/utils";
import { Button, IconButton } from "@/components/ui/Button";
import { DropdownMenu, MenuItem } from "@/components/ui/Popover";
import { EmptyState, InlineEdit, SectionMessage, Tabs } from "@/components/ui/misc";
import { Badge } from "@/components/ui/Lozenge";
import { UserSelect } from "@/components/issues/fields";
import { OfferStatusButton } from "@/components/offers/meta";
import { OfferLinesTable } from "@/components/offers/OfferLinesTable";
import { ForecastMatrix } from "@/components/offers/ForecastMatrix";
import { BaselinesPanel } from "@/components/offers/BaselinesPanel";
import { ConvertOfferModal } from "@/components/offers/ConvertOfferModal";
import { StatTile } from "@/components/reports/charts";

type Tab = "lines" | "forecast" | "baselines";

export default function OfferPage({ params }: PageProps<"/projects/[key]/offers/[offerId]">) {
  const { key, offerId } = use(params);
  const project = useProjectByKey(key);
  const offer = useOffer(offerId);
  const settings = useStore((s) => s.settings);
  const users = useStore((s) => s.users);
  const baselines = useStore((s) => s.offerBaselines);
  const update = useStore((s) => s.updateOffer);
  const setStatus = useStore((s) => s.setOfferStatus);
  const remove = useStore((s) => s.deleteOffer);
  const router = useRouter();
  const [convertOpen, setConvertOpen] = React.useState(false);
  const [tab, setTab] = React.useState<Tab>("lines");
  const forecast = React.useMemo(() => (offer && project ? currentForecast(offer, users, project) : undefined), [offer, users, project]);

  if (!project) return null;
  if (!offer || offer.projectId !== project.id || !forecast) {
    return <EmptyState icon={<FileText />} title="Offer not found" action={<Link href={`/projects/${project.key}/offers`}><Button>Back to offers</Button></Link>} />;
  }

  const order = isOrder(offer);
  const totals = offerTotals(offer);
  const unconverted = offer.lines.filter((l) => !l.issueId).length;
  const baselineCount = baselines.filter((b) => b.offerId === offer.id).length;
  const cur = settings.currency;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-page pb-10">
      <nav className="mt-3 flex items-center gap-1 text-sm text-ds-text-subtle">
        <Link href={`/projects/${project.key}/offers`} className="hover:text-ds-link hover:underline">Offers</Link>
        <span className="text-ds-text-subtlest">/</span>
        <span className="flex items-center gap-1.5"><FileText size={14} className="text-ds-icon" /> {offer.number}</span>
      </nav>

      <div className="mt-1 flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <InlineEdit as="h1" value={offer.title} onSave={(v) => v && update(offer.id, { title: v })} className="ds-heading-xl -mx-1.5 px-1.5 py-1" inputClassName="ds-heading-xl py-1" />
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-1">
          <OfferStatusButton status={offer.status} onChange={(s: OfferStatus) => setStatus(offer.id, s)} />
          {(offer.status === "accepted" || order) && unconverted > 0 && (
            <Button appearance="primary" iconBefore={<ArrowRightLeft />} onClick={() => setConvertOpen(true)}>
              {order ? `Create ${unconverted} work item${unconverted === 1 ? "" : "s"}` : "Convert to order"}
            </Button>
          )}
          <DropdownMenu align="end" trigger={({ ref, toggle }) => <IconButton ref={ref} icon={<MoreHorizontal />} label="Actions" onClick={toggle} />}>
            {({ close }) => (
              <>
                {!order && (
                  <MenuItem icon={<Trash2 />} className="text-ds-text-danger" onClick={() => { close(); if (confirm(`Delete ${offer.number}?`)) { remove(offer.id); router.push(`/projects/${project.key}/offers`); } }}>
                    Delete offer
                  </MenuItem>
                )}
                {order && <MenuItem isDisabled>Orders cannot be deleted</MenuItem>}
              </>
            )}
          </DropdownMenu>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-8 2xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          {order && (
            <SectionMessage appearance="success" title="This offer is an order">
              Lines and forecast stay editable: the order baseline keeps what was agreed, and the Baselines tab shows what changed since.
              {unconverted > 0 && ` ${unconverted} line${unconverted === 1 ? " has" : "s have"} no work item yet.`}
            </SectionMessage>
          )}
          {offer.status === "accepted" && unconverted > 0 && (
            <SectionMessage appearance="discovery" title="Accepted by the client">
              Convert it into an order to create {unconverted} work item{unconverted === 1 ? "" : "s"} in {project.name}.
            </SectionMessage>
          )}
          {(offer.status === "draft" || offer.status === "sent") && (
            <p className="text-sm text-ds-text-subtle">Planned dates of these lines are shown on the project timeline as planned bars until the offer becomes an order.</p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatTile label="Total" value={formatMoney(totals.total, cur)} hint={(offer.discountPct ?? 0) > 0 ? `after ${offer.discountPct}% discount` : undefined} />
            <StatTile label="Sold effort" value={`${totals.hours}h`} hint={formatDays(totals.hours * 3600, settings)} />
            <StatTile
              label="Forecast"
              value={forecast.hours ? <span className={cn(forecast.hours > totals.hours && "text-ds-text-danger")}>{Math.round(forecast.hours * 10) / 10}h</span> : "—"}
              hint={forecast.hours ? `${formatMoney(forecast.cost, cur)} cost${forecast.unsoldHours ? ` · ${Math.round(forecast.unsoldHours * 10) / 10}h unsold` : ""}` : "No forecast yet"}
            />
            <StatTile
              label="Expected margin"
              value={forecast.hours ? <span className={cn(forecast.margin < 0 && "text-ds-text-danger")}>{formatMoney(forecast.margin, cur)}</span> : "—"}
              hint={forecast.hours ? `${forecast.marginPct}% · ${project.pricing === "tm" ? "forecast billing" : "total"} minus forecast cost` : "Forecast cost against the sold amount"}
            />
            <StatTile label="Lines" value={offer.lines.length} hint={order ? `${offer.lines.filter((l) => l.issueId).length} converted` : `${offer.lines.filter((l) => l.issueType === "epic").length} epics on conversion`} />
          </div>

          <Tabs
            className="mt-6"
            value={tab}
            onChange={(id) => setTab(id as Tab)}
            tabs={[
              { id: "lines", label: "Lines", badge: <Badge>{offer.lines.length}</Badge> },
              { id: "forecast", label: "Forecast", badge: forecast.hours ? <Badge>{Math.round(forecast.hours)}h</Badge> : undefined },
              { id: "baselines", label: "Baselines", badge: baselineCount ? <Badge>{baselineCount}</Badge> : undefined },
            ]}
          />
          <div className="mt-4">
            {tab === "lines" && (
              <>
                <OfferLinesTable offer={offer} editable />
                <h3 className="ds-heading-sm mb-2 mt-6">Notes</h3>
                <InlineEdit value={offer.notes ?? ""} onSave={(v) => update(offer.id, { notes: v || undefined })} placeholder="Terms, assumptions, exclusions..." multiline className="-mx-1.5 min-h-8 px-1.5 py-1 text-sm" />
              </>
            )}
            {tab === "forecast" && <ForecastMatrix offer={offer} project={project} />}
            {tab === "baselines" && <BaselinesPanel offer={offer} project={project} />}
          </div>
        </div>

        <aside>
          <div className="rounded-ds border border-ds-border">
            <div className="flex h-10 items-center px-3 text-sm font-semibold">Details</div>
            <div className="space-y-1 border-t border-ds-border px-3 py-3">
              <Row label="Status"><div className="px-1.5 py-1.5 text-sm">{OFFER_STATUS_META[offer.status].name}<span className="block text-xs text-ds-text-subtlest">{OFFER_STATUS_META[offer.status].description}</span></div></Row>
              <Row label="Owner"><UserSelect value={offer.ownerId} onChange={(v) => v && update(offer.id, { ownerId: v })} /></Row>
              <Row label="Project"><Link href={`/projects/${project.key}/summary`} className="block px-1.5 py-1.5 text-sm hover:underline">{project.name}<span className="block text-xs text-ds-text-subtlest">{project.pricing === "tm" ? "Time & material" : "Fixed price"}</span></Link></Row>
              <Row label="Issue date"><input type="date" value={offer.issueDate} onChange={(e) => update(offer.id, { issueDate: e.target.value })} className="ds-inline-edit h-8 w-full bg-transparent px-1.5 text-sm outline-none" /></Row>
              <Row label="Valid until"><input type="date" value={offer.validUntil ?? ""} onChange={(e) => update(offer.id, { validUntil: e.target.value || undefined })} className="ds-inline-edit h-8 w-full bg-transparent px-1.5 text-sm outline-none" /></Row>
              <Row label="Discount %"><input value={offer.discountPct ?? ""} inputMode="decimal" placeholder="0" onChange={(e) => update(offer.id, { discountPct: e.target.value ? Number(e.target.value.replace(",", ".")) : undefined })} className="ds-inline-edit h-8 w-full bg-transparent px-1.5 text-sm outline-none placeholder:text-ds-text-subtlest" /></Row>
              <Row label="Subtotal"><div className="tabular-nums px-1.5 py-1.5 text-sm">{formatMoney(totals.subtotal, cur)}</div></Row>
            </div>
          </div>
          <div className="mt-3 space-y-0.5 px-1 text-xs text-ds-text-subtlest">
            <div>Created {relativeTime(offer.createdAt)}</div>
            <div>Updated {relativeTime(offer.updatedAt)}</div>
            {offer.sentAt && <div>Sent {relativeTime(offer.sentAt)}</div>}
            {offer.acceptedAt && <div>Accepted {relativeTime(offer.acceptedAt)}</div>}
            {offer.orderedAt && <div>Ordered {relativeTime(offer.orderedAt)}</div>}
          </div>
        </aside>
      </div>

      <ConvertOfferModal open={convertOpen} onClose={() => setConvertOpen(false)} offer={offer} />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_1fr] items-start gap-2">
      <div className="pt-2 text-xs font-semibold text-ds-text-subtle">{label}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
