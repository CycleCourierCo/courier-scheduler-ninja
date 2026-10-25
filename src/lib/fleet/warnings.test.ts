import { describe, it, expect } from "vitest";
import { dedupeWarnings, highestLevel, type FleetWarning } from "./warnings";

const w = (code: string, level: FleetWarning["level"], vehicle_id = "v1"): FleetWarning => ({ vehicle_id, registration: "AB12CDE", level, code, message: code });

describe("fleet route warnings", () => {
  it("shows each issue only once per van", () => {
    expect(dedupeWarnings([w("mot_expired", "amber"), w("mot_expired", "amber")])).toHaveLength(1);
  });
  it("puts red before amber before grey", () => {
    expect(dedupeWarnings([w("open_items", "grey"), w("mot_expired", "amber"), w("out_of_service", "red")]).map((x) => x.level)).toEqual(["red", "amber", "grey"]);
  });
  it("reports the most serious level", () => {
    expect(highestLevel([w("a", "grey"), w("b", "amber")])).toBe("amber");
    expect(highestLevel([])).toBeNull();
  });
});
