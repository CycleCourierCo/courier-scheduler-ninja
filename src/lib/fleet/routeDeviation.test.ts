import { describe, it, expect } from "vitest";
import { firstVisit, offRouteStretches, distanceToRoute } from "./routeDeviation";

const stop = { lat: 51.5, lon: -0.1 };
const route = [{ lat: 51.5, lon: -0.1 }, { lat: 51.5, lon: 0.0 }];

describe("route deviation rules", () => {
  it("a stop counts as visited within 150 m, not beyond", () => {
    // ~0.001 deg lat ≈ 111 m; 0.002 ≈ 222 m
    expect(firstVisit(stop, [{ lat: 51.501, lon: -0.1, t: 5 }])).toBe(5);
    expect(firstVisit(stop, [{ lat: 51.502, lon: -0.1, t: 5 }])).toBeNull();
  });
  it("distance is measured to the line between stops", () => {
    expect(distanceToRoute({ lat: 51.5, lon: -0.05 }, route)).toBeLessThan(5);
  });
  it("more than 2 km off for 10+ minutes is a deviation; 9 minutes is not", () => {
    const off = { lat: 51.53, lon: -0.05 }; // ~3.3 km north of the line
    const mk = (mins: number[]) => mins.map((m) => ({ ...off, t: m * 60_000 }));
    expect(offRouteStretches(mk([0, 5, 10]), route)).toHaveLength(1);
    expect(offRouteStretches(mk([0, 9]), route)).toHaveLength(0);
  });
});
