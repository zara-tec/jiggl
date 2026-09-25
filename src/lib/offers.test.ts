import { describe, expect, it } from "vitest";
import { OFFER_STATUS_META, OFFER_TRANSITIONS, OPEN_OFFER_STATUSES, defaultLineHours, isOrder, lineAmount, nextOfferNumber, offerTotals } from "./offers";
import type { OfferStatus } from "./types";
import { makeLine, makeOffer } from "@/test/fixtures";

const STATUSES = Object.keys(OFFER_STATUS_META) as OfferStatus[];

describe("line maths", () => {
  it("lineAmount is qty x unit price", () => {
    expect(lineAmount(makeLine({ id: "l", qty: 3, unitPrice: 400 }))).toBe(1200);
    expect(lineAmount(makeLine({ id: "l", qty: 0, unitPrice: 400 }))).toBe(0);
  });

  it("defaultLineHours follows the unit", () => {
    expect(defaultLineHours({ qty: 5, unit: "hours" }, { hoursPerDay: 8 })).toBe(5);
    expect(defaultLineHours({ qty: 2, unit: "days" }, { hoursPerDay: 8 })).toBe(16);
    expect(defaultLineHours({ qty: 2, unit: "days" }, { hoursPerDay: 0 })).toBe(16);
    expect(defaultLineHours({ qty: 1, unit: "flat" }, { hoursPerDay: 8 })).toBe(0);
    expect(defaultLineHours({ qty: 10, unit: "item" }, { hoursPerDay: 8 })).toBe(0);
  });

  it("offerTotals applies the discount and sums hours", () => {
    const offer = makeOffer({
      id: "o",
      discountPct: 10,
      lines: [makeLine({ id: "a", qty: 2, unitPrice: 500, hours: 16 }), makeLine({ id: "b", qty: 1, unit: "flat", unitPrice: 1000, hours: 0 })],
    });
    expect(offerTotals(offer)).toEqual({ subtotal: 2000, discount: 200, total: 1800, hours: 16 });
    expect(offerTotals({ ...offer, discountPct: undefined }).total).toBe(2000);
    expect(offerTotals(makeOffer({ id: "empty" }))).toEqual({ subtotal: 0, discount: 0, total: 0, hours: 0 });
  });
});

describe("status model", () => {
  it("has metadata and transitions for every status", () => {
    expect(Object.keys(OFFER_TRANSITIONS).sort()).toEqual([...STATUSES].sort());
  });

  it("only points to known statuses and never back to itself", () => {
    for (const [from, targets] of Object.entries(OFFER_TRANSITIONS)) {
      for (const to of targets) {
        expect(STATUSES).toContain(to);
        expect(to).not.toBe(from);
      }
    }
  });

  it("an order is final and can only be reached by converting", () => {
    expect(OFFER_TRANSITIONS.ordered).toEqual([]);
    for (const targets of Object.values(OFFER_TRANSITIONS)) expect(targets).not.toContain("ordered");
  });

  it("open statuses are the ones still in play", () => {
    expect(OPEN_OFFER_STATUSES).toEqual(["draft", "sent", "accepted"]);
  });

  it("isOrder is true only for orders", () => {
    for (const status of STATUSES) expect(isOrder(makeOffer({ id: "o", status }))).toBe(status === "ordered");
  });
});

describe("nextOfferNumber", () => {
  it("prefixes the project key", () => {
    expect(nextOfferNumber("JIG", 3)).toBe("JIG-O3");
  });
});
