
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

interface JobSchedulingFormProps {
  orderId: string;
  type: 'pickup' | 'delivery';
  onScheduled?: () => void;
}

const JobSchedulingForm: React.FC<JobSchedulingFormProps> = ({ orderId, type, onScheduled }) => {
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

      // Call Shipday service to create the order
      await createShipdayOrder(orderId);

      toast.success(`${type === 'pickup' ? 'Collection' : 'Delivery'} scheduled successfully`);
      onScheduled?.();
    } catch (error) {
      console.error('Error scheduling job:', error);
      toast.error('Failed to schedule job');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Select date:</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal",
                !calendarDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
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

      <div className="space-y-2">
        <label className="text-sm font-medium">Select time:</label>
        <Input
          type="time"
          value={timeValue}
          onChange={(e) => setTimeValue(e.target.value)}
          className="w-full"
        />
      </div>

      <Button
        onClick={handleSchedule}
        disabled={isSubmitting || !calendarDate}
        className="w-full"
      >
        {isSubmitting ? "Scheduling..." : `Schedule ${type === 'pickup' ? 'Collection' : 'Delivery'} & Create Shipment`}
      </Button>
    </div>
  );
};

export default JobSchedulingForm;
