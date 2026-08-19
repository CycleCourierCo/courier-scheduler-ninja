import React, { useState } from "react";
import { Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Order } from "@/types/order";
import { DEPOT_RECEIVER } from "@/constants/depot";

interface BoxMyBikeConversionProps {
  order: Order;
  onRefresh?: () => Promise<void>;
}

// Statuses that mean the bike is already with us (or beyond collection)
const COLLECTED_STATUSES = new Set([
  "collected",
  "driver_to_delivery",
  "awaiting_depot",
  "in_depot_awaiting_boxing",
  "boxed_awaiting_label",
  "awaiting_3p_collection",
  "collected_by_3p",
  "delivered_by_3p",
  "delivered",
]);

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const BoxMyBikeConversion: React.FC<BoxMyBikeConversionProps> = ({ order, onRefresh }) => {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isBoxMyBike = !!order.isBoxMyBike;
  const startingStage = COLLECTED_STATUSES.has(String(order.status))
    ? "in_depot_awaiting_boxing"
    : "awaiting_depot";

  // Pre-fill the buyer from the current receiver — that is who the bike was
  // originally going to before the depot takes over as the delivery address.
  const initialBuyer = React.useMemo(
    () => ({
      name: order.boxBuyer?.name || order.receiver?.name || "",
      email: order.boxBuyer?.email || order.receiver?.email || "",
      phone: order.boxBuyer?.phone || order.receiver?.phone || "",
    }),
    [order]
  );
  const [buyer, setBuyer] = useState(initialBuyer);

  const openDialog = () => {
    setBuyer(initialBuyer);
    setOpen(true);
  };

  const handleConfirm = async () => {
    if (!order.id) return;

    if (!isBoxMyBike) {
      if (!buyer.name.trim()) {
        toast.error("Buyer name is required");
        return;
      }
      if (!EMAIL_REGEX.test(buyer.email.trim())) {
        toast.error("A valid buyer email is required");
        return;
      }
    }

    setIsSaving(true);
    try {
      const patch: Record<string, any> = isBoxMyBike
        ? { is_box_my_bike: false, box_my_bike_status: null, updated_at: new Date().toISOString() }
        : {
            is_box_my_bike: true,
            box_my_bike_status: startingStage,
            box_buyer: {
              name: buyer.name.trim(),
              email: buyer.email.trim(),
              phone: buyer.phone.trim(),
            },
            receiver: DEPOT_RECEIVER,
            updated_at: new Date().toISOString(),
          };

      const { error } = await supabase.from("orders").update(patch as any).eq("id", order.id);

      if (error) throw error;

      toast.success(
        isBoxMyBike ? "Order removed from Box My Bike" : "Order converted to Box My Bike"
      );
      setOpen(false);
      if (onRefresh) await onRefresh();
    } catch (err: any) {
      console.error("Box My Bike conversion failed:", err);
      toast.error(err?.message || "Failed to update Box My Bike status");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={openDialog}
        className="flex items-center gap-2"
      >
        <Box className="h-4 w-4" />
        {isBoxMyBike ? "Remove from Box My Bike" : "Convert to Box My Bike"}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isBoxMyBike ? "Remove from Box My Bike?" : "Convert to Box My Bike?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isBoxMyBike ? (
                <>
                  This order will no longer appear on the Box My Bike page and its packing stage
                  will be cleared. Any uploaded label or courier tracking link is kept, and the
                  delivery address stays as the depot — edit it manually if the bike now needs
                  delivering elsewhere.
                </>
              ) : (
                <>
                  This order will join the Box My Bike pipeline and appear on the Box My Bike page,
                  starting at{" "}
                  <strong>
                    {startingStage === "in_depot_awaiting_boxing"
                      ? "In depot awaiting boxing"
                      : "Awaiting depot"}
                  </strong>
                  . The delivery address becomes our depot ({DEPOT_RECEIVER.address.zipCode}) and
                  the current receiver is saved as the buyer below so they stay updated. No invoice
                  is created — billing stays manual.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {!isBoxMyBike && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="box-buyer-name">Buyer name</Label>
                <Input
                  id="box-buyer-name"
                  value={buyer.name}
                  onChange={(e) => setBuyer({ ...buyer, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="box-buyer-email">Buyer email</Label>
                <Input
                  id="box-buyer-email"
                  type="email"
                  value={buyer.email}
                  onChange={(e) => setBuyer({ ...buyer, email: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="box-buyer-phone">Buyer phone</Label>
                <Input
                  id="box-buyer-phone"
                  value={buyer.phone}
                  onChange={(e) => setBuyer({ ...buyer, phone: e.target.value })}
                />
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirm();
              }}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : isBoxMyBike ? "Remove" : "Convert"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default BoxMyBikeConversion;
