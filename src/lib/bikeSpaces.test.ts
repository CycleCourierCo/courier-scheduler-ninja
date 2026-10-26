import { describe, it, expect } from "vitest";
import { computeVanLoads } from "./bikeSpaces";
const one = () => 1;
describe("computeVanLoads", () => {
  it("counts deliveries without a collection on the route at the start", () => {
    const r = computeVanLoads([{ type: "delivery", orderId: "a" }, { type: "delivery", orderId: "b" }], one);
    expect(r.start).toBe(2); expect(r.after).toEqual([1, 0]);
  });
  it("collection then delivery on same route nets out and sets peak", () => {
    const r = computeVanLoads([{ type: "delivery", orderId: "x" }, { type: "pickup", orderId: "a" }, { type: "pickup", orderId: "b" }, { type: "delivery", orderId: "a" }], one);
    expect(r.start).toBe(1); expect(r.after).toEqual([0, 1, 2, 1]); expect(r.peak).toBe(2);
  });
});
