/**
 * Route-planning view of a bike's workshop inspection status.
 *
 * "Done" means the workshop has finished with the bike and it can go out:
 * inspected with nothing to fix, repaired, or ship-as-is (all repairs
 * declined). Bikes waiting on a repair decision are not done yet, but get
 * their own label so planners can see why they're held.
 */
export const INSPECTION_DONE_STATUSES = ["inspected", "repaired", "ship_as_is"] as const;

export const isInspectionDoneForRouting = (status: string | null | undefined): boolean =>
  !!status && (INSPECTION_DONE_STATUSES as readonly string[]).includes(status);

export type InspectionRoutingState = "done" | "repairs_declined" | "awaiting_buyer" | "pending";

export const inspectionRoutingState = (status: string | null | undefined): InspectionRoutingState => {
  if (isInspectionDoneForRouting(status)) return "done";
  if (status === "repairs_declined") return "repairs_declined";
  if (status === "pending_receiver_approval") return "awaiting_buyer";
  return "pending";
};

export const INSPECTION_ROUTING_LABELS: Record<InspectionRoutingState, string> = {
  done: "Inspection Done",
  repairs_declined: "Repairs Declined",
  awaiting_buyer: "Awaiting Buyer Approval",
  pending: "Inspection Pending",
};
