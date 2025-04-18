
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
}) => {
  // Check if both scheduled dates are set for enabling the Create Shipment button
  const canCreateShipment = scheduledDates?.pickup && scheduledDates?.delivery;

  return (
    <div className="space-y-4">
      {/* Regular scheduling button */}
      {!isScheduled && (
        <Button 
          onClick={onSchedule} 
          disabled={isSubmitting}
          className="w-full"
          variant="default"
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
              Scheduling Order...
            </>
          ) : (
            "Schedule Order"
          )}
        </Button>
      )}

      {/* Create Shipment button - visible but only enabled when both dates are set */}
      <Button 
        onClick={onCreateShipment} 
        disabled={!canCreateShipment || isSubmitting}
        className="w-full"
        variant="secondary"
      >
        {isSubmitting ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
            Creating Shipment...
          </>
        ) : (
          "Create Shipment"
        )}
      </Button>

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
