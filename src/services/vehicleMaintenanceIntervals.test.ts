import { describe, it, expect } from "vitest";
import { computeNextDue, type MaintenanceLog, type MaintenanceInterval } from "./vehicleMaintenanceService";

const log = (o: Partial<MaintenanceLog>): MaintenanceLog => ({ id: "l", vehicle_id: "v", service_type: "oil_filter", custom_name: null, position: null,
  service_date: "2026-01-01", odometer_mi: 100000, cost: null, vendor: null, notes: null, brand: null, model: null, part_number: null,
  created_by: null, created_at: "", updated_at: "", ...o });
const today = new Date("2026-02-01");
const oil = (items: ReturnType<typeof computeNextDue>) => items.find((d) => d.serviceType === "oil_filter")!;

describe("service intervals", () => {
  it("never-done items are 'unknown' (No record), not due soon", () => {
    expect(oil(computeNextDue([], [], { baselineMileage: 0, timeslipMileage: 0, today })).status).toBe("unknown");
  });
  it("fleet default overrides built-in interval", () => {
    const d = oil(computeNextDue([log({})], [], { baselineMileage: 100000, timeslipMileage: 0, today,
      fleetDefaults: [{ service_type: "oil_filter", position: null, custom_name: null, interval_miles: 5000, interval_months: 6 }] }));
    expect(d.dueMiles).toBe(105000);
  });
  it("van's own interval overrides fleet default", () => {
    const own: MaintenanceInterval = { id: "i", vehicle_id: "v", service_type: "oil_filter", position: null, custom_name: null, interval_miles: 8000, interval_months: 6 };
    const d = oil(computeNextDue([log({})], [own], { baselineMileage: 100000, timeslipMileage: 0, today,
      fleetDefaults: [{ service_type: "oil_filter", position: null, custom_name: null, interval_miles: 5000, interval_months: 6 }] }));
    expect(d.dueMiles).toBe(108000);
  });
});
