import { describe, it, expect } from "vitest";
import { isWronglyAllocated, allocatedByLabel } from "./bayOverride";

describe("wrongly allocated zone", () => {
  it("shows a displaced bike with no bay", () => {
    expect(isWronglyAllocated({ id: "1", misallocated_at: "2026-11-11", storage_locations: null })).toBe(true);
  });
  it("drops out once the bike has a bay again", () => {
    expect(isWronglyAllocated({ id: "1", misallocated_at: "2026-11-11", storage_locations: [{ bay: "A", position: 2 }] })).toBe(false);
  });
  it("never shows bikes that were not displaced", () => {
    expect(isWronglyAllocated({ id: "1", storage_locations: null })).toBe(false);
  });
});

describe("allocated by label", () => {
  it("uses the allocator's name", () => expect(allocatedByLabel({ allocatedByName: "Talha" })).toBe("Talha"));
  it("falls back to Unknown for old allocations", () => expect(allocatedByLabel({})).toBe("Unknown"));
});
