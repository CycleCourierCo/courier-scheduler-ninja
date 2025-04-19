
import React from "react";
import { format } from "date-fns";
import { Calendar, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

// Helper function to safely format dates
const safeFormat = (date: Date | string | null | undefined, formatStr: string): string => {
  if (!date) return "Not scheduled";
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      console.warn("Invalid date detected in DateSelection:", date);
      return "Invalid date";
    }
    return format(dateObj, formatStr);
  } catch (error) {
    console.error("Error formatting date in DateSelection:", error, date);
    return "Date error";
  }
};

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
      return dates
        .filter(date => date) // Filter out null/undefined 
        .map(date => {
          try {
            return safeFormat(date, "PPP");
          } catch (err) {
            console.error("Error formatting date in array:", err, date);
            return null;
          }
        })
        .filter(Boolean) // Filter out any failed formats
        .join(", ") || "Not scheduled";
    }
    
    return safeFormat(dates, "PPP");
  };

  // Extend the green background condition to include both collection_scheduled and delivery_scheduled
  const showScheduledStyle = isScheduled || 
    (orderStatus === 'collection_scheduled' && title === "Pickup Dates") ||
    (orderStatus === 'delivery_scheduled' && title === "Pickup Dates") ||
    (orderStatus === 'delivery_scheduled' && title === "Delivery Dates");

  // Only prevent date selection for pickup when it's already scheduled
  const preventPickupSelection = title === "Pickup Dates" && orderStatus === 'collection_scheduled';
  // Only prevent date selection for delivery when it's already scheduled
  const preventDeliverySelection = title === "Delivery Dates" && orderStatus === 'delivery_scheduled';
  
  const isDateSelectionDisabled = preventPickupSelection || preventDeliverySelection || isSubmitting;
  
  // Define the missing canSelectDate variable
  const canSelectDate = Array.isArray(availableDates) && availableDates.length > 0;

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
                {Array.isArray(availableDates) && availableDates
                  .filter(date => date && !isNaN(new Date(date).getTime())) // Filter out invalid dates
                  .map((date, index) => (
                    <SelectItem key={index} value={new Date(date).toISOString()}>
                      {safeFormat(date, "PPP")}
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
                  {scheduledDate ? safeFormat(scheduledDate, "PPP 'at' p") : formatDates(availableDates)}
                </p>
              </div>
            </div>
          ) : (
            <p>{formatDates(availableDates)}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default DateSelection;
