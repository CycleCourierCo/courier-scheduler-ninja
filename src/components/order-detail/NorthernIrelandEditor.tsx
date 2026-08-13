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
import { getNiDirection } from "@/utils/niDelivery";
import { createShipdayOrder } from "@/services/shipdayService";
import { FOAM_STATUS_LABELS, FoamStatus, Order } from "@/types/order";

interface Props {
  order: Order & Record<string, any>;
  onUpdate: () => void;
}

const BLOCKED_STATUSES = ["delivered", "delivered_by_3p", "cancelled"];

const NorthernIrelandEditor: React.FC<Props> = ({ order, onUpdate }) => {
  const [working, setWorking] = React.useState(false);
  const [sendingFerryEmail, setSendingFerryEmail] = React.useState(false);
  const [ferryNotifiedAt, setFerryNotifiedAt] = React.useState<string | null>(
    ((order as any).ferryPartnerNotifiedAt ?? (order as any).ferry_partner_notified_at ?? null) as
      | string
      | null
  );

  const resendFerryEmail = async () => {
    setSendingFerryEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-ferry-partner-notification", {
        body: { orderId: order.id },
      });
      if (error) throw error;
      setFerryNotifiedAt((data as any)?.notifiedAt || new Date().toISOString());
      toast.success(`Booking email sent to ${CITY_AIR_EXPRESS.email}`);
      onUpdate();
    } catch (e: any) {
      console.error("Ferry partner email resend failed", e);
      toast.error(e?.message || "Could not send the ferry partner email");
    } finally {
      setSendingFerryEmail(false);
    }
  };


  const isNI = Boolean((order as any).isNorthernIreland ?? (order as any).is_northern_ireland);
  const foamStatus = ((order as any).foamStatus ?? (order as any).foam_status) as FoamStatus | null;
  const receiverAddress = order.receiver?.address;
  const senderAddress = order.sender?.address;
  // Which end of the journey is in Northern Ireland decides the whole flow:
  // outbound = we hand the bike over at the ferry, inbound = we collect it there.
  const storedDirection = getNiDirection(order);
  const looksOutbound = isNorthernIrelandAddress(receiverAddress as any);
  const looksInbound = !looksOutbound && isNorthernIrelandAddress(senderAddress as any);
  const direction: "outbound" | "inbound" =
    (isNI ? storedDirection : null) ?? (looksInbound ? "inbound" : "outbound");
  const isInbound = direction === "inbound";
  const looksNI = looksOutbound || looksInbound;
  const ferryLeg: "pickup" | "delivery" = isInbound ? "pickup" : "delivery";
  const blocked = BLOCKED_STATUSES.includes(String(order.status));

  const deliveryScheduled = Boolean(
    (order as any).scheduledDeliveryDate || (order as any).scheduled_delivery_date
  );
  const deliveryDriver =
    (order as any).deliveryDriverName || (order as any).delivery_driver_name || null;

  const rerouteFerryLeg = async (markAsNI: boolean) => {
    // Only the leg that touches the ferry is re-created; the other leg is untouched.
    const idColumn = isInbound ? "shipday_pickup_id" : "shipday_delivery_id";
    const { data: row } = await supabase
      .from("orders")
      .select(idColumn)
      .eq("id", order.id)
      .maybeSingle();

    const shipdayId = (row as any)?.[idColumn];
    if (shipdayId) {
      const { error } = await supabase.functions.invoke("delete-shipday-order", {
        body: isInbound ? { shipdayPickupId: shipdayId } : { shipdayDeliveryId: shipdayId },
      });
      if (error) throw new Error(error.message);
      await supabase
        .from("orders")
        .update({ [idColumn]: null } as any)
        .eq("id", order.id);
    }

    await createShipdayOrder(order.id, ferryLeg, markAsNI);
  };

  const applyChange = async (markAsNI: boolean) => {
    setWorking(true);
    let flagged = false;
    try {
      const now = new Date().toISOString();
      const patch: Record<string, any> = markAsNI
        ? {
            is_northern_ireland: true,
            ni_direction: direction,
            destination_region: isInbound ? null : "Northern Ireland",
            // Inbound bikes arrive already packed, so they skip the foam pipeline.
            foam_status: isInbound ? null : "pending_collection",
            foam_pending_collection_at: isInbound ? null : now,
            updated_at: now,
          }
        : {
            is_northern_ireland: false,
            ni_direction: null,
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

      await rerouteFerryLeg(markAsNI);


      toast.success(
        markAsNI
          ? (isInbound
            ? "Marked as an inbound Northern Ireland order — collection re-routed to the ferry hand-off"
            : "Marked as a Northern Ireland delivery and re-routed to the ferry hand-off")
          : `Northern Ireland flag removed and ${ferryLeg === "pickup" ? "collection" : "delivery"} restored to the customer address`
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
          <Ship className="h-4 w-4" /> Northern Ireland {isInbound ? "collection" : "delivery"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isNI ? (
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-emerald-600 hover:bg-emerald-600">
                {isInbound ? "Northern Ireland collection (inbound)" : "Northern Ireland delivery"}
              </Badge>
              {foamStatus && (
                <Badge variant="outline">{FOAM_STATUS_LABELS[foamStatus] || foamStatus}</Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {isInbound
                ? `The ferry partner collects in Northern Ireland and we collect from the ferry port, ${CITY_AIR_EXPRESS.formatted}. No foaming is needed — the bike arrives packed.`
                : `Delivery is handed over at the ferry port, ${CITY_AIR_EXPRESS.formatted}.`}{" "}
              A £120 per-bike surcharge applies at invoicing.
            </p>
            <div className="space-y-1">
              <Button
                variant="outline"
                size="sm"
                onClick={resendFerryEmail}
                disabled={sendingFerryEmail}
              >
                {sendingFerryEmail ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4 mr-2" />
                )}
                Resend ferry partner email
              </Button>
              <p className="text-xs text-muted-foreground">
                {ferryNotifiedAt
                  ? `Last sent ${new Date(ferryNotifiedAt).toLocaleString("en-GB")} to ${CITY_AIR_EXPRESS.email}`
                  : `Not recorded as sent yet — sends the booking details to ${CITY_AIR_EXPRESS.email}`}
              </p>
            </div>
          </div>

        ) : (
          <p className="text-sm text-muted-foreground">
            This order is not flagged as a Northern Ireland order.
            {looksNI && (
              <span className="block mt-1 text-amber-600 font-medium">
                The {looksInbound ? "collection" : "delivery"} address looks like Northern Ireland.
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
                {isNI
                  ? "Unmark Northern Ireland order"
                  : `Mark as Northern Ireland ${isInbound ? "collection" : "delivery"}`}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {isNI
                    ? "Remove the Northern Ireland flag?"
                    : `Mark as a Northern Ireland ${isInbound ? "collection" : "delivery"}?`}
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-2 text-sm">
                    {isNI ? (
                      <p>
                        The foam pipeline will be cleared and the Shipday{" "}
                        {ferryLeg === "pickup" ? "collection" : "delivery"} job will be re-created
                        against the real customer address.
                      </p>
                    ) : isInbound ? (
                      <p>
                        The Shipday collection job is re-created against the ferry hand-off point in
                        Manchester (the ferry partner collects in Northern Ireland), and a £120
                        per-bike surcharge applies to future invoicing. No foaming step is added.
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
                    <p>The {isInbound ? "delivery" : "collection"} job is not affected.</p>
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
