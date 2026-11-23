import { describe, expect, it } from "vitest";
import { canDriverSeeArticle, isKbDriverOnly } from "./knowledgeAccess";

describe("knowledge base driver access", () => {
  it("treats a driver with no office role as driver-only", () => {
    expect(isKbDriverOnly(["driver"])).toBe(true);
  });

  it("does not restrict drivers who also hold an office role", () => {
    expect(isKbDriverOnly(["driver", "route_planner"])).toBe(false);
    expect(isKbDriverOnly(["admin"])).toBe(false);
  });

  it("lets drivers see only published SOPs in the Drivers section", () => {
    expect(canDriverSeeArticle({ status: "published", category: { slug: "drivers" } })).toBe(true);
    expect(canDriverSeeArticle({ status: "draft", category: { slug: "drivers" } })).toBe(false);
    expect(canDriverSeeArticle({ status: "published", category: { slug: "invoicing-finance" } })).toBe(false);
  });
});
