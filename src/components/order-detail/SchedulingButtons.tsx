
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
  // Always show the date picker regardless of status
  const showDirectDatePicker = setDeliveryDate;
  
  return (
    <div className="space-y-4">
      {/* Always show date picker */}
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
    </div>
  );
};

export default SchedulingButtons;
