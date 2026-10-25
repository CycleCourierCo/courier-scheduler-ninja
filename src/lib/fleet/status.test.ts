import { describe, it, expect } from "vitest";
import { dueState, fleetStatusGroup } from "./status";

const today = new Date("2026-10-25T12:00:00Z");

describe("fleet status", () => {
  it("treats off-road vans as out of service", () => {
    expect(fleetStatusGroup("off_road")).toBe("out_of_service");
  });
  it("treats sold and written-off vans as retired", () => {
    expect(fleetStatusGroup("sold")).toBe("retired");
    expect(fleetStatusGroup("written_off")).toBe("retired");
  });
  it("flags a date in the past as overdue", () => {
    expect(dueState("2026-10-24", 30, today)).toBe("overdue");
  });
  it("flags a date within 30 days as due soon", () => {
    expect(dueState("2026-11-20", 30, today)).toBe("due_soon");
  });
  it("does not invent a due state when there is no date", () => {
    expect(dueState(null, 30, today)).toBe("none");
  });
});
