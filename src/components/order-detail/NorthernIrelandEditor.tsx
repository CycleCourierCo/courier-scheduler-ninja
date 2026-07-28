import React from "react";
import { toast } from "sonner";
import { Ship, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { CITY_AIR_EXPRESS } from "@/constants/depot";
import { isNorthernIrelandAddress } from "@/utils/northernIreland";
import { createShipdayOrder } from "@/services/shipdayService";
import { FOAM_STATUS_LABELS, FoamStatus, Order } from "@/types/order";

interface Props {
  order: Order & Record<string, any>;
  onUpdate: () => void;
}

const BLOCKED_STATUSES = ["delivered", "delivered_by_3p", "cancelled"];

const NorthernIrelandEditor: React.FC<Props> = ({ order, onUpdate }) => {
  const [working, setWorking] = React.useState(false);

  const isNI = Boolean((order as any).isNorthernIreland ?? (order as any).is_northern_ireland);
  const foamStatus = ((order as any).foamStatus ?? (order as any).foam_status) as FoamStatus | null;
  const receiverAddress = order.receiver?.address;
  const looksNI = isNorthernIrelandAddress(receiverAddress as any);
  const blocked = BLOCKED_STATUSES.includes(String(order.status));

  const deliveryScheduled = Boolean(
    (order as any).scheduledDeliveryDate || (order as any).scheduled_delivery_date
  );
  const deliveryDriver =
    (order as any).deliveryDriverName || (order as any).delivery_driver_name || null;

  const rerouteDelivery = async (markAsNI: boolean) => {
    // Remove only the delivery leg; the collection job is untouched.
    const { data: row } = await supabase
      .from("orders")
      .select("shipday_delivery_id")
      .eq("id", order.id)
      .maybeSingle();

    const shipdayDeliveryId = row?.shipday_delivery_id;
    if (shipdayDeliveryId) {
      const { error } = await supabase.functions.invoke("delete-shipday-order", {
        body: { shipdayDeliveryId },
      });
      if (error) throw new Error(error.message);
      await supabase
        .from("orders")
        .update({ shipday_delivery_id: null })
        .eq("id", order.id);
    }

    await createShipdayOrder(order.id, "delivery", markAsNI);
  };

  const applyChange = async (markAsNI: boolean) => {
    setWorking(true);
    let flagged = false;
    try {
      const now = new Date().toISOString();
      const patch: Record<string, any> = markAsNI
        ? {
            is_northern_ireland: true,
            destination_region: "Northern Ireland",
            foam_status: "pending_collection",
            foam_pending_collection_at: now,
            updated_at: now,
          }
        : {
            is_northern_ireland: false,
            destination_region: null,
            foam_status: null,
            foam_pending_collection_at: null,
            foam_pending_foaming_at: null,
            foam_foamed_at: null,
            foam_delivered_to_ferry_at: null,
            foam_delivered_ni_at: null,
            updated_at: now,
          };

      const { data: updated, error } = await supabase
        .from("orders")
        .update(patch)
        .eq("id", order.id)
        .select("id, is_northern_ireland, foam_status")
        .maybeSingle();
      if (error) throw error;
      if (!updated) {
        throw new Error(
          "The order could not be updated — you may not have permission to change this order."
        );
      }
      if (Boolean((updated as any).is_northern_ireland) !== markAsNI) {
        throw new Error(
          "The Northern Ireland flag did not save correctly. Shipday was left untouched — please retry."
        );
      }
      flagged = true;

      await rerouteDelivery(markAsNI);


      toast.success(
        markAsNI
          ? "Marked as a Northern Ireland delivery and re-routed to City Air Express"
          : "Northern Ireland flag removed and delivery restored to the receiver"
      );
      onUpdate();
    } catch (e: any) {
      console.error("NI flag update failed", e);
      if (flagged) {
        toast.error(
          `Flag updated, but the Shipday delivery job could not be re-created (${e?.message || "unknown error"}). Please re-create it manually from scheduling.`
        );
        onUpdate();
      } else {
        toast.error(e?.message || "Could not update the Northern Ireland flag");
      }
    } finally {
      setWorking(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Ship className="h-4 w-4" /> Northern Ireland delivery
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isNI ? (
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-emerald-600 hover:bg-emerald-600">Northern Ireland delivery</Badge>
              {foamStatus && (
                <Badge variant="outline">{FOAM_STATUS_LABELS[foamStatus] || foamStatus}</Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              Delivery is handed over at the ferry port, {CITY_AIR_EXPRESS.formatted}. A £120
              per-bike surcharge applies at invoicing.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            This order is not flagged as a Northern Ireland delivery.
            {looksNI && (
              <span className="block mt-1 text-amber-600 font-medium">
                This looks like a Northern Ireland address.
              </span>
            )}
          </p>
        )}

        {blocked ? (
          <p className="text-sm text-muted-foreground">
            This order is {String(order.status).replace(/_/g, " ")} — the Northern Ireland flag can no
            longer be changed.
          </p>
        ) : (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant={isNI ? "outline" : "default"} size="sm" disabled={working}>
                {working && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isNI ? "Unmark Northern Ireland delivery" : "Mark as Northern Ireland delivery"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {isNI ? "Remove the Northern Ireland flag?" : "Mark as a Northern Ireland delivery?"}
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-2 text-sm">
                    {isNI ? (
                      <p>
                        The foam pipeline will be cleared and the Shipday delivery job will be
                        re-created against the real receiver address.
                      </p>
                    ) : (
                      <p>
                        The bike enters the Foam My Bike pipeline at “Pending collection”, the Shipday
                        delivery job is re-created to the ferry hand-off point in Manchester, and a £120
                        per-bike surcharge applies to future invoicing.
                      </p>
                    )}
                    {(deliveryScheduled || deliveryDriver) && (
                      <p className="text-amber-600 font-medium">
                        Warning: this delivery is already
                        {deliveryScheduled ? " scheduled" : ""}
                        {deliveryScheduled && deliveryDriver ? " and" : ""}
                        {deliveryDriver ? ` assigned to ${deliveryDriver}` : ""}. Re-creating the job
                        drops the driver assignment and the timeslot — the delivery will need
                        re-scheduling.
                      </p>
                    )}
                    <p>The collection job is not affected.</p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={working}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={working}
                  onClick={(e) => {
                    e.preventDefault();
                    applyChange(!isNI);
                  }}
                >
                  {isNI ? "Unmark" : "Mark as Northern Ireland"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardContent>
    </Card>
  );
};

export default NorthernIrelandEditor;
