
import React from 'react';
import { DayPicker } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { Calendar } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

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
  const today = new Date();
  
  return (
    <form onSubmit={onSubmit} className="max-w-4xl mx-auto py-8 px-4">
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1">
              <h3 className="text-lg font-medium mb-4 flex items-center">
                <Calendar className="mr-2 h-5 w-5" />
                Select Available Dates
              </h3>
              <div className="border rounded-md p-2 bg-white">
                <DayPicker
                  mode="multiple"
                  min={1}
                  selected={dates}
                  onSelect={(selectedDates) => setDates(selectedDates || [])}
                  fromDate={minDate}
                  className="p-3 pointer-events-auto"
                />
              </div>
            </div>
            <div className="flex-1 flex flex-col">
              <h3 className="text-lg font-medium mb-4">Selected Dates</h3>
              {dates.length > 0 ? (
                <div className="space-y-2 flex-grow">
                  <ul className="space-y-1">
                    {dates.map((date, index) => (
                      <li key={index} className="flex items-center">
                        <span className="h-2 w-2 rounded-full bg-primary mr-2" />
                        {format(date, 'EEEE, MMMM do, yyyy')}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-muted-foreground italic flex-grow">
                  No dates selected. Please select at least one date.
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
                  className="border-gray-300"
                />
              </div>
            </div>
          </div>
          
          <Button type="submit" className="w-full" disabled={dates.length === 0 || isSubmitting}>
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
        </CardContent>
      </Card>
    </form>
  );
};
