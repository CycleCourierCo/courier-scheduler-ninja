import { describe, it, expect } from "vitest";
import { ferryRegionOfAddress, ferrySurchargeFor, localiseFerryText } from "@/utils/northernIreland";
import { resolveStopCoords, getNiDirection } from "@/utils/niDelivery";
import { FREIGHT_HUB, CITY_AIR_EXPRESS } from "@/constants/depot";

describe("ferry regions", () => {
  it("detects Isle of Man by IM postcode", () => {
    expect(ferryRegionOfAddress({ zipCode: "IM1 3DA" })).toBe("isle_of_man");
  });
  it("still detects Northern Ireland by BT postcode", () => {
    expect(ferryRegionOfAddress({ zipCode: "BT1 1AA" })).toBe("northern_ireland");
  });
  it("charges £180 inc. VAT per bike for the Isle of Man", () => {
    expect(ferrySurchargeFor("isle_of_man")).toBe(180);
  });
  it("keeps £120 per bike for Northern Ireland", () => {
    expect(ferrySurchargeFor("northern_ireland")).toBe(120);
  });
  it("routes Isle of Man deliveries to Freight Hub in Widnes", () => {
    const order = { receiver: { address: { zipCode: "IM2 4NR" } }, sender: { address: { zipCode: "B10 0AD" } } };
    expect(getNiDirection(order)).toBe("outbound");
    expect(resolveStopCoords(order, "delivery")).toEqual({ lat: FREIGHT_HUB.lat, lon: FREIGHT_HUB.lon });
  });
  it("routes inbound Isle of Man collections to Freight Hub", () => {
    const order = { ferry_region: "isle_of_man", ni_direction: "inbound", sender: { address: {} }, receiver: { address: {} } };
    expect(resolveStopCoords(order, "pickup")).toEqual({ lat: FREIGHT_HUB.lat, lon: FREIGHT_HUB.lon });
  });
  it("keeps Northern Ireland deliveries at City Air Express in Manchester", () => {
    const order = { receiver: { address: { zipCode: "BT7 1NN" } }, sender: { address: {} } };
    expect(resolveStopCoords(order, "delivery")).toEqual({ lat: CITY_AIR_EXPRESS.lat, lon: CITY_AIR_EXPRESS.lon });
  });
  it("swaps NI wording only for Isle of Man orders", () => {
    expect(localiseFerryText("isle_of_man", "Delivered in Northern Ireland")).toBe("Delivered in Isle of Man");
    expect(localiseFerryText("northern_ireland", "Delivered in Northern Ireland")).toBe("Delivered in Northern Ireland");
  });
});
