
import React from "react";
import { Button } from "@/components/ui/button";

interface SchedulingButtonsProps {
  orderId: string;
  onSchedule: () => void;
  onCreateShipment?: () => void;  // Made optional
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
    pickup: Date | null;
    delivery: Date | null;
  };
}

const SchedulingButtons: React.FC<SchedulingButtonsProps> = ({
  onAdminSchedule,
  isSubmitting,
  isScheduled,
  adminPickupDateSelected,
  adminDeliveryDateSelected,
  showAdminControls = false,
}) => {
  return (
    <div className="space-y-4">
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
