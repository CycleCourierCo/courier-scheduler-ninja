import { describe, it, expect } from "vitest";
import { closeDefectError, isDefectOpen } from "./defects";
import { finaliseErrors, overallResult, treadState } from "./inspections";

describe("defect rules", () => {
  it("blocks closing a red defect without evidence or verifier", () => {
    expect(closeDefectError({ severity: "high", rectification_evidence: "", verified_by_name: "Sam" })).not.toBeNull();
    expect(closeDefectError({ severity: "high", rectification_evidence: "Invoice 12", verified_by_name: "" })).not.toBeNull();
    expect(closeDefectError({ severity: "high", rectification_evidence: "Invoice 12", verified_by_name: "Sam" })).toBeNull();
  });
  it("lets amber and green defects close without evidence", () => {
    expect(closeDefectError({ severity: "medium" })).toBeNull();
  });
  it("treats only closed and cancelled as not open", () => {
    expect(isDefectOpen("rectified")).toBe(true);
    expect(isDefectOpen("resolved")).toBe(false);
    expect(isDefectOpen("cancelled")).toBe(false);
  });
});

describe("inspection rules", () => {
  it("requires a reason for Fail and Not checked", () => {
    expect(finaliseErrors([{ label: "x", result: "fail" }], { requiresCompetentInspector: false })).toHaveLength(1);
    expect(finaliseErrors([{ label: "x", result: "not_checked", reason: "no access" }], { requiresCompetentInspector: false })).toHaveLength(0);
  });
  it("requires inspector name and garage on detailed mechanical checks", () => {
    expect(finaliseErrors([], { requiresCompetentInspector: true, inspectorName: "Jo" })).toHaveLength(1);
    expect(finaliseErrors([], { requiresCompetentInspector: true, inspectorName: "Jo", inspectorOrganisation: "ABC Garage" })).toHaveLength(0);
  });
  it("fails overall if any check fails", () => {
    expect(overallResult([{ label: "a", result: "pass" }, { label: "b", result: "fail" }])).toBe("fail");
    expect(overallResult([{ label: "a", result: "pass" }, { label: "b", result: "na" }])).toBe("pass");
  });
  it("flags tread under 1.6mm red and up to 3mm amber", () => {
    expect(treadState(1.5)).toBe("red");
    expect(treadState(3)).toBe("amber");
    expect(treadState(4)).toBe("ok");
  });
});
