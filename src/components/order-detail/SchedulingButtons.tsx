
import React from "react";
import { Button } from "@/components/ui/button";

interface SchedulingButtonsProps {
  orderId: string;
  onSchedule: () => void;
  onCreateShipment: () => void;
  onAdminSchedule: () => void;
  canSchedule: boolean;
  isSubmitting: boolean;
  isScheduled: boolean;
  pickupDateSelected: boolean;
  deliveryDateSelected: boolean;
  adminPickupDateSelected: boolean | undefined;
  adminDeliveryDateSelected: boolean | undefined;
  showAdminControls?: boolean;
  scheduledDates?: {
    pickup?: Date | null;
    delivery?: Date | null;
  };
  orderStatus?: string;
}

const SchedulingButtons: React.FC<SchedulingButtonsProps> = ({
  onSchedule,
  onCreateShipment,
  onAdminSchedule,
  isSubmitting,
  isScheduled,
  adminPickupDateSelected,
  adminDeliveryDateSelected,
  showAdminControls = false,
  scheduledDates,
  orderStatus,
}) => {
  // Check if both scheduled dates are set for enabling the Create Shipment button
  const canCreateShipment = scheduledDates?.pickup && scheduledDates?.delivery;
  
  // Determine if pickup is ready to be scheduled
  const canSchedulePickup = !isScheduled && orderStatus !== 'collection_scheduled' && 
                          orderStatus !== 'driver_to_collection' && 
                          orderStatus !== 'collected';

  // Determine if delivery can be scheduled (only after pickup is done)
  const canScheduleDelivery = (orderStatus === 'collected') && !scheduledDates?.delivery;

  return (
    <div className="space-y-4">
      {/* Pickup scheduling section */}
      {canSchedulePickup && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Collection Phase</h3>
          <Button 
            onClick={onSchedule} 
            disabled={isSubmitting}
            className="w-full"
            variant="default"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                Scheduling Collection...
              </>
            ) : (
              "Schedule Collection"
            )}
          </Button>
          
          {scheduledDates?.pickup && (
            <Button 
              onClick={onCreateShipment} 
              disabled={isSubmitting}
              className="w-full"
              variant="secondary"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                  Creating Collection Shipment...
                </>
              ) : (
                "Create Collection Shipment"
              )}
            </Button>
          )}
        </div>
      )}

      {/* Delivery scheduling section */}
      {canScheduleDelivery && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Delivery Phase</h3>
          <Button 
            onClick={onSchedule} 
            disabled={isSubmitting}
            className="w-full"
            variant="default"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                Scheduling Delivery...
              </>
            ) : (
              "Schedule Delivery"
            )}
          </Button>
          
          {scheduledDates?.delivery && (
            <Button 
              onClick={onCreateShipment} 
              disabled={isSubmitting}
              className="w-full"
              variant="secondary"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                  Creating Delivery Shipment...
                </>
              ) : (
                "Create Delivery Shipment"
              )}
            </Button>
          )}
        </div>
      )}

      {/* Show admin scheduling controls if showAdminControls is true and order is not scheduled */}
      {showAdminControls && !isScheduled && (
        <div className="mt-6 border-t pt-4">
          <Button 
            onClick={onAdminSchedule} 
            disabled={!adminPickupDateSelected || !adminDeliveryDateSelected || isSubmitting}
            className="w-full"
            variant="default"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                Scheduling Order...
              </>
            ) : (
              "Admin: Schedule Order & Create Shipments"
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default SchedulingButtons;
