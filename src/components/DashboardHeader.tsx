
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Plus, Calendar, Truck, MapPin } from "lucide-react";
import { syncOrdersToOptimoRoute } from "@/services/optimorouteService";
import { syncOrdersToTrackPod } from "@/services/trackpodService";
import { syncOrdersToShipday } from "@/services/shipdayService";
import { getOrders } from "@/services/orderService";
import { toast } from "sonner";

interface DashboardHeaderProps {
  children?: React.ReactNode;
  showActionButtons?: boolean;
  userRole?: string | null;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ 
  children, 
  showActionButtons = false,
  userRole = null
}) => {
  const isAdmin = userRole === 'admin';
  const [isSyncingOptimoRoute, setIsSyncingOptimoRoute] = useState(false);
  const [isSyncingTrackPod, setIsSyncingTrackPod] = useState(false);
  const [isSyncingShipday, setIsSyncingShipday] = useState(false);

  const handleSyncToOptimoRoute = async () => {
    setIsSyncingOptimoRoute(true);
    try {
      toast.info("Starting OptimoRoute sync...");
      const orders = await getOrders();
      await syncOrdersToOptimoRoute(orders);
    } catch (error) {
      console.error("Error during OptimoRoute sync:", error);
      toast.error("Failed to sync orders to OptimoRoute");
    } finally {
      setIsSyncingOptimoRoute(false);
    }
  };

  const handleSyncToTrackPod = async () => {
    setIsSyncingTrackPod(true);
    try {
      toast.info("Starting Track-POD sync...");
      const orders = await getOrders();
      await syncOrdersToTrackPod(orders);
    } catch (error) {
      console.error("Error during Track-POD sync:", error);
      toast.error("Failed to sync orders to Track-POD");
    } finally {
      setIsSyncingTrackPod(false);
    }
  };

  const handleSyncToShipday = async () => {
    setIsSyncingShipday(true);
    try {
      const orders = await getOrders();
      await syncOrdersToShipday(orders);
    } catch (error) {
      console.error("Error during Shipday sync:", error);
      toast.error("Failed to sync orders to Shipday");
    } finally {
      setIsSyncingShipday(false);
    }
  };

  return (
    <div className="flex flex-col space-y-4 pb-4">
      {children || (
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">
            Manage your delivery orders
          </p>
        </div>
      )}
      {showActionButtons && (
        <div className="flex justify-end space-x-2">
          {isAdmin && (
            <>
              <Button asChild variant="outline">
                <Link to="/scheduling">
                  <Calendar className="mr-2 h-4 w-4" />
                  Job Scheduling
                </Link>
              </Button>
              <Button 
                variant="outline" 
                onClick={handleSyncToOptimoRoute}
                disabled={isSyncingOptimoRoute}
              >
                <Truck className="mr-2 h-4 w-4" />
                {isSyncingOptimoRoute ? "Syncing..." : "Sync to OptimoRoute"}
              </Button>
              <Button 
                variant="outline" 
                onClick={handleSyncToTrackPod}
                disabled={isSyncingTrackPod}
              >
                <MapPin className="mr-2 h-4 w-4" />
                {isSyncingTrackPod ? "Syncing..." : "Sync to Track-POD"}
              </Button>
              <Button 
                variant="outline" 
                onClick={handleSyncToShipday}
                disabled={isSyncingShipday}
              >
                <Truck className="mr-2 h-4 w-4" />
                {isSyncingShipday ? "Syncing..." : "Sync to Shipday"}
              </Button>
            </>
          )}
          <Button asChild>
            <Link to="/create-order">
              <Plus className="mr-2 h-4 w-4" />
              New Order
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
};

export default DashboardHeader;
