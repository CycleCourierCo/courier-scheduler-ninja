
import React, { useState, useEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format, isBefore, startOfDay } from 'date-fns';
import { Calendar, X, AlertCircle, Calendar as CalendarIcon } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface DateRange {
  from: Date;
  to: Date;
}

interface AvailabilityFormProps {
  title: string;
  description: string;
  dates: Date[];
  setDates: (dates: Date[]) => void;
  notes: string;
  setNotes: (notes: string) => void;
  placeholder: string;
  minDate: Date;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export const AvailabilityForm: React.FC<AvailabilityFormProps> = ({
  title,
  description,
  dates,
  setDates,
  notes,
  setNotes,
  placeholder,
  minDate,
  isSubmitting,
  onSubmit,
}) => {
  const today = startOfDay(new Date());
  const [validationError, setValidationError] = useState<string | null>(null);
  
  // Validate dates when they change
  useEffect(() => {
    if (dates.length > 0 && dates.length < 5) {
      setValidationError("Please select at least 5 dates when you'll be available");
    } else {
      setValidationError(null);
    }
  }, [dates]);

  // Handle date selection
  const handleDateSelect = (selectedDates: Date[] | undefined) => {
    if (!selectedDates) {
      setDates([]);
      return;
    }
    
    setDates(selectedDates);
  };
  
  // Remove a date from selection
  const removeDate = (dateToRemove: Date) => {
    setDates(dates.filter(date => date.getTime() !== dateToRemove.getTime()));
  };
  
  // Disable dates in the past
  const isDateDisabled = (date: Date) => {
    return isBefore(date, today);
  };
  
  return (
    <form onSubmit={onSubmit} className="max-w-4xl mx-auto py-8 px-4">
      <Card className="shadow-lg border-slate-200">
        <CardHeader className="space-y-1 bg-slate-50 rounded-t-lg border-b">
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1">
              <h3 className="text-lg font-medium mb-4 flex items-center">
                <CalendarIcon className="mr-2 h-5 w-5 text-primary" />
                Select Available Dates
              </h3>
              <div className="border rounded-md p-2 bg-white shadow-sm">
                <CalendarComponent
                  mode="multiple"
                  min={1}
                  selected={dates}
                  onSelect={handleDateSelect}
                  disabled={isDateDisabled}
                  fromDate={today}
                  className="p-3 pointer-events-auto"
                />
              </div>
              {validationError && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {validationError}
                  </AlertDescription>
                </Alert>
              )}
            </div>
            <div className="flex-1 flex flex-col">
              <h3 className="text-lg font-medium mb-4 flex items-center">
                <Calendar className="mr-2 h-5 w-5 text-primary" />
                Selected Dates
              </h3>
              {dates.length > 0 ? (
                <div className="space-y-2 flex-grow">
                  <p className="text-sm text-muted-foreground mb-2">
                    {dates.length >= 5 
                      ? `You've selected ${dates.length} dates. Great!` 
                      : `Please select at least ${5 - dates.length} more date${5 - dates.length > 1 ? 's' : ''}.`}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {dates.map((date, index) => (
                      <Badge 
                        key={index} 
                        className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                      >
                        <span className="mr-1">{format(date, 'EEE, MMM do')}</span>
                        <button 
                          type="button" 
                          onClick={() => removeDate(date)}
                          className="ml-1 hover:text-destructive transition-colors"
                          aria-label={`Remove ${format(date, 'PPP')}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground italic flex-grow">
                  No dates selected. Please select at least 5 dates when you'll be available.
                </p>
              )}
              
              <div className="mt-4">
                <label htmlFor="notes" className="block text-sm font-medium mb-2">
                  Additional Notes
                </label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={placeholder}
                  rows={4}
                  className="border-slate-200 resize-none"
                />
              </div>
            </div>
          </div>
          
          <Button 
            type="submit" 
            className="w-full mt-4" 
            disabled={dates.length < 5 || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Submitting...
              </>
            ) : (
              'Confirm Availability'
            )}
          </Button>
          
          {dates.length < 5 && (
            <p className="text-sm text-center text-muted-foreground">
              Please select at least 5 available dates to continue
            </p>
          )}
        </CardContent>
      </Card>
    </form>
  );
};
