import { describe, it, expect } from "vitest";
import { compareStops, summarise, suggestSavedRoute, milesDifference } from "./routeReport";

const planned = [
  { orderId: "a", type: "pickup", estimatedTime: "09:00" },
  { orderId: "b", type: "delivery", estimatedTime: "10:00" },
];

describe("route report", () => {
  it("marks planned stops on the timeslip as done and others as missed", () => {
    const rows = compareStops(planned, [{ order_id: "a", type: "pickup" }]);
    expect(rows.map((r) => r.outcome)).toEqual(["done", "missed"]);
  });
  it("lists timeslip stops that weren't planned as extra", () => {
    const rows = compareStops(planned, [{ order_id: "c", type: "delivery" }]);
    expect(summarise(rows)).toMatchObject({ planned: 2, done: 0, missed: 2, extra: 1 });
  });
  it("works out lateness from planned vs tracked arrival", () => {
    const rows = compareStops(planned, [], { "a:pickup": "09:25" });
    expect(rows[0].lateMinutes).toBe(25);
    expect(rows[0].outcome).toBe("done");
  });
  it("suggests the saved route sharing most orders", () => {
    expect(suggestSavedRoute(["a", "b"], [{ id: "r1", stops: [{ orderId: "a" }] }, { id: "r2", stops: [{ orderId: "a" }, { orderId: "b" }] }])).toBe("r2");
    expect(suggestSavedRoute(["z"], [{ id: "r1", stops: [{ orderId: "a" }] }])).toBeNull();
  });
  it("gives miles difference actual minus planned", () => {
    expect(milesDifference(100, 112.34)).toBe(12.3);
  });
});
