import { describe, it, expect } from "vitest";
import { inspectionRoutingState, isInspectionDoneForRouting, INSPECTION_ROUTING_LABELS } from "./inspectionRouting";

describe("inspection status for route planning", () => {
  it("counts ship-as-is (all repairs declined) as done", () => {
    expect(isInspectionDoneForRouting("ship_as_is")).toBe(true);
    expect(INSPECTION_ROUTING_LABELS[inspectionRoutingState("ship_as_is")]).toBe("Inspection Done");
  });

  it("still counts inspected and repaired as done", () => {
    expect(isInspectionDoneForRouting("inspected")).toBe(true);
    expect(isInspectionDoneForRouting("repaired")).toBe(true);
  });

  it("holds bikes while the seller has declined but the buyer hasn't been asked", () => {
    expect(isInspectionDoneForRouting("repairs_declined")).toBe(false);
    expect(INSPECTION_ROUTING_LABELS[inspectionRoutingState("repairs_declined")]).toBe("Repairs Declined");
  });

  it("holds bikes while waiting for the buyer to approve repairs", () => {
    expect(isInspectionDoneForRouting("pending_receiver_approval")).toBe(false);
    expect(INSPECTION_ROUTING_LABELS[inspectionRoutingState("pending_receiver_approval")]).toBe("Awaiting Buyer Approval");
  });

  it("treats repairs in progress or no inspection record as pending", () => {
    for (const s of ["pending", "issues_found", "awaiting_parts", "in_repair", "cleaning", null, undefined]) {
      expect(isInspectionDoneForRouting(s)).toBe(false);
      expect(inspectionRoutingState(s)).toBe("pending");
    }
  });
});
