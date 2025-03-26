
import React from "react";
import { Button } from "@/components/ui/button";

interface SchedulingButtonsProps {
  onSchedule: () => void;
  onAdminSchedule: () => void;
  canSchedule: boolean;
  isSubmitting: boolean;
  isScheduled: boolean;
  pickupDateSelected: boolean;
  deliveryDateSelected: boolean;
  adminPickupDateSelected: boolean | undefined;
  adminDeliveryDateSelected: boolean | undefined;
  showAdminControls?: boolean;
}

const SchedulingButtons: React.FC<SchedulingButtonsProps> = ({
  onSchedule,
  onAdminSchedule,
  canSchedule,
  isSubmitting,
  isScheduled,
  pickupDateSelected,
  deliveryDateSelected,
  adminPickupDateSelected,
  adminDeliveryDateSelected,
  showAdminControls = false,
}) => {
  return (
    <div className="space-y-4">
      {canSchedule && (
        <div className="mt-6">
          <Button 
            onClick={onSchedule} 
            disabled={!pickupDateSelected || !deliveryDateSelected || isSubmitting || isScheduled}
            className="w-full"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                Scheduling Order...
              </>
            ) : (
              "Schedule Order & Create Shipments"
            )}
          </Button>
        </div>
      )}
      
      {showAdminControls && (
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
