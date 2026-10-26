import { describe, it, expect } from "vitest";
import { loadingSource } from "./DriverToday";

const base = { order_id: "o", tracking_number: "CCC1", receiver_name: "A", bike_brand: null, bike_model: null, bike_quantity: 1, storage_locations: [], collected: false, collected_on_this_route: false, from_van: null };

describe("loadingSource", () => {
  it("shows the depot bay when the bike is in storage", () => {
    expect(loadingSource({ ...base, storage_locations: [{ bay: "A", position: 3 }] })).toBe("Depot · Bay A3");
  });
  it("shows the other van when another route collects it", () => {
    expect(loadingSource({ ...base, from_van: "AB12CDE" })).toBe("From van AB12CDE");
  });
});
