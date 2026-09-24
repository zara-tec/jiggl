"use client";

import * as React from "react";
import { use } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Building2, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { useNow } from "@/hooks/useHydrated";
import { OPEN_OFFER_STATUSES, offerTotals } from "@/lib/offers";
import { formatDays, formatMoney, marginPct, valueEntries } from "@/lib/rates";
import { formatDurationShort } from "@/lib/utils";
import { Page } from "@/components/layout/AppShell";
import { EmptyState, InlineEdit, PageHeader, Tabs } from "@/components/ui/misc";
import { Button } from "@/components/ui/Button";
import { Avatar, ProjectAvatar } from "@/components/ui/Avatar";
import { Lozenge } from "@/components/ui/Lozenge";
import { OfferStatusLozenge, PROJECT_STATUS_META } from "@/components/offers/meta";
import { StatTile, ChartCard, HBars } from "@/components/reports/charts";
import { TimeEntriesList } from "@/components/time/TimeEntriesList";
import { CreateProjectModal } from "@/app/projects/page";
import { useEffectiveEntries } from "@/hooks/useData";

export default function ClientPage({ params }: PageProps<"/clients/[clientId]">) {
  const { clientId } = use(params);
  const client = useStore((s) => s.clients.find((c) => c.id === clientId));
  const projects = useStore((s) => s.projects);
  const offers = useStore((s) => s.offers);
  const issues = useStore((s) => s.issues);
  const users = useStore((s) => s.users);
  const entries = useEffectiveEntries();
  const settings = useStore((s) => s.settings);
  const updateClient = useStore((s) => s.updateClient);
  const now = useNow(1000, entries.some((e) => !e.stop));
  const [tab, setTab] = React.useState("overview");
  const [createOpen, setCreateOpen] = React.useState(false);

  if (!client) return <EmptyState icon={<Building2 />} title="Client not found" action={<Link href="/clients"><Button>Back to clients</Button></Link>} />;

  const cProjects = projects.filter((p) => p.clientId === client.id);
  const cOffers = offers.filter((o) => cProjects.some((p) => p.id === o.projectId)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const cEntries = entries.filter((e) => cProjects.some((p) => p.id === e.projectId));
  const value = valueEntries(cEntries, users, projects, now);
  const ordered = cOffers.filter((o) => o.status === "ordered");
  const pipeline = cOffers.filter((o) => OPEN_OFFER_STATUSES.includes(o.status));
  const sum = (l: typeof offers) => l.reduce((a, o) => a + offerTotals(o).total, 0);
  const soldHours = ordered.reduce((a, o) => a + offerTotals(o).hours, 0);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Clients", href: "/clients" }, { label: client.name }]}
        title={
          <span className="flex items-center gap-3">
            <span className="inline-flex size-8 items-center justify-center rounded-ds bg-ds-neutral text-ds-icon"><Building2 size={18} /></span>
            <InlineEdit value={client.name} onSave={(v) => v && updateClient(client.id, { name: v })} className="-mx-1.5 px-1.5" as="span" />
            {client.archived && <Lozenge>Archived</Lozenge>}
          </span>
        }
        actions={<Button appearance="primary" iconBefore={<Plus />} onClick={() => setCreateOpen(true)}>Create project</Button>}
      >
        <Tabs
          value={tab}
          onChange={setTab}
          className="mt-2"
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "projects", label: "Projects", badge: <span className="rounded-lg bg-ds-neutral px-1.5 text-[11px] font-semibold text-ds-text-subtle">{cProjects.length}</span> },
            { id: "offers", label: "Offers", badge: <span className="rounded-lg bg-ds-neutral px-1.5 text-[11px] font-semibold text-ds-text-subtle">{cOffers.length}</span> },
            { id: "time", label: "Time" },
          ]}
        />
      </PageHeader>
      <Page>
        {tab === "overview" && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-5">
              <StatTile label="Ordered" value={formatMoney(sum(ordered), settings.currency)} hint={`${ordered.length} orders · ${formatDays(soldHours * 3600, settings)} sold`} />
              <StatTile label="Pipeline" value={formatMoney(sum(pipeline), settings.currency)} hint={`${pipeline.length} open offers`} />
              <StatTile label="Tracked" value={formatDurationShort(value.seconds)} hint={formatDays(value.seconds, settings)} />
              <StatTile label="Cost" value={formatMoney(value.cost, settings.currency)} hint="All hours x cost rate" />
              <StatTile label="Revenue" value={formatMoney(value.revenue, settings.currency)} hint={`${marginPct(value.revenue, value.cost)}% margin on billable hours`} />
            </div>
            <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
              <ChartCard title="Projects" subtitle="Sold vs tracked hours per project.">
                {cProjects.length === 0 && <div className="text-sm text-ds-text-subtlest">No projects yet.</div>}
                <div className="space-y-3">
                  {cProjects.map((p) => {
                    const pOrders = offers.filter((o) => o.projectId === p.id && o.status === "ordered");
                    const sold = pOrders.reduce((a, o) => a + offerTotals(o).hours, 0) * 3600;
                    const tracked = entries.filter((e) => e.projectId === p.id).reduce((a, e) => a + (e.stop ? (new Date(e.stop).getTime() - new Date(e.start).getTime()) / 1000 : 0), 0);
                    return (
                      <div key={p.id}>
                        <div className="mb-1 flex items-center gap-2 text-sm">
                          <ProjectAvatar name={p.name} color={p.color} size={16} />
                          <Link href={`/projects/${p.key}/offers`} className="font-medium hover:underline">{p.name}</Link>
                          <Lozenge appearance={PROJECT_STATUS_META[p.status].appearance}>{PROJECT_STATUS_META[p.status].name}</Lozenge>
                          <span className="ml-auto text-xs text-ds-text-subtlest">{formatDurationShort(tracked)} tracked{sold ? ` of ${sold / 3600}h sold` : ""}</span>
                        </div>
                        <HBars rows={[{ id: p.id, label: <span className="text-xs">{sold ? `${Math.round((tracked / sold) * 100)}% consumed` : "no order"}</span>, value: tracked, color: sold && tracked > sold ? "var(--ds-chart-red)" : p.color }]} format={() => ""} labelWidth={110} />
                      </div>
                    );
                  })}
                </div>
              </ChartCard>
              <ChartCard title="Recent offers">
                <ul className="divide-y divide-ds-border">
                  {cOffers.slice(0, 6).map((o) => {
                    const p = projects.find((x) => x.id === o.projectId)!;
                    return (
                      <li key={o.id} className="flex items-center gap-3 py-2 text-sm">
                        <Link href={`/projects/${p.key}/offers/${o.id}`} className="w-20 shrink-0 font-medium text-ds-link hover:underline">{o.number}</Link>
                        <span className="min-w-0 flex-1 truncate">{o.title}</span>
                        <OfferStatusLozenge status={o.status} />
                        <span className="tabular-nums w-20 text-right font-semibold">{formatMoney(offerTotals(o).total, settings.currency)}</span>
                      </li>
                    );
                  })}
                  {cOffers.length === 0 && <li className="py-3 text-sm text-ds-text-subtlest">No offers yet.</li>}
                </ul>
              </ChartCard>
            </div>
          </>
        )}

        {tab === "projects" && (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ds-text-subtle">
                <th className="border-b border-ds-border py-2 font-semibold">Project</th>
                <th className="border-b border-ds-border py-2 font-semibold">Status</th>
                <th className="border-b border-ds-border py-2 font-semibold">Pricing</th>
                <th className="border-b border-ds-border py-2 font-semibold">Lead</th>
                <th className="border-b border-ds-border py-2 text-right font-semibold">Orders</th>
                <th className="border-b border-ds-border py-2 text-right font-semibold">Open items</th>
                <th className="border-b border-ds-border py-2 text-right font-semibold">Tracked</th>
              </tr>
            </thead>
            <tbody>
              {cProjects.map((p) => {
                const lead = users.find((u) => u.id === p.leadId);
                const pOrders = offers.filter((o) => o.projectId === p.id && o.status === "ordered");
                const tracked = valueEntries(entries.filter((e) => e.projectId === p.id), users, projects, now);
                return (
                  <tr key={p.id} className="hover:bg-ds-surface-hovered">
                    <td className="border-b border-ds-border py-2 pr-3"><Link href={`/projects/${p.key}/summary`} className="flex items-center gap-2 font-medium text-ds-link hover:underline"><ProjectAvatar name={p.name} color={p.color} size={20} /> {p.name} <span className="text-xs font-normal text-ds-text-subtlest">{p.key}</span></Link></td>
                    <td className="border-b border-ds-border py-2 pr-3"><Lozenge appearance={PROJECT_STATUS_META[p.status].appearance}>{PROJECT_STATUS_META[p.status].name}</Lozenge></td>
                    <td className="border-b border-ds-border py-2 pr-3 text-ds-text-subtle">{p.pricing === "tm" ? "Time & material" : "Fixed price"}</td>
                    <td className="border-b border-ds-border py-2 pr-3"><span className="flex items-center gap-2"><Avatar user={lead} size="xs" /> {lead?.name}</span></td>
                    <td className="tabular-nums border-b border-ds-border py-2 text-right">{formatMoney(sum(pOrders), settings.currency)}</td>
                    <td className="tabular-nums border-b border-ds-border py-2 text-right">{issues.filter((i) => i.projectId === p.id && i.status !== "done" && i.type !== "epic").length}</td>
                    <td className="tabular-nums border-b border-ds-border py-2 text-right">{formatDurationShort(tracked.seconds)}</td>
                  </tr>
                );
              })}
              {cProjects.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-ds-text-subtlest">No projects for this client yet.</td></tr>}
            </tbody>
          </table>
        )}

        {tab === "offers" && (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ds-text-subtle">
                <th className="border-b border-ds-border py-2 font-semibold">Number</th>
                <th className="border-b border-ds-border py-2 font-semibold">Title</th>
                <th className="border-b border-ds-border py-2 font-semibold">Project</th>
                <th className="border-b border-ds-border py-2 font-semibold">Status</th>
                <th className="border-b border-ds-border py-2 text-right font-semibold">Hours</th>
                <th className="border-b border-ds-border py-2 text-right font-semibold">Total</th>
                <th className="border-b border-ds-border py-2 pl-3 font-semibold">Issued</th>
              </tr>
            </thead>
            <tbody>
              {cOffers.map((o) => {
                const p = projects.find((x) => x.id === o.projectId)!;
                const t = offerTotals(o);
                return (
                  <tr key={o.id} className="hover:bg-ds-surface-hovered">
                    <td className="border-b border-ds-border py-2 pr-3"><Link href={`/projects/${p.key}/offers/${o.id}`} className="font-medium text-ds-link hover:underline">{o.number}</Link></td>
                    <td className="border-b border-ds-border py-2 pr-3">{o.title}</td>
                    <td className="border-b border-ds-border py-2 pr-3 text-ds-text-subtle">{p.name}</td>
                    <td className="border-b border-ds-border py-2 pr-3"><OfferStatusLozenge status={o.status} /></td>
                    <td className="tabular-nums border-b border-ds-border py-2 text-right">{t.hours}h</td>
                    <td className="tabular-nums border-b border-ds-border py-2 text-right font-semibold">{formatMoney(t.total, settings.currency)}</td>
                    <td className="border-b border-ds-border py-2 pl-3 text-ds-text-subtle">{format(parseISO(o.issueDate), "d MMM yyyy")}</td>
                  </tr>
                );
              })}
              {cOffers.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-ds-text-subtlest">No offers for this client yet.</td></tr>}
            </tbody>
          </table>
        )}

        {tab === "time" && <TimeEntriesList entries={cEntries.slice().sort((a, b) => b.start.localeCompare(a.start)).slice(0, 120)} showUser className="mt-4" />}
      </Page>
      <CreateProjectModal open={createOpen} onClose={() => setCreateOpen(false)} defaultClientId={client.id} />
    </>
  );
}
