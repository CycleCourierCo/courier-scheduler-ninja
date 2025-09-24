
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
  isSubmitting: boolean;
  isScheduled: boolean;
  pickupDateSelected: boolean;
  deliveryDateSelected: boolean;
  status: string;
  // Date picker props
  pickupDatePicker?: Date;
  deliveryDatePicker?: Date;
  setPickupDatePicker?: (date: Date | undefined) => void;
  setDeliveryDatePicker?: (date: Date | undefined) => void;
  pickupTime: string;
  deliveryTime: string;
  setPickupTime?: (time: string) => void;
  setDeliveryTime?: (time: string) => void;
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
  pickupDatePicker,
  deliveryDatePicker,
  setPickupDatePicker,
  setDeliveryDatePicker,
  pickupTime,
  deliveryTime,
  setPickupTime,
  setDeliveryTime,
}) => {
  return (
    <div className="space-y-4">
      {/* Collection Date Picker */}
      {setPickupDatePicker && (
        <div className="space-y-3 bg-gray-50 p-3 rounded-md">
          <p className="text-sm font-medium">Select collection date and time:</p>
          <div className="flex gap-2 flex-col sm:flex-row">
            <div className="flex-grow">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !pickupDatePicker && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {pickupDatePicker ? format(pickupDatePicker, "PPP") : <span>Pick collection date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={pickupDatePicker}
                    onSelect={setPickupDatePicker}
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
                value={pickupTime}
                onChange={(e) => setPickupTime && setPickupTime(e.target.value)}
                className="w-full"
                placeholder="Collection time"
              />
            </div>
          </div>
        </div>
      )}

      {/* Delivery Date Picker */}
      {setDeliveryDatePicker && (
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
                      !deliveryDatePicker && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {deliveryDatePicker ? format(deliveryDatePicker, "PPP") : <span>Pick delivery date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={deliveryDatePicker}
                    onSelect={setDeliveryDatePicker}
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
