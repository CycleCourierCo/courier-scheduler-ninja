
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { createShipdayOrder } from '@/services/shipdayService';
import { supabase } from "@/integrations/supabase/client";

interface DualSchedulingFormProps {
  orderId: string;
  onScheduled?: () => void;
}

const DualSchedulingForm: React.FC<DualSchedulingFormProps> = ({ 
  orderId, 
  onScheduled,
}) => {
  const [pickupDate, setPickupDate] = useState<Date>();
  const [deliveryDate, setDeliveryDate] = useState<Date>();
  const [pickupTime, setPickupTime] = useState("09:00");
  const [deliveryTime, setDeliveryTime] = useState("12:00");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSchedule = async () => {
    if (!pickupDate || !deliveryDate) {
      toast.error("Please select both pickup and delivery dates");
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Create full datetime objects from the selected dates and times
      const [pickupHours, pickupMinutes] = pickupTime.split(':').map(Number);
      const schedulePickupDateTime = new Date(pickupDate);
      schedulePickupDateTime.setHours(pickupHours, pickupMinutes);

      const [deliveryHours, deliveryMinutes] = deliveryTime.split(':').map(Number);
      const scheduleDeliveryDateTime = new Date(deliveryDate);
      scheduleDeliveryDateTime.setHours(deliveryHours, deliveryMinutes);

      // Update the order with both scheduled dates
      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          scheduled_pickup_date: schedulePickupDateTime.toISOString(),
          scheduled_delivery_date: scheduleDeliveryDateTime.toISOString(),
          status: 'scheduled'
        })
        .eq('id', orderId);
        
      if (updateError) throw updateError;

      // Create Shipday orders for both pickup and delivery
      await createShipdayOrder(orderId);

      toast.success("Collection and delivery scheduled successfully");
      onScheduled?.();
    } catch (error) {
      console.error("Error scheduling order:", error);
      toast.error("Failed to schedule collection and delivery");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Select pickup date:</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !pickupDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {pickupDate ? format(pickupDate, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={pickupDate}
                onSelect={setPickupDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Select pickup time:</label>
          <Input
            type="time"
            value={pickupTime}
            onChange={(e) => setPickupTime(e.target.value)}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Select delivery date:</label>
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
                {deliveryDate ? format(deliveryDate, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={deliveryDate}
                onSelect={setDeliveryDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Select delivery time:</label>
          <Input
            type="time"
            value={deliveryTime}
            onChange={(e) => setDeliveryTime(e.target.value)}
            className="w-full"
          />
        </div>
      </div>

      <Button
        onClick={handleSchedule}
        disabled={isSubmitting || !pickupDate || !deliveryDate}
        className="w-full"
      >
        {isSubmitting ? "Scheduling..." : "Schedule Collection & Delivery"}
      </Button>
    </div>
  );
};

export default DualSchedulingForm;
