import { Order, BOX_MY_BIKE_STATUS_ORDER, FOAM_STATUS_ORDER } from "@/types/order";
import { isOutboundNi, isInboundNi } from "@/utils/niDelivery";
import type { JourneyStop } from "@/components/design/JourneyStrip";

const reached = (order: readonly string[], current: string | null | undefined, stage: string) => {
  if (!current) return false;
  const cur = order.indexOf(current as string);
  return cur >= 0 && cur >= order.indexOf(stage);
};

/**
 * Builds the journey strip stages for an order, reflecting the real stages the
 * bike goes through: collection, inspection/repairs, boxing, foam packing,
 * ferry crossings and partner hand-offs — each with its own icon.
 */
export function buildJourneyStops(order: Order): JourneyStop[] {
  const anyOrder = order as any;
  const outboundNi = isOutboundNi(order);
  const inboundNi = isInboundNi(order);
  const stops: JourneyStop[] = [];

  stops.push({ label: "Booked", state: "complete", icon: "booked" });

  // Collection (inbound NI bikes are collected by the ferry partner in NI)
  const collected = !!order.orderCollected || (inboundNi && !!anyOrder.niInboundCollectedAt);
  stops.push({
    label: inboundNi ? "Collected in NI" : "Collected",
    state: collected ? "complete" : "upcoming",
    icon: "collected",
  });

  // Inspection / servicing
  if (order.needsInspection) {
    const summary = order.inspectionSummary;
    const inspected =
      !!summary?.inspected_at ||
      order.inspection_status === "inspected" ||
      order.inspection_status === "issues_found" ||
      order.inspection_status === "in_repair" ||
      order.inspection_status === "repaired";
    stops.push({
      label: "Inspected",
      state: inspected ? "complete" : "upcoming",
      icon: "inspected",
    });
    const repaired = !!summary?.repairs_completed_at || order.inspection_status === "repaired";
    const hadRepairs = repaired || !!summary?.repairs_approved_at || order.inspection_status === "in_repair";
    if (hadRepairs) {
      stops.push({
        label: "Repaired",
        state: repaired ? "complete" : "upcoming",
        icon: "repaired",
      });
    }
  }

  if (order.isBoxMyBike) {
    const status = order.boxMyBikeStatus ?? null;
    const boxed = !!order.boxBoxedAt || reached(BOX_MY_BIKE_STATUS_ORDER, status, "boxed_awaiting_label");
    const withCourier = !!order.boxCollectedBy3pAt || reached(BOX_MY_BIKE_STATUS_ORDER, status, "collected_by_3p");
    const boxDelivered = !!order.boxDeliveredBy3pAt || reached(BOX_MY_BIKE_STATUS_ORDER, status, "delivered_by_3p") || order.status === "delivered";
    stops.push({ label: "Boxed", state: boxed ? "complete" : "upcoming", icon: "boxed" });
    stops.push({ label: "With courier", state: withCourier ? "complete" : "upcoming", icon: "transit" });
    stops.push({ label: "Delivered", state: boxDelivered ? "complete" : "upcoming", icon: "delivered" });
  } else if (outboundNi) {
    const status = order.foamStatus ?? null;
    const foamed = !!order.foamFoamedAt || reached(FOAM_STATUS_ORDER, status, "foamed_ready");
    const atFerry = !!order.foamDeliveredToFerryAt || reached(FOAM_STATUS_ORDER, status, "delivered_to_ferry");
    const crossed = !!order.foamCrossedToNiAt || reached(FOAM_STATUS_ORDER, status, "crossed_to_ni");
    const deliveredNi = !!order.foamDeliveredNiAt || reached(FOAM_STATUS_ORDER, status, "delivered_ni") || order.status === "delivered";
    stops.push({ label: "Foamed", state: foamed ? "complete" : "upcoming", icon: "foamed" });
    stops.push({ label: "At ferry", state: atFerry ? "complete" : "upcoming", icon: "ferry" });
    stops.push({ label: "Crossed ferry", state: crossed ? "complete" : "upcoming", icon: "ferry" });
    stops.push({ label: "Delivered", state: deliveredNi ? "complete" : "upcoming", icon: "delivered" });
  } else if (inboundNi) {
    const status = (order.niInboundStatus as string | null | undefined) ?? null;
    const crossed = !!anyOrder.niInboundFerryCrossedAt || status === "crossed_ferry" || status === "collected_from_partner";
    const fromPartner = !!anyOrder.niInboundReceivedAt || status === "collected_from_partner";
    const delivered = order.status === "delivered";
    stops.push({ label: "Crossed ferry", state: crossed ? "complete" : "upcoming", icon: "ferry" });
    stops.push({ label: "From partner", state: fromPartner ? "complete" : "upcoming", icon: "partner" });
    stops.push({ label: "Delivered", state: delivered ? "complete" : "upcoming", icon: "delivered" });
  } else {
    const delivered = order.status === "delivered";
    stops.push({
      label: "In transit",
      state: delivered ? "complete" : "upcoming",
      icon: "transit",
    });
    stops.push({ label: "Delivered", state: delivered ? "complete" : "upcoming", icon: "delivered" });
  }

  // Mark the first incomplete stage as the current one.
  const currentIndex = stops.findIndex((s) => s.state !== "complete");
  if (currentIndex >= 0) stops[currentIndex] = { ...stops[currentIndex], state: "current" };

  return stops;
}
