import React, { useState } from "react";
import { Box, Wrench, Ship, CalendarCheck, Receipt, Settings2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";

import BoxMyBikeConversion from "./BoxMyBikeConversion";
import BoxBuyerDetails from "./BoxBuyerDetails";
import NorthernIrelandEditor from "./NorthernIrelandEditor";
import GuaranteedDeliveryCard from "./GuaranteedDeliveryCard";
import {
  enableInspectionForOrder,
  createInspectionServiceInvoice,
} from "@/services/inspectionService";
import {
  BOX_MY_BIKE_STATUS_LABELS,
  FOAM_STATUS_LABELS,
  Order,
  type BoxMyBikeStatus,
  type FoamStatus,
} from "@/types/order";

interface OrderServicesPanelProps {
  order: Order & Record<string, any>;
  onRefresh: () => Promise<void> | void;
}

const InspectServiceSection: React.FC<OrderServicesPanelProps> = ({ order, onRefresh }) => {
  const [isEnabling, setIsEnabling] = useState(false);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);

  const handleEnable = async () => {
    if (!order.id) return;
    try {
      setIsEnabling(true);
      await enableInspectionForOrder(order.id);
      await onRefresh();
      toast.success("Inspection enabled for this order");
    } catch (error) {
      console.error("Error enabling inspection:", error);
      toast.error("Failed to enable inspection");
    } finally {
      setIsEnabling(false);
    }
  };

  const handleInvoice = async () => {
    if (!order.id) return;
    try {
      setIsCreatingInvoice(true);
      const result = await createInspectionServiceInvoice(order.id);
      toast.success(`Inspection invoice created: ${result.invoiceNumber}`, {
        action: result.invoiceUrl
          ? { label: "Open", onClick: () => window.open(result.invoiceUrl, "_blank") }
          : undefined,
      });
    } catch (error: any) {
      console.error("Error creating inspection invoice:", error);
      toast.error(error?.message || "Failed to create inspection invoice");
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {order.needsInspection
          ? "This bike is booked in for inspection and servicing before delivery."
          : "Enable inspection to add this bike to the workshop pipeline before delivery."}
      </p>
      <div className="flex flex-wrap gap-2">
        {!order.needsInspection && (
          <Button
            onClick={handleEnable}
            disabled={isEnabling}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Wrench className="h-4 w-4" />
            {isEnabling ? "Enabling..." : "Inspect and Service"}
          </Button>
        )}
        {order.needsInspection && order.id && (
          <Button
            onClick={handleInvoice}
            disabled={isCreatingInvoice}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Receipt className="h-4 w-4" />
            {isCreatingInvoice ? "Creating..." : "Create Inspection Invoice"}
          </Button>
        )}
      </div>
    </div>
  );
};

const OrderServicesPanel: React.FC<OrderServicesPanelProps> = ({ order, onRefresh }) => {
  const refresh = async () => {
    await onRefresh();
  };

  const boxStatus = (order.boxMyBikeStatus ?? (order as any).box_my_bike_status) as
    | BoxMyBikeStatus
    | null;
  const isBoxMyBike = !!order.isBoxMyBike;

  const isNI = Boolean(order.isNorthernIreland ?? (order as any).is_northern_ireland);
  const niDirection = (order.niDirection ?? (order as any).ni_direction) as
    | "outbound"
    | "inbound"
    | null;
  const foamStatus = (order.foamStatus ?? (order as any).foam_status) as FoamStatus | null;

  const inspectionStatus = order.inspection_status as string | null;
  const guaranteed = Boolean((order as any).guaranteed_delivery ?? order.guaranteedDelivery);

  const row = (
    value: string,
    icon: React.ReactNode,
    title: string,
    badges: React.ReactNode,
    content: React.ReactNode
  ) => (
    <AccordionItem value={value}>
      <AccordionTrigger className="py-3 hover:no-underline">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 pr-2 text-left">
          <span className="flex items-center gap-2 font-medium">
            {icon}
            <span className="break-words">{title}</span>
          </span>
          <span className="flex flex-wrap items-center gap-1.5">{badges}</span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pt-1">{content}</AccordionContent>
    </AccordionItem>
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings2 className="h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words">Services &amp; Add-ons</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Accordion type="multiple" className="w-full">
          {row(
            "box",
            <Box className="h-4 w-4 shrink-0" />,
            "Box My Bike",
            <>
              {isBoxMyBike ? (
                <Badge className="bg-courier-600 hover:bg-courier-600">On</Badge>
              ) : (
                <Badge variant="outline">Not set</Badge>
              )}
              {isBoxMyBike && boxStatus && (
                <Badge variant="secondary">
                  {BOX_MY_BIKE_STATUS_LABELS[boxStatus] || boxStatus}
                </Badge>
              )}
            </>,
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {isBoxMyBike
                  ? "This order is in the Box My Bike pipeline and appears on the Box My Bike page. Delivery goes to our depot, so the buyer below receives the updates."
                  : "Convert this order so the bike is packed by us and handed to a third-party courier."}
              </p>
              {isBoxMyBike && <BoxBuyerDetails order={order} onRefresh={refresh} />}
              <BoxMyBikeConversion order={order} onRefresh={refresh} />
            </div>
          )}

          {row(
            "inspection",
            <Wrench className="h-4 w-4 shrink-0" />,
            "Inspect & Service",
            <>
              {order.needsInspection ? (
                <Badge className="bg-amber-600 hover:bg-amber-600">Enabled</Badge>
              ) : (
                <Badge variant="outline">Not set</Badge>
              )}
              {order.needsInspection && inspectionStatus && (
                <Badge variant="secondary">{inspectionStatus.replace(/_/g, " ")}</Badge>
              )}
            </>,
            <InspectServiceSection order={order} onRefresh={onRefresh} />
          )}

          {row(
            "ni",
            <Ship className="h-4 w-4 shrink-0" />,
            "Northern Ireland",
            <>
              {isNI ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-600">
                  {niDirection === "inbound" ? "Inbound" : "Outbound"}
                </Badge>
              ) : (
                <Badge variant="outline">Not set</Badge>
              )}
              {isNI && foamStatus && (
                <Badge variant="secondary">{FOAM_STATUS_LABELS[foamStatus] || foamStatus}</Badge>
              )}
            </>,
            <NorthernIrelandEditor order={order} onUpdate={refresh} bare />
          )}

          {row(
            "guaranteed",
            <CalendarCheck className="h-4 w-4 shrink-0" />,
            "Guaranteed delivery date",
            guaranteed ? (
              <Badge className="bg-green-600 hover:bg-green-600 text-white">Guaranteed</Badge>
            ) : (
              <Badge variant="outline">Not set</Badge>
            ),
            <GuaranteedDeliveryCard order={order} onUpdate={refresh} bare />
          )}
        </Accordion>
      </CardContent>
    </Card>
  );
};

export default OrderServicesPanel;
