
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

interface JobSchedulingFormProps {
  orderId: string;
  type: 'pickup' | 'delivery';
  onScheduled?: () => void;
  compact?: boolean;
}

const JobSchedulingForm: React.FC<JobSchedulingFormProps> = ({ 
  orderId, 
  type, 
  onScheduled,
  compact = false
}) => {
  const [calendarDate, setCalendarDate] = useState<Date>();
  const [timeValue, setTimeValue] = useState("09:00");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSchedule = async () => {
    if (!calendarDate) {
      toast.error("Please select a date");
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Create a full datetime from the selected date and time
      const [hours, minutes] = timeValue.split(':').map(Number);
      const scheduleDateTime = new Date(calendarDate);
      scheduleDateTime.setHours(hours, minutes);

      // If this is a delivery job, check if it's scheduled before pickup
      if (type === 'delivery') {
        const { data: order } = await supabase
          .from('orders')
          .select('scheduled_pickup_date')
          .eq('id', orderId)
          .single();

        if (order?.scheduled_pickup_date) {
          const pickupDate = new Date(order.scheduled_pickup_date);
          if (scheduleDateTime < pickupDate) {
            toast.error("Delivery cannot be scheduled before collection");
            return;
          }
        }
      }

      // Update only the specific job type in the order
      const updateData = type === 'pickup'
        ? { 
            scheduled_pickup_date: scheduleDateTime.toISOString(),
            status: 'collection_scheduled' as const
          }
        : { 
            scheduled_delivery_date: scheduleDateTime.toISOString(),
            status: 'delivery_scheduled' as const
          };
      
      // Update the order with the scheduled date
      const { error: updateError } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);
        
      if (updateError) throw updateError;

      // Call Shipday service to create the order for only this job type
      await createShipdayOrder(orderId, type);

      toast.success(`${type === 'pickup' ? 'Collection' : 'Delivery'} scheduled successfully`);
      onScheduled?.();
    } catch (error) {
      console.error(`Error scheduling ${type}:`, error);
      toast.error(`Failed to schedule ${type === 'pickup' ? 'collection' : 'delivery'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const labelClass = compact ? "text-xs font-medium" : "text-sm font-medium";
  const popoverButtonClass = compact 
    ? "w-full h-8 py-1 justify-start text-left text-xs font-normal"
    : "w-full justify-start text-left font-normal";
  const buttonClass = compact ? "w-full h-8 text-xs py-1" : "w-full";

  return (
    <div className={`space-y-${compact ? '2' : '4'} ${compact ? 'mt-2' : 'mt-4'}`}>
      <div className="space-y-1">
        <label className={labelClass}>Select date:</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                popoverButtonClass,
                !calendarDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-3 w-3" />
              {calendarDate ? format(calendarDate, "PPP") : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={calendarDate}
              onSelect={setCalendarDate}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-1">
        <label className={labelClass}>Select time:</label>
        <Input
          type="time"
          value={timeValue}
          onChange={(e) => setTimeValue(e.target.value)}
          className={`w-full ${compact ? 'h-8 text-xs' : ''}`}
        />
      </div>

      <Button
        onClick={handleSchedule}
        disabled={isSubmitting || !calendarDate}
        className={buttonClass}
        size={compact ? "sm" : "default"}
      >
        {isSubmitting ? "Scheduling..." : `Schedule ${type === 'pickup' ? 'Collection' : 'Delivery'}`}
      </Button>
    </div>
  );
};

export default JobSchedulingForm;
