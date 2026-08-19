import React, { useState } from "react";
import { Box } from "lucide-react";
import { Button } from "@/components/ui/button";
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

const BoxMyBikeConversion: React.FC<BoxMyBikeConversionProps> = ({ order, onRefresh }) => {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isBoxMyBike = !!order.isBoxMyBike;
  const startingStage = COLLECTED_STATUSES.has(String(order.status))
    ? "in_depot_awaiting_boxing"
    : "awaiting_depot";

  const handleConfirm = async () => {
    if (!order.id) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update(
          isBoxMyBike
            ? { is_box_my_bike: false, box_my_bike_status: null, updated_at: new Date().toISOString() }
            : { is_box_my_bike: true, box_my_bike_status: startingStage, updated_at: new Date().toISOString() }
        )
        .eq("id", order.id);

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
        onClick={() => setOpen(true)}
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
                  will be cleared. Any uploaded label or courier tracking link is kept.
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
                  . No invoice is created — billing stays manual.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
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
