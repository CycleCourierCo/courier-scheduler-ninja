import { describe, it, expect } from "vitest";
import { classifySameDay, summariseSameDay } from "./sameDayAnalytics";

const base = { id: "1", status: "delivered", scheduledPickupDate: "2026-04-14T09:00:00Z", scheduledDeliveryDate: "2026-04-14T15:00:00Z", pickupId: "P", deliveryId: "D" };

describe("same-day analytics", () => {
  it("ignores jobs collected and delivered on different days", () => {
    expect(classifySameDay({ ...base, scheduledDeliveryDate: "2026-04-15T10:00:00Z" })).toBeNull();
  });
  it("delivered on the planned day with no failures is a success", () => {
    const r = classifySameDay({ ...base, updates: [
      { event: "ORDER_COMPLETED", orderId: "P", timestamp: "2026-04-14T10:00:00Z" },
      { event: "ORDER_COMPLETED", orderId: "D", timestamp: "2026-04-14T14:00:00Z" },
    ] })!;
    expect(r.outcome).toBe("success");
    expect(r.turnaroundHours).toBe(4);
  });
  it("a failed collection attempt counts as a failure even if later delivered", () => {
    const r = classifySameDay({ ...base, updates: [{ event: "ORDER_FAILED", orderId: "P", timestamp: "2026-04-14T10:00:00Z" }] })!;
    expect(r.outcome).toBe("failed_collection");
    expect(r.failedCollections).toBe(1);
  });
  it("delivered a day late with no failure is slipped", () => {
    const r = classifySameDay({ ...base, updates: [{ event: "ORDER_COMPLETED", orderId: "D", timestamp: "2026-04-15T10:00:00Z" }] })!;
    expect(r.outcome).toBe("slipped");
  });
  it("success rate excludes cancelled and in-progress jobs", () => {
    const rows = [
      classifySameDay(base)!,
      classifySameDay({ ...base, id: "2", updates: [{ event: "ORDER_FAILED", orderId: "D" }] })!,
      classifySameDay({ ...base, id: "3", status: "cancelled" })!,
      classifySameDay({ ...base, id: "4", status: "scheduled" })!,
    ];
    const s = summariseSameDay(rows);
    expect(s.finished).toBe(2);
    expect(s.successRate).toBe(50);
  });
});
