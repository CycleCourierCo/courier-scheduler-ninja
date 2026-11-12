import { describe, it, expect } from "vitest";
import { isInspectionOrderCollected, getInspectionCollectedAt } from "./inspectionCollection";

describe("inspection collection state", () => {
  it("treats a bike marked collected as collected even with no collection email sent", () => {
    const o = { order_collected: true, status: "scheduled_dates_pending", collection_confirmation_sent_at: null, updated_at: "2026-11-11T10:00:00Z" };
    expect(isInspectionOrderCollected(o)).toBe(true);
    expect(getInspectionCollectedAt(o)).toBe("2026-11-11T10:00:00Z");
  });

  it("leaves a bike that has not been picked up as awaiting collection", () => {
    const o = { order_collected: false, status: "scheduled", collection_confirmation_sent_at: null };
    expect(isInspectionOrderCollected(o)).toBe(false);
    expect(getInspectionCollectedAt(o)).toBeNull();
  });

  it("prefers the collection email time when it exists", () => {
    const o = { order_collected: true, collection_confirmation_sent_at: "2026-11-10T09:00:00Z", updated_at: "2026-11-11T10:00:00Z" };
    expect(getInspectionCollectedAt(o)).toBe("2026-11-10T09:00:00Z");
  });
});
