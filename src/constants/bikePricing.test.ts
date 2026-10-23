import { describe, it, expect } from "vitest";
import { bikeTypePriceMap, pricingData, getRevenuePerStopForBikeType } from "./bikePricing";

describe("bike type prices", () => {
  it("Recumbent is £100", () => expect(bikeTypePriceMap["Recumbent"]).toBe(100));
  it("Small Trike is £125", () => expect(bikeTypePriceMap["Small Trike"]).toBe(125));
  it("Trike booking alias uses the Small Trike price", () => expect(bikeTypePriceMap["Trike"]).toBe(125));
  it("standard non-electric bike is £60", () => expect(bikeTypePriceMap["Non-Electric - Road Bike"]).toBe(60));
  it("public price list matches the app price map", () => {
    for (const { type, price } of pricingData) expect(bikeTypePriceMap[type]).toBe(price);
  });
  it("each stop earns half the delivery price", () => expect(getRevenuePerStopForBikeType("Recumbent")).toBe(50));
  it("unknown bike type falls back to £30 per stop", () => expect(getRevenuePerStopForBikeType("Unicycle")).toBe(30));
});
