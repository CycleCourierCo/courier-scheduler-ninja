import type { InspectionStatus } from "@/types/inspection";

// Friendly labels for the workshop stages, used in gate badges/tooltips.
const STAGE_LABELS: Record<string, string> = {
  pending: "awaiting inspection",
  inspected: "inspected, not cleaned",
  awaiting_pricing: "awaiting pricing",
  issues_found: "issues found",
  awaiting_parts: "awaiting parts",
  awaiting_repair: "awaiting repair",
  in_repair: "in repair",
  cleaning: "being cleaned",
  repaired: "service complete",
};

/**
 * Service is only complete once the inspection has been through repair AND
 * cleaning, i.e. it reached the terminal `repaired` stage. Orders that don't
 * need inspection are never gated.
 */
export const isServiceComplete = (
  needsInspection: boolean | null | undefined,
  inspectionStatus: InspectionStatus | string | null | undefined
): boolean => {
  if (needsInspection !== true) return true;
  return inspectionStatus === "repaired";
};

/** Human-readable current workshop stage, for badges and tooltips. */
export const serviceGateLabel = (
  inspectionStatus: InspectionStatus | string | null | undefined
): string => {
  if (!inspectionStatus) return "no inspection started";
  return STAGE_LABELS[inspectionStatus] || String(inspectionStatus).replace(/_/g, " ");
};
