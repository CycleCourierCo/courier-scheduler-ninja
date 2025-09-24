import React from "react";
import { format, isValid, parseISO } from "date-fns";
import { Calendar, Check, CalendarIcon } from "lucide-react";
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
      // For date display, create a new date in UTC to avoid timezone conversion
      const utcDate = new Date(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate());
      return format(utcDate, formatStr);
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
  timeslot?: string;
  onStateReset?: () => void;
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
  timeslot,
  onStateReset
}) => {
  
  // Handle date selection with better date conversion
  const handleDateClick = (date: Date | any) => {
    try {
      let dateObj: Date;
      
      // Handle serialized date objects
      if (date && typeof date === 'object' && date._type === "Date" && date.value?.iso) {
        dateObj = parseISO(date.value.iso);
      } else if (date && typeof date === 'object' && date.iso) {
        dateObj = parseISO(date.iso);
      } else if (date && typeof date === 'object' && date.value && typeof date.value === 'number') {
        dateObj = new Date(date.value);
      } else if (date instanceof Date) {
        dateObj = date;
      } else {
        dateObj = new Date(date);
      }
      
      const isoDate = dateObj.toISOString();
      setSelectedDate(isoDate);
    } catch (error) {
      console.error("Error handling date selection:", error, date);
    }
  };

  const formatDates = (dates: Date | Date[] | any | undefined): string => {
    if (!dates) return "No dates available";
    
    const dateArray = Array.isArray(dates) ? dates : [dates];
    
    return dateArray.map((date: any) => {
      try {
        let dateObj: Date;
        
        // Handle serialized date objects
        if (date && typeof date === 'object' && date._type === "Date" && date.value?.iso) {
          dateObj = parseISO(date.value.iso);
        } else if (date && typeof date === 'object' && date.iso) {
          dateObj = parseISO(date.iso);
        } else if (date && typeof date === 'object' && date.value && typeof date.value === 'number') {
          dateObj = new Date(date.value);
        } else if (date instanceof Date) {
          dateObj = date;
        } else {
          dateObj = new Date(date);
        }
        
        return format(dateObj, "PPP");
      } catch (error) {
        console.error("Error formatting date:", error, date);
        return "Invalid date";
      }
    }).join(", ");
  };

  // Format timeslot as 3-hour window
  const formatTimeslotWindow = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const endHour = Math.min(23, hours + 3);
    const startTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    const endTime = `${endHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    return `${startTime} to ${endTime}`;
  };

  const showScheduledStyle = !!(scheduledDate || (availableDates && selectedDate));
  
  // Only disable normal date selection if we're showing admin override as the primary option
  const isDateSelectionDisabled = false;

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold flex items-center">
        <Calendar className="mr-2" />
        {title}
      </h3>
      
      {availableDates && (
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select from available dates:</label>
            <Select value={selectedDate || ""} onValueChange={(value) => {
              // Clear calendar date when using dropdown selection
              setCalendarDate(undefined);
              setSelectedDate(value);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a date" />
              </SelectTrigger>
              <SelectContent>
                {(Array.isArray(availableDates) ? availableDates : [availableDates]).map((date: any, index) => {
                  try {
                    let dateObj: Date;
                    let isoValue: string;
                    
                    // Handle serialized date objects
                    if (date && typeof date === 'object' && date._type === "Date" && date.value?.iso) {
                      dateObj = parseISO(date.value.iso);
                    } else if (date && typeof date === 'object' && date.iso) {
                      dateObj = parseISO(date.iso);
                    } else if (date && typeof date === 'object' && date.value && typeof date.value === 'number') {
                      dateObj = new Date(date.value);
                    } else if (date instanceof Date) {
                      dateObj = date;
                    } else {
                      dateObj = new Date(date);
                    }
                    
                    // Create a UTC date for consistent handling (avoid timezone shifts)
                    const utcDate = new Date(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate());
                    isoValue = utcDate.toISOString();
                    
                    return (
                      <SelectItem key={index} value={isoValue}>
                        {format(utcDate, "PPP")}
                      </SelectItem>
                    );
                  } catch (error) {
                    console.error("Error processing date in select:", error, date);
                    return (
                      <SelectItem key={index} value={`error-${index}`}>
                        Invalid date
                      </SelectItem>
                    );
                  }
                })}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      
      {!showScheduledStyle && orderStatus !== 'scheduled_dates_pending' && (
        <p>{formatDates(availableDates)}</p>
      )}
      
      {/* Show date picker for scheduled_dates_pending status */}
      {orderStatus === 'scheduled_dates_pending' && showAdminControls && (
        <div className="space-y-3 mt-4 border-t pt-4">
          <p className="text-sm font-medium text-orange-700">Admin Date Override:</p>
          <div className="space-y-2">
            <label className="text-sm font-medium">Select override date:</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !calendarDate && "text-muted-foreground"
                  )}
                  disabled={isSubmitting}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {calendarDate ? format(calendarDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={calendarDate}
                  onSelect={(date) => {
                    // Clear dropdown selection when using calendar picker
                    setSelectedDate(null);
                    setCalendarDate(date);
                  }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}
      
      {/* Show scheduled dates */}
      {(scheduledDate || showScheduledStyle) && (
        <div className="bg-green-50 p-2 rounded-md border border-green-200 mt-4">
          <div className="flex items-center">
            <Check className="h-4 w-4 text-green-600 mr-2" />
            <div className="flex flex-col">
              <p className="font-medium">
                {scheduledDate ? safeFormat(scheduledDate, "PPP") : formatDates(availableDates)}
              </p>
              {timeslot && (
                <p className="text-sm text-green-700 mt-1">
                  Timeslot: {formatTimeslotWindow(timeslot)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateSelection;