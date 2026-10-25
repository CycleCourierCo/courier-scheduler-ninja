import { describe, it, expect } from "vitest";
import { effectiveOdometer } from "./odometer";

const slips = [
  { date: "2026-10-01", mileage: 100 },
  { date: "2026-10-10", mileage: 50 },
  { date: "2026-10-20", mileage: 30 },
];

describe("effectiveOdometer", () => {
  it("uses baseline plus all timeslip miles when no manual reading exists", () => {
    expect(effectiveOdometer(10000, slips, []).total).toBe(10180);
  });

  it("uses newest manual reading plus only timeslip miles after that date", () => {
    const r = effectiveOdometer(10000, slips, [
      { reading_date: "2026-09-01", odometer_mi: 9000 },
      { reading_date: "2026-10-10", odometer_mi: 12000 },
    ]);
    expect(r.total).toBe(12030);
  });
});
