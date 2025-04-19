
import React from "react";
import { format } from "date-fns";
import { Calendar, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface DateSelectionProps {
  title: string;
  availableDates?: Date | Date[];
  scheduledDate?: Date;
  selectedDate: string | null;
  setSelectedDate: (date: string | null) => void;
  timeValue: string;
  setTimeValue: (time: string) => void;
  calendarDate?: Date | undefined;
  setCalendarDate: (date: Date | undefined) => void;
  isSubmitting: boolean;
  isScheduled: boolean;
  showAdminControls?: boolean;
  orderStatus?: string;
}

const DateSelection: React.FC<DateSelectionProps> = ({
  title,
  availableDates,
  scheduledDate,
  selectedDate,
  setSelectedDate,
  timeValue,
  setTimeValue,
  calendarDate,
  setCalendarDate,
  isSubmitting,
  isScheduled,
  showAdminControls = false,
  orderStatus,
}) => {
  const formatDates = (dates: Date | Date[] | undefined) => {
    if (!dates) return "Not scheduled";
    
    if (Array.isArray(dates)) {
      return dates.map(date => format(new Date(date), "PPP")).join(", ");
    }
    
    return format(new Date(dates), "PPP");
  };

  // Show green background for scheduled pickup date when status is collection_scheduled
  const showScheduledStyle = isScheduled || 
    (orderStatus === 'collection_scheduled' && title === "Pickup Dates") ||
    (orderStatus === 'delivery_scheduled' && title === "Delivery Dates");

  const canSelectDate = Array.isArray(availableDates) && availableDates.length > 0;

  // Only prevent date selection for pickup when it's already scheduled
  const preventPickupSelection = title === "Pickup Dates" && orderStatus === 'collection_scheduled';
  // Only prevent date selection for delivery when it's already scheduled
  const preventDeliverySelection = title === "Delivery Dates" && orderStatus === 'delivery_scheduled';
  
  const isDateSelectionDisabled = preventPickupSelection || preventDeliverySelection || isSubmitting;

  return (
    <div>
      <div className="flex items-center space-x-2">
        <Calendar className="text-courier-600" />
        <h3 className="font-semibold">{title}</h3>
      </div>
      
      {canSelectDate && !showScheduledStyle ? (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">Available dates:</p>
          <p>{formatDates(availableDates)}</p>
          
          <div className="mt-2">
            <label className="text-sm font-medium">Select date:</label>
            <Select
              value={selectedDate || ""}
              onValueChange={setSelectedDate}
              disabled={isDateSelectionDisabled}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a date" />
              </SelectTrigger>
              <SelectContent>
                {Array.isArray(availableDates) && availableDates.map((date, index) => (
                  <SelectItem key={index} value={new Date(date).toISOString()}>
                    {format(new Date(date), "PPP")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="mt-2">
            <label className="text-sm font-medium">Select time:</label>
            <Input
              type="time"
              value={timeValue}
              onChange={(e) => setTimeValue(e.target.value)}
              disabled={isDateSelectionDisabled}
              className="w-full"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {scheduledDate || showScheduledStyle ? (
            <div className="bg-green-50 p-2 rounded-md border border-green-200">
              <div className="flex items-center">
                <Check className="h-4 w-4 text-green-600 mr-2" />
                <p className="font-medium">
                  {scheduledDate ? format(new Date(scheduledDate), "PPP 'at' p") : formatDates(availableDates)}
                </p>
              </div>
            </div>
          ) : (
            <p>{formatDates(availableDates)}</p>
          )}
          
          {/* Remove admin controls since they're no longer needed */}
        </div>
      )}
    </div>
  );
};

export default DateSelection;
