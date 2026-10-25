import { describe, it, expect } from "vitest";
import { fleetCostLines, repairCost, repairVerifyError, isRepairOutstanding } from "./repairs";

describe("repair costs", () => {
  it("counts a repair once even when it also created a service record", () => {
    const lines = fleetCostLines(
      [{ id: "r1", title: "Brakes", status: "closed", created_at: "2026-10-01", final_cost: 300 }],
      [{ service_date: "2026-10-01", service_type: "brake_pads", cost: 300, repair_job_id: "r1" },
       { service_date: "2026-09-01", service_type: "oil_filter", cost: 80 }],
    );
    expect(lines.reduce((a, l) => a + l.cost, 0)).toBe(380);
  });
  it("ignores cancelled repairs", () => {
    expect(fleetCostLines([{ id: "r", title: "x", status: "cancelled", created_at: "2026-10-01", final_cost: 100 }], [])).toHaveLength(0);
  });
  it("uses final cost, then labour+parts+VAT, then the quote", () => {
    expect(repairCost({ final_cost: 120, quoted_cost: 90 })).toBe(120);
    expect(repairCost({ labour_cost: 50, parts_cost: 30, vat: 16 })).toBe(96);
    expect(repairCost({ quoted_cost: 90 })).toBe(90);
  });
});

describe("repair workflow", () => {
  it("needs a verifier to verify or close", () => {
    expect(repairVerifyError({ status: "verified" })).not.toBeNull();
    expect(repairVerifyError({ status: "closed", verified_by_name: "Talha" })).toBeNull();
  });
  it("treats verified, closed and cancelled as no longer outstanding", () => {
    expect(isRepairOutstanding("invoiced")).toBe(true);
    expect(isRepairOutstanding("verified")).toBe(false);
  });
});
