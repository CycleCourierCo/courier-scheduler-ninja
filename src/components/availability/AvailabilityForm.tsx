
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format, isBefore, startOfDay } from 'date-fns';
import { Calendar, X, AlertCircle, Calendar as CalendarIcon, Wrench } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AltLocationFields } from './AltLocationFields';
import type { AltLocation } from '@/lib/altLocation';

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
  postcode: string;
  setPostcode: (pc: string) => void;
  postcodeLabel?: string;
  placeholder: string;
  minDate: Date;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  isDateDisabled?: (date: Date) => boolean;
  calendarEndDate?: Date;
  bufferNotice?: string;
  altLocation?: AltLocation | null;
  setAltLocation?: (value: AltLocation | null) => void;
  showAltLocation?: boolean;
  altMode?: 'collection' | 'delivery';
  /** How many dates must be picked before the form can be submitted. */
  requiredDates?: number;
  /** Cap on how many dates may be selected (used for single-day NI collections). */
  maxDates?: number;
}



export const AvailabilityForm: React.FC<AvailabilityFormProps> = ({
  title,
  description,
  dates,
  setDates,
  notes,
  setNotes,
  postcode,
  setPostcode,
  postcodeLabel,
  placeholder,
  minDate,
  isSubmitting,
  onSubmit,
  isDateDisabled,
  calendarEndDate,
  bufferNotice,
  altLocation = null,
  setAltLocation,
  showAltLocation = false,
  altMode = 'delivery',
  requiredDates = 7,
  maxDates,

}) => {

  const today = startOfDay(new Date());
  const singleDay = requiredDates === 1 && maxDates === 1;
  const [validationError, setValidationError] = useState<string | null>(null);
  
  // Validate dates when they change
  useEffect(() => {
    if (dates.length > 0 && dates.length < requiredDates) {
      setValidationError(`Please select at least ${requiredDates} dates when you'll be available`);
    } else {
      setValidationError(null);
    }
  }, [dates, requiredDates]);

  // Handle date selection
  const handleDateSelect = (selectedDates: Date[] | undefined) => {
    if (!selectedDates) {
      setDates([]);
      return;
    }

    // When only one day is allowed, keep the day the customer just tapped.
    if (maxDates && selectedDates.length > maxDates) {
      const added = selectedDates.filter(
        (d) => !dates.some((existing) => existing.getTime() === d.getTime())
      );
      setDates((added.length ? added : selectedDates).slice(-maxDates));
      return;
    }

    setDates(selectedDates);
  };
  
  // Remove a date from selection
  const removeDate = (dateToRemove: Date) => {
    setDates(dates.filter(date => date.getTime() !== dateToRemove.getTime()));
  };
  
  
  // Default date disabling logic if custom function is not provided
  const defaultIsDateDisabled = (date: Date) => {
    // Disable dates before today
    if (isBefore(date, today)) {
      return true;
    }
    
    // Disable Fridays (day 5)
    if (date.getDay() === 5) {
      return true;
    }
    
    // If minDate is provided, disable dates before minDate
    if (minDate && isBefore(date, startOfDay(minDate))) {
      return true;
    }
    
    return false;
  };
  
  // Use the custom isDateDisabled function if provided, otherwise use the default
  const disableDate = isDateDisabled || defaultIsDateDisabled;
  
  return (
    <form onSubmit={onSubmit} className="doorstep-page mx-auto max-w-3xl px-4 py-6">
      <Card className="overflow-hidden">
        <CardHeader className="signboard rounded-none space-y-2">
          <CardTitle className="text-[30px] text-primary-foreground">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {bufferNotice && (
            <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-500/40">
              <Wrench className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-amber-900 dark:text-amber-100">
                {bufferNotice}
              </AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col md:flex-row gap-8">
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-medium mb-4 flex items-center">
                <CalendarIcon className="mr-2 h-5 w-5 text-primary" />
                {singleDay ? 'Select Your Collection Day' : 'Select Available Dates'}
              </h3>
              <div className="overflow-x-auto rounded-md border bg-card p-2">
                <CalendarComponent
                  mode="multiple"
                  min={1}
                  weekStartsOn={1}
                  selected={dates}
                  onSelect={handleDateSelect}
                  disabled={disableDate}
                  fromDate={minDate || today}
                  toDate={calendarEndDate}
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
              {minDate && minDate > today && (
                <Alert className="mt-4">
                  <CalendarIcon className="h-4 w-4" />
                  <AlertDescription>
                    The earliest you can select is {format(minDate, 'MMMM d, yyyy')} based on the sender's availability.
                  </AlertDescription>
                </Alert>
              )}
            </div>
            <div className="flex-1 flex flex-col">
              <h3 className="text-lg font-medium mb-4 flex items-center">
                <Calendar className="mr-2 h-5 w-5 text-primary" />
                {singleDay ? 'Selected Day' : 'Selected Dates'}
              </h3>
              {dates.length > 0 ? (
                <div className="space-y-2 flex-grow">
                  <p className="text-sm text-muted-foreground mb-2">
                    {singleDay
                      ? "That's your collection day — tap another day to change it."
                      : dates.length >= requiredDates
                        ? `You've selected ${dates.length} dates. Great!`
                        : `Please select at least ${requiredDates - dates.length} more date${requiredDates - dates.length > 1 ? 's' : ''}.`}
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
                  {singleDay
                    ? 'No day selected yet. Please pick the day the bike will be ready.'
                    : `No dates selected. Please select at least ${requiredDates} dates when you'll be available.`}
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
                  className="min-h-28 resize-none"
                />
              </div>

              <div className="mt-4">
                <label htmlFor="postcode" className="block text-sm font-medium mb-2">
                  {postcodeLabel || 'Postcode'} <span className="text-destructive">*</span>
                </label>
                <input
                  id="postcode"
                  type="text"
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value.toUpperCase())}
                  required
                  autoComplete="postal-code"
                  placeholder="e.g. SW1A 1AA"
                  className="data-text h-12 w-full rounded-md border bg-card px-3 py-2 uppercase focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  We use this to confirm you're the right person for this order.
                </p>
              </div>
            </div>

          </div>

          {showAltLocation && setAltLocation && (
            <AltLocationFields value={altLocation} onChange={setAltLocation} mode={altMode} dates={dates} />
          )}


          
          <Button 
            type="submit" 
            variant="doorstep"
            className="mt-4" 
            disabled={dates.length < requiredDates || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <svg className="-ml-1 mr-2 h-4 w-4 animate-spin text-primary-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Submitting...
              </>
            ) : (
              singleDay ? 'Confirm Collection Day' : 'Confirm Availability'
            )}
          </Button>
          
          {dates.length < requiredDates && (
            <p className="text-sm text-center text-muted-foreground">
              {singleDay
                ? 'Please pick your collection day to continue'
                : `Please select at least ${requiredDates} available dates to continue`}
            </p>
          )}
        </CardContent>
      </Card>
    </form>
  );
};
