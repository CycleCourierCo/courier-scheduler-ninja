import { describe, it, expect } from "vitest";
import { groupLoadersList } from "./loadersList";

describe("groupLoadersList", () => {
  const bikes = [
    { id: "1", driver: "Tahir", takenOut: true, takenOutAt: "2026-11-12T08:00:00Z", bay: "A1" },
    { id: "2", driver: "Tahir", takenOut: false, bay: "B2" },
    { id: "3", driver: null, takenOut: false, bay: "C1" },
    { id: "4", driver: "Ali", takenOut: false, bay: "A4" },
  ];
  it("puts unassigned last", () => expect(groupLoadersList(bikes).map((g) => g.driver)).toEqual(["Ali", "Tahir", "Unassigned"]));
  it("lists waiting bikes before taken-out ones", () => expect(groupLoadersList(bikes)[1].bikes.map((b) => b.id)).toEqual(["2", "1"]));
  it("counts taken out per driver", () => expect(groupLoadersList(bikes)[1].takenOut).toBe(1));
});
