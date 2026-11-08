import { describe, it, expect } from "vitest";
import { planRouteShipdayPush } from "./shipdayRoutePush";
import { shipdayLegBlock, routeLegSchedule } from "../../supabase/functions/_shared/shipdayLegRules";

const ROUTE_DAY = "2026-11-09";
const job = (over: Record<string, unknown> = {}) => ({ orderId: "o1", type: "delivery" as const, shipdayId: null, ...over });

describe("Add all to Shipday from a route", () => {
  it("adds a stop that has no Shipday job (e.g. a bike added after the route was built)", () => {
    expect(planRouteShipdayPush([job()], ROUTE_DAY)[0].action).toBe("create");
  });

  it("re-adds a stop whose old Shipday job no longer exists", () => {
    expect(planRouteShipdayPush([job({ shipdayId: "1", onShipday: false })], ROUTE_DAY)[0].action).toBe("create");
  });

  it("moves a stop whose Shipday job is still on another day", () => {
    const [d] = planRouteShipdayPush([job({ shipdayId: "1", onShipday: true, shipdayDate: "2026-11-07" })], ROUTE_DAY);
    expect(d.action).toBe("move");
  });

  it("leaves a stop already on Shipday for the route's day", () => {
    expect(planRouteShipdayPush([job({ shipdayId: "1", onShipday: true, shipdayDate: ROUTE_DAY })], ROUTE_DAY)[0].action).toBe("skip");
  });

  it("never sends a cancelled order", () => {
    expect(planRouteShipdayPush([job({ orderStatus: "cancelled" })], ROUTE_DAY)[0].action).toBe("skip");
  });
});

describe("Failed and cancelled legs stay off Shipday", () => {
  const failedDelivery = {
    status: "collected",
    scheduled_delivery_date: null,
    tracking_events: { shipday: { updates: [
      { leg: "delivery", event: "ORDER_ONTHEWAY", timestamp: "2026-11-07T10:00:00Z" },
      { leg: "delivery", event: "ORDER_FAILED", timestamp: "2026-11-07T11:00:00Z" },
    ] } },
  };

  it("refuses a failed delivery that hasn't been given a new day", () => {
    expect(shipdayLegBlock(failedDelivery, "delivery")).toBe("failed_not_rescheduled");
  });

  it("allows it once it has a new day", () => {
    expect(shipdayLegBlock({ ...failedDelivery, scheduled_delivery_date: "2026-11-09T10:00:00Z" }, "delivery")).toBeNull();
  });

  it("allows it when a planner puts it on a route", () => {
    expect(shipdayLegBlock(failedDelivery, "delivery", ROUTE_DAY)).toBeNull();
  });

  it("does not block the other leg", () => {
    expect(shipdayLegBlock(failedDelivery, "pickup")).toBeNull();
  });

  it("refuses cancelled orders even from a route", () => {
    expect(shipdayLegBlock({ status: "cancelled" }, "pickup", ROUTE_DAY)).toBe("cancelled");
  });
});

describe("Route day and time on the Shipday job", () => {
  it("uses the route's day and planned time for a stop not yet booked that day", () => {
    expect(routeLegSchedule({ scheduled_pickup_date: "2026-11-05T09:00:00Z", pickup_timeslot: "09:00" }, "pickup", ROUTE_DAY, "13:30"))
      .toEqual({ date: ROUTE_DAY, timeslot: "13:30" });
  });

  it("keeps the customer's sent timeslot when already booked for the route's day", () => {
    expect(routeLegSchedule({ scheduled_pickup_date: `${ROUTE_DAY}T10:15:00Z`, pickup_timeslot: "10:15" }, "pickup", ROUTE_DAY, "13:30"))
      .toEqual({ date: ROUTE_DAY, timeslot: "10:15" });
  });
});
