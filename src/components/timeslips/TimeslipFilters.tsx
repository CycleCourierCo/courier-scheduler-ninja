import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, X, ArrowUpDown, User, Route, Truck } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { listUsersByRole } from '@/services/mechanicTimeslipService';
import { cn } from '@/lib/utils';

interface TimeslipFiltersProps {
  onFilterChange: (filters: {
    driverId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    sortBy: string;
    noMileage?: boolean;
    noVehicle?: boolean;
  }) => void;
}

const TimeslipFilters: React.FC<TimeslipFiltersProps> = ({ onFilterChange }) => {
  const [driverId, setDriverId] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [sortBy, setSortBy] = useState('date_desc');
  const [noMileage, setNoMileage] = useState(false);
  const [noVehicle, setNoVehicle] = useState(false);

  // Fetch all drivers
  const { data: drivers } = useQuery({
    queryKey: ['role-users', 'driver'],
    queryFn: () => listUsersByRole('driver'),
    staleTime: 5 * 60 * 1000,
  });

  // Notify parent of filter changes
  useEffect(() => {
    onFilterChange({
      driverId: driverId === 'all' ? undefined : driverId,
      dateFrom,
      dateTo,
      sortBy,
      noMileage,
      noVehicle,
    });
  }, [driverId, dateFrom, dateTo, sortBy, noMileage, noVehicle, onFilterChange]);

  const handleClearFilters = () => {
    setDriverId('all');
    setDateFrom(undefined);
    setDateTo(undefined);
    setSortBy('date_desc');
    setNoMileage(false);
    setNoVehicle(false);
  };

  const hasActiveFilters = driverId !== 'all' || dateFrom || dateTo || noMileage || noVehicle;

  return (
    <Card className="p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Driver Filter */}
        <div className="w-full min-w-0">
          <Select value={driverId} onValueChange={setDriverId}>
            <SelectTrigger>
              <User className="h-4 w-4 mr-2 shrink-0" />
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
        <div className="w-full min-w-0">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start">
                <Calendar className="h-4 w-4 mr-2 shrink-0" />
                <span className="truncate">
                  {dateFrom && dateTo ? (
                    <>{format(dateFrom, 'MMM dd')} - {format(dateTo, 'MMM dd, yyyy')}</>
                  ) : dateFrom ? (
                    <>From {format(dateFrom, 'MMM dd, yyyy')}</>
                  ) : dateTo ? (
                    <>Until {format(dateTo, 'MMM dd, yyyy')}</>
                  ) : (
                    'All Dates'
                  )}
                </span>
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
        <div className="w-full min-w-0">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger>
              <ArrowUpDown className="h-4 w-4 mr-2 shrink-0" />
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

        {/* Quick Filter Toggles */}
        <div className="w-full min-w-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 sm:flex-wrap">
          <div className="flex items-center gap-2">
            <Switch
              id="no-mileage"
              checked={noMileage}
              onCheckedChange={setNoMileage}
            />
            <label htmlFor="no-mileage" className="flex items-center gap-1 text-sm cursor-pointer">
              <Route className="h-4 w-4 text-muted-foreground" />
              No mileage
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="no-vehicle"
              checked={noVehicle}
              onCheckedChange={setNoVehicle}
            />
            <label htmlFor="no-vehicle" className="flex items-center gap-1 text-sm cursor-pointer">
              <Truck className="h-4 w-4 text-muted-foreground" />
              No vehicle
            </label>
          </div>
        </div>
      </div>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <div className="flex justify-end mt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="flex items-center gap-2"
          >
            <X className="h-4 w-4" />
            Clear Filters
          </Button>
        </div>
      )}
    </Card>
  );
};


export default TimeslipFilters;
