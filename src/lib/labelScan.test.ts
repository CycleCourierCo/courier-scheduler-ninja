import { describe, it, expect } from "vitest";
import { parseScannedRef, panelForRoles, driverScanState } from "./labelScan";

describe("label scans", () => {
  it("reads the CCC number from the printed label URL", () => {
    expect(parseScannedRef("https://booking.cyclecourierco.com/tracking/CCC754984028829IAIDT2")).toBe("CCC754984028829IAIDT2");
    expect(parseScannedRef("not a label!")).toBeNull();
  });
  it("opens the panel for the user's role", () => {
    expect(panelForRoles(["driver", "admin"])).toBe("admin");
    expect(panelForRoles(["loader"])).toBe("loader");
    expect(panelForRoles(["mechanic"])).toBe("mechanic");
    expect(panelForRoles(["driver"])).toBe("driver");
  });
  it("blocks a driver whose route does not include the bike", () => {
    expect(driverScanState([{ assignment_id: "a", route: "R", registration: null, started: true, mine: false, stop_types: ["pickup"] }])).toBe("not_on_route");
    expect(driverScanState([{ assignment_id: "a", route: "R", registration: null, started: false, mine: true, stop_types: ["pickup"] }])).toBe("before_start");
  });
});
