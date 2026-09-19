import React, { useEffect, useState, memo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ArrowRight, Bike, Eye, Printer, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { Order } from "@/types/order";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatTimeslotWindow } from "@/utils/timeslotUtils";
import { resendSenderAvailabilityEmail } from "@/services/orderService";
import { generateSingleOrderLabel } from "@/utils/labelUtils";
import { supabase } from "@/integrations/supabase/client";
import JourneyStrip from "@/components/design/JourneyStrip";

interface OrderCardListProps {
  orders: Order[];
  userRole: string | null;
}

const formatDate = (date: Date | string | undefined) => {
  if (!date) return "Not scheduled";
  const dateObj = new Date(date);
  const utcDate = new Date(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate());
  return format(utcDate, "PP");
};

const OrderCardList: React.FC<OrderCardListProps> = memo(({ orders, userRole }) => {
  const navigate = useNavigate();
  const [creatorNames, setCreatorNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const userIds = [...new Set(orders.map((o) => o.user_id))].filter(Boolean);
    if (userIds.length === 0) return;

    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email")
        .in("id", userIds);
      if (error || !data) return;
      setCreatorNames((current) => {
        const next = { ...current };
        data.forEach((p) => {
          next[p.id] = p.name || p.email || "Unknown user";
        });
        return next;
      });
    })();
  }, [orders]);

  const openOrder = (orderId: string) => {
    if (userRole === "admin" || userRole === "route_planner") {
      navigate(`/orders/${orderId}`);
      return;
    }
    navigate(`/customer-orders/${orderId}`);
  };

  const handleResendEmail = async (orderId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const success = await resendSenderAvailabilityEmail(orderId);
      if (success) toast.success("Email resent successfully");
    } catch (error) {
      console.error("Error resending email:", error);
      toast.error("Failed to resend email");
    }
  };

  return (
    <div className="divide-y border-y bg-card">
      {orders.map((order) => {
        const isStaff = userRole === "admin" || userRole === "route_planner";
        return (
          <div
            key={order.id}
            role="button"
            tabIndex={0}
            onClick={() => openOrder(order.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openOrder(order.id);
              }
            }}
            className="grid w-full min-w-0 gap-3 p-4 text-left transition-colors hover:bg-accent xl:grid-cols-[110px_minmax(0,1fr)_auto] xl:items-center"
          >
            <JourneyStrip compact className="w-full max-w-[180px] xl:col-start-1 xl:row-start-1" stops={[
              { label: "Booked", state: "complete", icon: "booked" },
              { label: "Collected", state: order.orderCollected ? "complete" : "current", icon: "collected" },
              { label: "In transit", state: order.status === "delivered" ? "complete" : order.orderCollected ? "current" : "upcoming", icon: "transit" },
              { label: "Delivered", state: order.status === "delivered" ? "complete" : "upcoming", icon: "delivered" },
            ]} />
            <div className="min-w-0 xl:col-start-2 xl:row-start-1">
              <p className="data-text truncate text-sm text-foreground">
                {order.trackingNumber || `${order.id.substring(0, 8)}…`}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {creatorNames[order.user_id] || "Unknown"}
              </p>
              {(order.isNorthernIreland || order.guaranteedDelivery || order.isBoxMyBike || order.needsInspection || order.isEbayOrder) && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  {order.isNorthernIreland && (
                    <Badge variant="ni">
                      NI
                    </Badge>
                  )}
                  {order.guaranteedDelivery && (
                    <Badge variant="booked">
                      Guaranteed
                    </Badge>
                  )}
                  {order.isBoxMyBike && (
                    <Badge variant="neutral">
                      Box
                    </Badge>
                  )}
                  {order.isEbayOrder && (
                    <Badge variant="booked">
                      eBay
                    </Badge>
                  )}
                  {order.needsInspection && (
                    <Badge variant="inspection">
                      Inspect
                    </Badge>
                  )}

                </div>
              )}
            </div>

            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-sm text-foreground xl:col-start-2 xl:row-start-2">
              <span className="min-w-0 truncate" title={order.sender?.name || undefined}>{order.sender?.name || "—"}</span>
              <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="min-w-0 truncate" title={order.receiver?.name || undefined}>{order.receiver?.name || "—"}</span>
            </div>

            <div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground xl:col-start-2 xl:row-start-3">
              <Bike className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {order.bikeBrand && order.bikeModel
                  ? `${order.bikeBrand} ${order.bikeModel}${
                      order.bikeQuantity && order.bikeQuantity > 1 ? ` (×${order.bikeQuantity})` : ""
                    }`
                  : "Bike not specified"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs xl:col-start-2 xl:row-start-4">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Collection</p>
                <p className="truncate text-foreground">{formatDate(order.scheduledPickupDate)}</p>
                {order.pickupTimeslot && (
                  <p className="truncate text-muted-foreground">
                    {formatTimeslotWindow(order.pickupTimeslot)}
                  </p>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Delivery</p>
                <p className="truncate text-foreground">{formatDate(order.scheduledDeliveryDate)}</p>
                {order.deliveryTimeslot && (
                  <p className="truncate text-muted-foreground">
                    {formatTimeslotWindow(order.deliveryTimeslot)}
                  </p>
                )}
              </div>
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-2 xl:col-start-3 xl:row-span-4 xl:row-start-1 xl:justify-end" onClick={(e) => e.stopPropagation()}>
              <StatusBadge status={order.status} />
              {isStaff && (
                <Button variant="outline" size="sm" asChild className="h-8 px-2">
                  <Link to={`/orders/${order.id}`}>
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    Admin
                  </Link>
                </Button>
              )}
              <Button variant="outline" size="sm" asChild className="h-8 px-2">
                <Link to={`/customer-orders/${order.id}`}>
                  <Eye className="h-3.5 w-3.5 mr-1" />
                  View
                </Link>
              </Button>
              {(userRole === "admin" || userRole === "b2b_customer") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    generateSingleOrderLabel(order);
                  }}
                >
                  <Printer className="h-3.5 w-3.5 mr-1" />
                  Label
                </Button>
              )}
              {order.status === "sender_availability_pending" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  onClick={(e) => handleResendEmail(order.id, e)}
                >
                  <RefreshCcw className="h-3.5 w-3.5 mr-1" />
                  Resend
                </Button>
              )}
              <span className="ml-auto text-[11px] text-muted-foreground">
                {format(new Date(order.createdAt), "PP")}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
});

OrderCardList.displayName = "OrderCardList";

export default OrderCardList;
