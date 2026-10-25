import { describe, it, expect } from "vitest";
import { liveStatus, isStale, matchVehicles, normaliseReg } from "./liveTracking";

describe("live tracking rules", () => {
  it("matches registrations ignoring spaces and case", () => {
    expect(normaliseReg("ab12 abc")).toBe("AB12ABC");
    const m = matchVehicles([{ registration: "AB12ABC" } as any], [{ registration: "ab12 abc", id: "v1" }]);
    expect(m[0].vehicle?.id).toBe("v1");
  });
  it("ignition off is off, on with speed is moving, on stopped is idling", () => {
    expect(liveStatus({ ignition: false, speed: 40 })).toBe("off");
    expect(liveStatus({ ignition: true, speed: 12 })).toBe("moving");
    expect(liveStatus({ ignition: true, speed: 0 })).toBe("idling");
  });
  it("a position older than 30 minutes is stale", () => {
    const now = 1_000_000_000_000;
    expect(isStale(now / 1000 - 29 * 60, now)).toBe(false);
    expect(isStale(now / 1000 - 31 * 60, now)).toBe(true);
  });
});
