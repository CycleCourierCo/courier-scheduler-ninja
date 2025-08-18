
import React from "react";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface SchedulingButtonsProps {
  orderId: string;
  onSchedulePickup: () => void;
  onScheduleDelivery: () => void;
  onScheduleBoth: () => void;
  onAdminScheduleBoth?: () => void; // New prop for admin scheduling with date picker
  onAdminSchedulePickup?: () => void; // New prop for admin pickup only
  onAdminScheduleDelivery?: () => void; // New prop for admin delivery only
  isSubmitting: boolean;
  isScheduled: boolean;
  pickupDateSelected: boolean;
  deliveryDateSelected: boolean;
  status: string;
  // Date picker props
  pickupDatePicker?: Date;
  deliveryDatePicker?: Date;
  // New props for direct date selection
  deliveryDate?: Date;
  setDeliveryDate?: (date: Date | undefined) => void;
  deliveryTime: string;
  setDeliveryTime?: (time: string) => void;
}

const SchedulingButtons: React.FC<SchedulingButtonsProps> = ({
  onSchedulePickup,
  onScheduleDelivery,
  onScheduleBoth,
  onAdminScheduleBoth,
  onAdminSchedulePickup,
  onAdminScheduleDelivery,
  isSubmitting,
  isScheduled,
  pickupDateSelected,
  deliveryDateSelected,
  status,
  pickupDatePicker,
  deliveryDatePicker,
  deliveryDate,
  setDeliveryDate,
  deliveryTime,
  setDeliveryTime,
}) => {
  const showDeliveryButton = status === 'scheduled_dates_pending' || status === 'collection_scheduled' || status === 'collected';
  const showDirectDatePicker = status === 'collected' && !deliveryDateSelected && setDeliveryDate;
  const showAdminScheduling = status === 'scheduled_dates_pending' && pickupDatePicker && deliveryDatePicker;
  
  if ((status !== 'scheduled_dates_pending' && status !== 'collection_scheduled' && status !== 'collected') || isScheduled) {
    return null;
  }

  return (
    <div className="space-y-4">
      {status === 'scheduled_dates_pending' && !showAdminScheduling && (
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

      {/* Admin scheduling with date picker for scheduled_dates_pending */}
      {showAdminScheduling && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Admin Schedule Pickup Only */}
            {onAdminSchedulePickup && (
              <Button 
                onClick={onAdminSchedulePickup} 
                disabled={!pickupDatePicker || isSubmitting}
                className="bg-orange-600 hover:bg-orange-700"
                variant="default"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                    Scheduling...
                  </>
                ) : (
                  "Schedule Collection (Admin)"
                )}
              </Button>
            )}

            {/* Admin Schedule Delivery Only */}
            {onAdminScheduleDelivery && (
              <Button 
                onClick={onAdminScheduleDelivery} 
                disabled={!deliveryDatePicker || isSubmitting}
                className="bg-orange-600 hover:bg-orange-700"
                variant="default"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                    Scheduling...
                  </>
                ) : (
                  "Schedule Delivery (Admin)"
                )}
              </Button>
            )}
          </div>

          {/* Admin Schedule Both */}
          {onAdminScheduleBoth && (
            <Button 
              onClick={onAdminScheduleBoth} 
              disabled={!pickupDatePicker || !deliveryDatePicker || isSubmitting}
              className="w-full bg-orange-700 hover:bg-orange-800"
              variant="default"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                  Scheduling Order...
                </>
              ) : (
                "Schedule Both Collection & Delivery (Admin)"
              )}
            </Button>
          )}
        </div>
      )}

      {showDirectDatePicker && (
        <div className="space-y-3 bg-gray-50 p-3 rounded-md">
          <p className="text-sm font-medium">Select delivery date and time:</p>
          <div className="flex gap-2 flex-col sm:flex-row">
            <div className="flex-grow">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !deliveryDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {deliveryDate ? format(deliveryDate, "PPP") : <span>Pick delivery date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={deliveryDate}
                    onSelect={setDeliveryDate}
                    initialFocus
                    disabled={(date) => date < new Date()}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="w-full sm:w-32">
              <Input
                type="time"
                value={deliveryTime}
                onChange={(e) => setDeliveryTime && setDeliveryTime(e.target.value)}
                className="w-full"
                placeholder="Delivery time"
              />
            </div>
          </div>
        </div>
      )}

      {showDeliveryButton && (
        <Button 
          onClick={onScheduleDelivery} 
          disabled={(showDirectDatePicker ? !deliveryDate : !deliveryDateSelected) || isSubmitting}
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

      {status === 'scheduled_dates_pending' && !showAdminScheduling && (
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
