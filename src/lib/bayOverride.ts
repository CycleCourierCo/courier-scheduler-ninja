import { supabase } from "@/integrations/supabase/client";

/** Bikes the system took out of a bay because staff found the bay physically empty. */
export interface MisallocatedOrder {
  id: string;
  misallocated_at?: string | null;
  misallocated_from?: string | null;
  misallocated_by_name?: string | null;
  storage_locations?: unknown;
  status?: string;
  loaded_onto_van?: boolean;
}

export function isWronglyAllocated(o: MisallocatedOrder): boolean {
  if (!o.misallocated_at) return false;
  if (o.status === "cancelled" || o.status === "delivered" || o.loaded_onto_van) return false;
  const locs = o.storage_locations;
  return !(Array.isArray(locs) && locs.length > 0);
}

export function allocatedByLabel(a: { allocatedByName?: string | null; allocatedBy?: string | null }): string {
  return a.allocatedByName?.trim() || (a.allocatedBy ? "Staff member" : "Unknown");
}

/** Remove whatever the system thinks is in this slot (moves it to "Wrongly allocated"). */
export async function overrideBaySlot(orderId: string, bay: string, position: number): Promise<void> {
  const { error } = await supabase.rpc("override_bay_slot" as any, {
    p_order_id: orderId, p_bay: bay, p_pos: position,
  });
  if (error) throw error;
}

export async function dismissMisallocated(orderId: string): Promise<void> {
  const { error } = await supabase.rpc("dismiss_misallocated" as any, { p_order_id: orderId });
  if (error) throw error;
}
