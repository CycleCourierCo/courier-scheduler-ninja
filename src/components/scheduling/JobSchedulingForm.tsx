
import React from 'react';
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { updateOrderScheduledDates } from '@/services/orderService';
import { toast } from "sonner";

interface JobSchedulingFormProps {
  orderId: string;
  type: 'pickup' | 'delivery';
  onScheduled: () => void;
}

const JobSchedulingForm: React.FC<JobSchedulingFormProps> = ({ orderId, type, onScheduled }) => {
  const [date, setDate] = useState<Date>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!date) {
      toast.error("Please select a date");
      return;
    }

    try {
      setIsSubmitting(true);
      
      // For pickup, set delivery date to the next day
      // For delivery, set pickup date to the previous day
      const pickupDate = type === 'pickup' ? date : new Date(date.getTime() - 24 * 60 * 60 * 1000);
      const deliveryDate = type === 'delivery' ? date : new Date(date.getTime() + 24 * 60 * 60 * 1000);
      
      const result = await updateOrderScheduledDates(orderId, pickupDate, deliveryDate);
      
      if (result) {
        toast.success(`${type === 'pickup' ? 'Collection' : 'Delivery'} scheduled successfully`);
        onScheduled();
      } else {
        toast.error("Failed to schedule");
      }
    } catch (error) {
      console.error("Error scheduling:", error);
      toast.error("Failed to schedule");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "PPP") : <span>Select date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      <Button 
        className="w-full" 
        onClick={handleSubmit}
        disabled={!date || isSubmitting}
      >
        {isSubmitting ? "Scheduling..." : "Schedule"}
      </Button>
    </div>
  );
};

export default JobSchedulingForm;
