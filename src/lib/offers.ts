import type { LozengeAppearance } from "@/components/ui/Lozenge";
import type { Offer, OfferLine, OfferStatus, OfferUnit, WorkspaceSettings } from "./types";

export const OFFER_STATUS_META: Record<OfferStatus, { name: string; appearance: LozengeAppearance; description: string }> = {
  draft: { name: "Draft", appearance: "default", description: "Being prepared by the PM" },
  sent: { name: "Sent", appearance: "inprogress", description: "Sent to the client, waiting for an answer" },
  accepted: { name: "Accepted", appearance: "new", description: "Accepted by the client, ready to convert" },
  ordered: { name: "Order", appearance: "success", description: "Converted into work items" },
  rejected: { name: "Rejected", appearance: "removed", description: "Declined by the client" },
  expired: { name: "Expired", appearance: "moved", description: "Validity date passed" },
};

export const OFFER_UNITS: { id: OfferUnit; name: string; short: string }[] = [
  { id: "hours", name: "Hours", short: "h" },
  { id: "days", name: "Days", short: "d" },
  { id: "flat", name: "Flat fee", short: "flat" },
  { id: "item", name: "Items", short: "pcs" },
];

/** Allowed status transitions (what the PM can pick from the status menu). */
export const OFFER_TRANSITIONS: Record<OfferStatus, OfferStatus[]> = {
  draft: ["sent", "accepted", "rejected"],
  sent: ["accepted", "rejected", "expired", "draft"],
  accepted: ["sent", "rejected"],
  ordered: [],
  rejected: ["draft"],
  expired: ["draft", "sent"],
};

export const OPEN_OFFER_STATUSES: OfferStatus[] = ["draft", "sent", "accepted"];

export function lineAmount(line: OfferLine) {
  return (line.qty || 0) * (line.unitPrice || 0);
}

/** Default effort for a line from its quantity and unit */
export function defaultLineHours(line: Pick<OfferLine, "qty" | "unit">, settings: Pick<WorkspaceSettings, "hoursPerDay">) {
  if (line.unit === "hours") return line.qty || 0;
  if (line.unit === "days") return (line.qty || 0) * (settings.hoursPerDay || 8);
  return 0;
}

export function offerTotals(offer: Offer) {
  const subtotal = offer.lines.reduce((a, l) => a + lineAmount(l), 0);
  const discount = subtotal * ((offer.discountPct ?? 0) / 100);
  const total = subtotal - discount;
  const hours = offer.lines.reduce((a, l) => a + (l.hours || 0), 0);
  return { subtotal, discount, total, hours };
}

export function isOfferEditable(offer: Offer) {
  return offer.status !== "ordered";
}

export function nextOfferNumber(projectKey: string, counter: number) {
  return `${projectKey}-O${counter}`;
}
