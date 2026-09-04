import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Trigger the customer update email for a single order immediately.
 *
 * The `send-order-updates` edge function has a single-order path that bypasses
 * the daily quiet window, so staff-driven milestone changes (Northern Ireland
 * stages, Foam My Bike stages) reach the customer straight away instead of
 * waiting for the next scheduled sweep.
 *
 * Never throws: a failed email must not undo a saved stage change.
 */
export async function sendOrderUpdateEmail(orderId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke("send-order-updates", {
      body: { orderId },
    });
    if (error) throw error;
    if (data && (data as any).success === false) throw new Error("Update email not sent");
    return true;
  } catch (e: any) {
    toast.warning("Stage saved, but the customer update email didn't send", {
      description: e?.message || "You can resend the update from the order page.",
    });
    return false;
  }
}
