import { describe, it, expect } from "vitest";
import { hasBeenCollected, hasBeenDelivered } from "./depotPresence";

describe("depot presence", () => {
  it("counts a collected bike whose status moved on to delivery scheduling as collected", () => {
    const order = { status: "scheduled_dates_pending", orderCollected: true } as any;
    expect(hasBeenCollected(order)).toBe(true);
    expect(hasBeenDelivered(order)).toBe(false);
  });

  it("does not count an uncollected bike awaiting dates as collected", () => {
    expect(hasBeenCollected({ status: "scheduled_dates_pending", orderCollected: false } as any)).toBe(false);
  });

  it("treats the delivered flag as the bike having left the depot", () => {
    expect(hasBeenDelivered({ status: "driver_to_delivery", orderDelivered: true } as any)).toBe(true);
  });

  it("treats ferry hand-off as having left the depot", () => {
    expect(hasBeenDelivered({ status: "delivered_to_ferry" } as any)).toBe(true);
  });
});
