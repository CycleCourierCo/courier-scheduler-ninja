
import React from "react";
import { format, isValid, parseISO } from "date-fns";
import { Calendar, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

const safeFormat = (date: Date | string | null | undefined, formatStr: string): string => {
  if (!date) return "Not scheduled";
  
  try {
    if (typeof date === 'string' && date.trim() === '') {
      return "Not scheduled";
    }
    
    let dateObj: Date;
    
    if (typeof date === 'string') {
      try {
        if (date.includes('T') || date.includes('-')) {
          dateObj = parseISO(date);
        } else {
          dateObj = new Date(date);
        }
      } catch (parseError) {
        console.warn("Failed to parse date string in DateSelection:", date, parseError);
        return "Invalid date format";
      }
    } else {
      dateObj = date as Date;
    }
    
    // More thorough date validation
    if (!dateObj || !(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
      console.warn("Invalid date detected in DateSelection:", date);
      return "Invalid date";
    }
    
    // Additional safety check for invalid time values
    try {
      // This will throw if the date is invalid for toISOString
      dateObj.toISOString();
      // Only format if we have a valid date
      return format(dateObj, formatStr);
    } catch (timeError) {
      console.error("Invalid time value in date object:", dateObj, timeError);
      return "Invalid time";
    }
  } catch (error) {
    console.error("Error formatting date in DateSelection:", error, date);
    return "Date format error";
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
      // Filter out invalid dates before attempting to format them
      return dates
        .filter(d => d && (d instanceof Date) && !isNaN(new Date(d).getTime()))
        .map(date => {
          try {
            return safeFormat(date, "PPP");
          } catch (err) {
            console.error("Error formatting date in array:", err, date);
            return null;
          }
        })
        .filter(Boolean)
        .join(", ") || "Not scheduled";
    }
    
    return safeFormat(dates, "PPP");
  };

  // Show scheduled pickup date for collection_scheduled, collected, and delivery_scheduled (pickup dates)
  const showScheduledStyle = isScheduled || 
    (orderStatus === 'collection_scheduled' && title === "Pickup Dates") ||
    (orderStatus === 'collected' && title === "Pickup Dates") || // Added 'collected' for pickup dates
    (orderStatus === 'delivery_scheduled' && title === "Pickup Dates") ||
    (orderStatus === 'delivery_scheduled' && title === "Delivery Dates");

  const preventPickupSelection = title === "Pickup Dates" && 
    (orderStatus === 'collection_scheduled' || orderStatus === 'collected'); // Added 'collected'
    
  const preventDeliverySelection = title === "Delivery Dates" && orderStatus === 'delivery_scheduled';
  
  const isDateSelectionDisabled = preventPickupSelection || preventDeliverySelection || isSubmitting;
  
  // Improve validation of available dates array
  const canSelectDate = Array.isArray(availableDates) && availableDates.length > 0 && 
    availableDates.some(date => date && !isNaN(new Date(date).getTime()));

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
                  .filter(date => date && !isNaN(new Date(date).getTime()))
                  .map((date, index) => {
                    try {
                      const validDate = new Date(date);
                      if (!isNaN(validDate.getTime())) {
                        return (
                          <SelectItem key={index} value={validDate.toISOString()}>
                            {safeFormat(validDate, "PPP")}
                          </SelectItem>
                        );
                      }
                      return null;
                    } catch (error) {
                      console.error("Error processing date for select item:", error, date);
                      return null;
                    }
                  })
                  .filter(Boolean)}
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
