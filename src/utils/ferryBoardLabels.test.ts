import { describe, it, expect } from "vitest";
import { ferryStageLabel, ferryRefLabel } from "./northernIreland";
import { matchesOrderSearch } from "./orderSearch";

describe("ferry board wording", () => {
  it("Isle of Man filter shows Isle of Man stages", () => {
    expect(ferryStageLabel("isle_of_man", "Collected in Northern Ireland")).toBe("Collected in Isle of Man");
    expect(ferryStageLabel("isle_of_man", "Awaiting NI collection")).toBe("Awaiting IoM collection");
  });
  it("NI filter keeps NI wording", () => {
    expect(ferryStageLabel("northern_ireland", "Delivered in Northern Ireland")).toBe("Delivered in Northern Ireland");
  });
  it("All filter reads neutrally", () => {
    expect(ferryStageLabel("all", "Awaiting NI collection")).toBe("Awaiting NI / IoM collection");
    expect(ferryStageLabel("all", "Delivered in Northern Ireland")).toBe("Delivered in NI / IoM");
  });
  it("Isle of Man uses order number, NI uses BFS number", () => {
    expect(ferryRefLabel("isle_of_man")).toBe("Order number");
    expect(ferryRefLabel("northern_ireland")).toBe("BFS number");
  });
  it("search finds a bike by BFS number", () => {
    expect(matchesOrderSearch({ id: "x", ni_bfs_number: "BFS998877" }, "bfs998877")).toBe(true);
  });
});
