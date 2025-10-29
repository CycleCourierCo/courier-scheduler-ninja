import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, X, ArrowUpDown, User } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { UserProfile } from '@/types/user';
import { cn } from '@/lib/utils';

interface TimeslipFiltersProps {
  onFilterChange: (filters: {
    driverId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    sortBy: string;
  }) => void;
}

const TimeslipFilters: React.FC<TimeslipFiltersProps> = ({ onFilterChange }) => {
  const [driverId, setDriverId] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [sortBy, setSortBy] = useState('date_desc');

  // Fetch all drivers
  const { data: drivers } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'driver')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as UserProfile[];
    },
  });

  // Notify parent of filter changes
  useEffect(() => {
    onFilterChange({
      driverId: driverId === 'all' ? undefined : driverId,
      dateFrom,
      dateTo,
      sortBy,
    });
  }, [driverId, dateFrom, dateTo, sortBy, onFilterChange]);

  const handleClearFilters = () => {
    setDriverId('all');
    setDateFrom(undefined);
    setDateTo(undefined);
    setSortBy('date_desc');
  };

  const hasActiveFilters = driverId !== 'all' || dateFrom || dateTo;

  return (
    <Card className="p-4">
      <div className="flex flex-wrap gap-3 items-center">
        {/* Driver Filter */}
        <div className="flex-1 min-w-[200px]">
          <Select value={driverId} onValueChange={setDriverId}>
            <SelectTrigger>
              <User className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All Drivers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Drivers</SelectItem>
              {drivers?.map((driver) => (
                <SelectItem key={driver.id} value={driver.id}>
                  {driver.name || driver.email || 'Unknown Driver'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date Range Filter */}
        <div className="flex-1 min-w-[250px]">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start">
                <Calendar className="h-4 w-4 mr-2" />
                {dateFrom && dateTo ? (
                  <>
                    {format(dateFrom, 'MMM dd')} - {format(dateTo, 'MMM dd, yyyy')}
                  </>
                ) : dateFrom ? (
                  <>From {format(dateFrom, 'MMM dd, yyyy')}</>
                ) : dateTo ? (
                  <>Until {format(dateTo, 'MMM dd, yyyy')}</>
                ) : (
                  'All Dates'
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4" align="start">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">From Date</label>
                  <CalendarComponent
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">To Date</label>
                  <CalendarComponent
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    disabled={(date) => dateFrom ? date < dateFrom : false}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDateFrom(undefined);
                    setDateTo(undefined);
                  }}
                  className="w-full"
                >
                  Clear Dates
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Sort Options */}
        <div className="flex-1 min-w-[200px]">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger>
              <ArrowUpDown className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date_desc">Newest First</SelectItem>
              <SelectItem value="date_asc">Oldest First</SelectItem>
              <SelectItem value="driver_name">Driver Name (A-Z)</SelectItem>
              <SelectItem value="total_pay_desc">Highest Pay</SelectItem>
              <SelectItem value="total_pay_asc">Lowest Pay</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="flex items-center gap-2"
          >
            <X className="h-4 w-4" />
            Clear Filters
          </Button>
        )}
      </div>
    </Card>
  );
};

export default TimeslipFilters;
