import { describe, it, expect } from "vitest";
import { calculateTimeslipPay } from "./timeslipPay";

describe("calculateTimeslipPay", () => {
  it("per-mile pay is miles x rate plus van allowance, ignoring hours", () => {
    expect(calculateTimeslipPay({ pay_type: "per_mile", total_hours: 9, hourly_rate: 12, mileage: 120, per_mile_rate: 0.45, van_allowance: 10 })).toBeCloseTo(64);
  });
  it("hourly pay is unchanged", () => {
    expect(calculateTimeslipPay({ pay_type: "hourly", total_hours: 8, hourly_rate: 11, mileage: 120, per_mile_rate: 0.45, van_allowance: 10 })).toBe(98);
  });
});
