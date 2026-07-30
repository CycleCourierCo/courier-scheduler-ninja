import { supabase } from "@/integrations/supabase/client";

/**
 * InspectaBike (bike-checker-pro) integration.
 *
 * InspectaBike owns the bike's permanent condition / fault / service record.
 * This portal owns pricing, customer approval, parts tracking and invoicing.
 * Faults are entered once in InspectaBike and synced here; portal-side changes
 * are pushed back so the mechanic never has to re-enter anything.
 */

export interface CreateInspectaBikeJobResult {
  already_linked: boolean;
  external_inspection_id: string | null;
  report_url: string | null;
}

/** Create (or fetch) the linked InspectaBike inspection for a courier order. */
export const sendOrderToInspectaBike = async (
  orderId: string,
  bikeIndex = 0,
): Promise<CreateInspectaBikeJobResult> => {
  const { data, error } = await supabase.functions.invoke("inspectabike-create-job", {
    body: { order_id: orderId, bike_index: bikeIndex },
  });

  if (error) {
    let details = error.message;
    try {
      const ctx = (error as any)?.context;
      if (ctx?.text) details = await ctx.text();
    } catch {
      /* ignore */
    }
    console.error("inspectabike-create-job failed:", details);
    throw new Error(details || "Failed to send to InspectaBike");
  }

  if (data?.error) throw new Error(data.error);
  return data as CreateInspectaBikeJobResult;
};

/**
 * Push portal-side changes (approval, decline, parts ordered/arrived) back to
 * InspectaBike. Fire-and-forget: never blocks or fails the portal action.
 */
export const pushIssueStatusToInspectaBike = (issueIds: string | string[]): void => {
  const ids = Array.isArray(issueIds) ? issueIds : [issueIds];
  if (ids.length === 0) return;

  void supabase.functions
    .invoke("inspectabike-push-status", { body: { issue_ids: ids } })
    .catch((err) => console.error("InspectaBike status push failed:", err?.message ?? err));
};

/** Public bike-history URL for a serial number on InspectaBike, if configured. */
export const getInspectaBikeHistoryUrl = (serialNumber?: string | null): string | null => {
  const base = import.meta.env.VITE_INSPECTABIKE_APP_URL as string | undefined;
  if (!base || !serialNumber) return null;
  return `${base.replace(/\/+$/, "")}/check-serial?serial=${encodeURIComponent(serialNumber)}`;
};
