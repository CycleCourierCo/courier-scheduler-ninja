import { describe, it, expect } from "vitest";
import { normaliseStops, shouldSendPosition, navigateUrl } from "./stops";

describe("driver app rules", () => {
  it("lists only pickup/delivery stops with an order, in planned order", () => {
    const s = normaliseStops([
      { order: 3, type: "delivery", orderId: "c" },
      { order: 0, type: "depot" },
      { order: 1, type: "pickup", orderId: "a" },
      { order: 2, type: "pickup" },
    ]);
    expect(s.map((x) => x.orderId)).toEqual(["a", "c"]);
  });

  it("sends location no more than every 90 seconds", () => {
    expect(shouldSendPosition(null, 1000)).toBe(true);
    expect(shouldSendPosition(0, 89_999)).toBe(false);
    expect(shouldSendPosition(0, 90_000)).toBe(true);
  });

  it("navigates to coordinates when known", () => {
    expect(navigateUrl({ order: 1, type: "pickup", lat: 51.5, lon: -0.1 })).toContain("destination=51.5,-0.1");
  });
});
