import { afterEach, describe, expect, it, vi } from "vitest";
import type { Timeslip } from "@/types/timeslip";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { calculateProfitability, setCostContext } from "./profitabilityService";

const timeslip: Timeslip = {
  id: "timeslip", driver_id: "driver", date: "2026-10-26", status: "approved",
  driving_hours: 8, stop_hours: 2, lunch_hours: 1, total_hours: 11,
  hourly_rate: 12, pay_type: "per_mile", per_mile_rate: 0.75,
  mileage: 432, van_allowance: 0, total_pay: 324,
  total_stops: 10, total_jobs: 10, route_links: [], job_locations: [],
  custom_addons: [], custom_addon_hours: 0,
  created_at: "", updated_at: "", approved_at: null, approved_by: null, admin_notes: null,
  vehicle_id: "van",
};

afterEach(() => setCostContext("flat", null));

describe("all-inclusive per-mile profitability", () => {
  it.each(["flat", "actual"] as const)("432 miles at £0.75 costs £324 in %s mode, without added van costs", (mode) => {
    setCostContext(mode, new Map([["van|2026-10", 0.45]]));
    const result = calculateProfitability(10, timeslip, 65, 0.45);
    expect(result.totalCosts).toBe(324);
    expect(result.profit).toBe(326);
  });

  it.each(["flat", "actual"] as const)("hourly drivers retain vehicle running costs in %s mode", (mode) => {
    setCostContext(mode, new Map([["van|2026-10", 0.45]]));
    expect(calculateProfitability(10, { ...timeslip, pay_type: "hourly" }, 65, 0.45).totalCosts).toBeCloseTo(518.4);
  });
});