
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
}) => {
  const formatDates = (dates: Date | Date[] | undefined) => {
    if (!dates) return "Not scheduled";
    
    if (Array.isArray(dates)) {
      return dates.map(date => format(new Date(date), "PPP")).join(", ");
    }
    
    return format(new Date(dates), "PPP");
  };

  const canSelectDate = Array.isArray(availableDates) && availableDates.length > 0;

  return (
    <div>
      <div className="flex items-center space-x-2">
        <Calendar className="text-courier-600" />
        <h3 className="font-semibold">{title}</h3>
      </div>
      
      {canSelectDate ? (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">Available dates:</p>
          <p>{formatDates(availableDates)}</p>
          
          <div className="mt-2">
            <label className="text-sm font-medium">Select date:</label>
            <Select
              value={selectedDate || ""}
              onValueChange={setSelectedDate}
              disabled={isSubmitting || isScheduled}
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
              disabled={isSubmitting || isScheduled}
              className="w-full"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {scheduledDate ? (
            <div className="bg-green-50 p-2 rounded-md border border-green-200">
              <div className="flex items-center">
                <Check className="h-4 w-4 text-green-600 mr-2" />
                <p className="font-medium">
                  {format(new Date(scheduledDate), "PPP 'at' p")}
                </p>
              </div>
            </div>
          ) : (
            <p>{formatDates(availableDates)}</p>
          )}
          
          {showAdminControls && (
            <div className="space-y-2 border-t pt-4 mt-4">
              <h4 className="text-sm font-medium">Admin: Set Date</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !calendarDate && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {calendarDate ? format(calendarDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={calendarDate}
                        onSelect={setCalendarDate}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                <Input
                  type="time"
                  value={timeValue}
                  onChange={(e) => setTimeValue(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DateSelection;
