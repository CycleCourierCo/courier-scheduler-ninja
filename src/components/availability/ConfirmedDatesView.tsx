import React from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, CalendarCheck } from 'lucide-react';

interface ConfirmedDatesViewProps {
  title: string;
  dates: string[];
  notes?: string;
}

export function ConfirmedDatesView({ title, dates, notes }: ConfirmedDatesViewProps) {
  const formattedDates = dates
    .filter(d => d && typeof d === 'string')
    .map(d => {
      try {
        return format(new Date(d), 'EEE, dd MMM yyyy');
      } catch {
        return d;
      }
    })
    .sort();

  return (
    <div className="container max-w-lg mx-auto py-8 px-4">
      <Card>
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>Your dates have already been confirmed</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2 text-sm font-medium text-muted-foreground">
              <CalendarCheck className="h-4 w-4" />
              <span>Confirmed dates</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {formattedDates.map((date, i) => (
                <Badge key={i} variant="secondary" className="text-sm py-1 px-3">
                  {date}
                </Badge>
              ))}
            </div>
          </div>
          {notes && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Notes</p>
              <p className="text-sm bg-muted rounded-md p-3">{notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
