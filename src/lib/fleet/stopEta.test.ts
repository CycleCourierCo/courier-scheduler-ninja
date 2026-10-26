import { describe, it, expect } from "vitest";
import { computeStopEtas, isPositionFresh, wasVisited } from "../../../supabase/functions/_shared/stopEta";

const NOW = Date.parse("2026-10-26T10:00:00Z");

describe("stop ETAs", () => {
  it("adds 15 minutes for every stop before the one being estimated", () => {
    const etas = computeStopEtas([{ seconds: 600, meters: 0 }, { seconds: 600, meters: 0 }, { seconds: 600, meters: 0 }], NOW);
    expect(etas.map((e) => e.minutes)).toEqual([10, 35, 60]);
    expect(etas[2].eta).toBe("2026-10-26T11:00:00.000Z");
  });

  it("refuses a van position older than 15 minutes", () => {
    expect(isPositionFresh(NOW - 14 * 60_000, NOW)).toBe(true);
    expect(isPositionFresh(NOW - 16 * 60_000, NOW)).toBe(false);
  });

  it("counts a stop as reached within 150 m", () => {
    const stop = { lat: 52.4690, lon: -1.8757 };
    expect(wasVisited(stop, [{ lat: 52.4699, lon: -1.8757 }])).toBe(true); // ~100 m
    expect(wasVisited(stop, [{ lat: 52.4710, lon: -1.8757 }])).toBe(false); // ~220 m
  });
});

import { stopCompletion } from "@/components/fleet/RouteOverlay";
describe("stop completion from order status", () => {
  it("collection stop is complete once collected; delivery only once delivered", () => {
    const o = { order_collected: true, order_delivered: false };
    expect(stopCompletion("pickup", o)).toBe("Collected");
    expect(stopCompletion("delivery", o)).toBeNull();
    expect(stopCompletion("delivery", { order_collected: true, order_delivered: true })).toBe("Delivered");
  });
});
