
import React from "react";
import { Button } from "@/components/ui/button";

interface SchedulingButtonsProps {
  orderId: string;
  onSchedulePickup: () => void;
  onScheduleDelivery: () => void;
  onScheduleBoth: () => void;
  isSubmitting: boolean;
  isScheduled: boolean;
  pickupDateSelected: boolean;
  deliveryDateSelected: boolean;
  status: string;
}

const SchedulingButtons: React.FC<SchedulingButtonsProps> = ({
  onSchedulePickup,
  onScheduleDelivery,
  onScheduleBoth,
  isSubmitting,
  isScheduled,
  pickupDateSelected,
  deliveryDateSelected,
  status,
}) => {
  const showDeliveryButton = status === 'scheduled_dates_pending' || status === 'collection_scheduled';
  
  if ((status !== 'scheduled_dates_pending' && status !== 'collection_scheduled') || isScheduled) {
    return null;
  }

  return (
    <div className="space-y-4">
      {status === 'scheduled_dates_pending' && (
        <Button 
          onClick={onSchedulePickup} 
          disabled={!pickupDateSelected || isSubmitting}
          className="w-full"
          variant="default"
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
              Scheduling Pickup...
            </>
          ) : (
            "Schedule Pickup Date & Create Shipment"
          )}
        </Button>
      )}

      {showDeliveryButton && (
        <Button 
          onClick={onScheduleDelivery} 
          disabled={!deliveryDateSelected || isSubmitting}
          className="w-full"
          variant="default"
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
              Scheduling Delivery...
            </>
          ) : (
            "Schedule Delivery Date & Create Shipment"
          )}
        </Button>
      )}

      {status === 'scheduled_dates_pending' && (
        <Button 
          onClick={onScheduleBoth} 
          disabled={!pickupDateSelected || !deliveryDateSelected || isSubmitting}
          className="w-full"
          variant="default"
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
              Scheduling Order...
            </>
          ) : (
            "Schedule Order & Create Shipment"
          )}
        </Button>
      )}
    </div>
  );
};

export default SchedulingButtons;
