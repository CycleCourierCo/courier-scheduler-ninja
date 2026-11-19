import { describe, it, expect } from "vitest";
import { overdueTier } from "./overdueTier";
describe("overdueTier", () => {
  it("13 days is amber", () => expect(overdueTier(13)).toBe("amber"));
  it("14 days is red", () => expect(overdueTier(14)).toBe("red"));
});
