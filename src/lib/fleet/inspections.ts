export type CheckResult = "pass" | "fail" | "na" | "not_checked";

export const CHECK_RESULTS: { value: CheckResult; label: string }[] = [
  { value: "pass", label: "Pass" },
  { value: "fail", label: "Fail" },
  { value: "na", label: "N/A" },
  { value: "not_checked", label: "Not checked" },
];

export const TYRE_FIELDS = [
  { key: "tread_fl", label: "Front left" },
  { key: "tread_fr", label: "Front right" },
  { key: "tread_rl", label: "Rear left" },
  { key: "tread_rr", label: "Rear right" },
] as const;

export const LEGAL_TREAD_MM = 1.6;
export const WARN_TREAD_MM = 3;

export type TreadState = "red" | "amber" | "ok" | "unknown";
export function treadState(mm: number | null | undefined): TreadState {
  if (mm == null || Number.isNaN(Number(mm))) return "unknown";
  if (Number(mm) < LEGAL_TREAD_MM) return "red";
  if (Number(mm) <= WARN_TREAD_MM) return "amber";
  return "ok";
}

export interface ResultLike { label: string; result: string; reason?: string | null }

/** Problems that stop an inspection being finalised (mirrors the database rule). */
export function finaliseErrors(
  results: ResultLike[],
  opts: { requiresCompetentInspector: boolean; inspectorName?: string | null; inspectorOrganisation?: string | null },
): string[] {
  const errs: string[] = [];
  const missing = results.filter((r) => (r.result === "fail" || r.result === "not_checked") && !r.reason?.trim());
  if (missing.length) errs.push(`${missing.length} check(s) marked Fail or Not checked need a reason.`);
  if (opts.requiresCompetentInspector && (!opts.inspectorName?.trim() || !opts.inspectorOrganisation?.trim()))
    errs.push("Detailed mechanical inspections need the inspector's name and garage.");
  return errs;
}

export function overallResult(results: ResultLike[]): "pass" | "fail" | "incomplete" {
  if (results.some((r) => r.result === "fail")) return "fail";
  if (results.some((r) => r.result === "not_checked")) return "incomplete";
  return "pass";
}

export const INSPECTION_RESULT_LABEL: Record<string, string> = { pass: "Passed", fail: "Failed", incomplete: "Incomplete" };
