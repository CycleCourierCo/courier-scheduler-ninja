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
  timeslot?: string;
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
  timeslot
}) => {
  
  // Handle date selection
  const handleDateClick = (date: Date) => {
    const isoDate = date.toISOString();
    setSelectedDate(isoDate);
  };

  const formatDates = (dates: Date | Date[] | undefined): string => {
    if (!dates) return "No dates available";
    
    const dateArray = Array.isArray(dates) ? dates : [dates];
    
    return dateArray.map(date => format(date, "PPP")).join(", ");
  };

  // Format timeslot as 3-hour window
  const formatTimeslotWindow = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const startHour = Math.max(0, hours - 3);
    const startTime = `${startHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    const endTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    return `${startTime} to ${endTime}`;
  };

  const showScheduledStyle = !!(scheduledDate || (availableDates && selectedDate));
  
  const isDateSelectionDisabled = orderStatus === 'scheduled_dates_pending' && showAdminControls;

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold flex items-center">
        <Calendar className="mr-2" />
        {title}
      </h3>
      
      {!isScheduled && availableDates && !isDateSelectionDisabled && (
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select from available dates:</label>
            <Select value={selectedDate || ""} onValueChange={setSelectedDate}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a date" />
              </SelectTrigger>
              <SelectContent>
                {(Array.isArray(availableDates) ? availableDates : [availableDates]).map((date, index) => (
                  <SelectItem key={index} value={date.toISOString()}>
                    {format(date, "PPP")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label htmlFor="time" className="text-sm font-medium">
              Select time:
            </label>
            <Input
              id="time"
              type="time"
              value={timeValue}
              onChange={(e) => setTimeValue(e.target.value)}
              disabled={isDateSelectionDisabled}
              className="w-full"
            />
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
                  onSelect={setCalendarDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div>
            <label className="text-sm font-medium">Select time:</label>
            <Input
              type="time"
              value={timeValue}
              onChange={(e) => setTimeValue(e.target.value)}
              disabled={isSubmitting}
              className="w-full"
            />
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