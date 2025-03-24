
import React from 'react';
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CalendarIcon } from 'lucide-react';
import { format } from "date-fns";

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
  disabledDate?: (date: Date) => boolean;
  onSubmit: () => void;
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
  disabledDate,
  onSubmit
}) => {
  const defaultDisabledDate = (date: Date) => date < minDate;
  const isDateDisabled = disabledDate || defaultDisabledDate;

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center">
          <Calendar
            mode="multiple"
            selected={dates}
            onSelect={setDates}
            className="rounded-md border pointer-events-auto"
            disabled={isDateDisabled}
          />
          <div className="mt-4 w-full">
            <h3 className="font-medium mb-2">Selected dates:</h3>
            {dates.length > 0 ? (
              <ul className="space-y-1">
                {dates.sort((a, b) => a.getTime() - b.getTime()).map((date, index) => (
                  <li key={index} className="flex items-center">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    <span>{format(date, "EEEE, MMMM do, yyyy")}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No dates selected</p>
            )}
          </div>
          
          <div className="mt-6 w-full">
            <h3 className="font-medium mb-2">Additional notes:</h3>
            <Textarea
              placeholder={placeholder}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="resize-y"
              rows={3}
            />
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end">
        <Button 
          onClick={onSubmit} 
          disabled={dates.length === 0 || isSubmitting}
          className="w-full"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
              Confirming...
            </>
          ) : (
            "Confirm Availability"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};
