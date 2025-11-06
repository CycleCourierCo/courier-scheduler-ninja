import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";
import Layout from "@/components/Layout";
import DashboardHeader from "@/components/DashboardHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { 
  getTimeslipsForDate, 
  updateTimeslipMileage, 
  calculateProfitability,
  aggregateProfitability,
  getTotalJobs,
  getCurrentWeekRange,
  getTimeslipsForWeek,
  calculateDailyProfitability
} from "@/services/profitabilityService";
import { Timeslip } from "@/types/timeslip";
import WeeklyProfitabilityChart from "@/components/analytics/WeeklyProfitabilityChart";

const RouteProfitabilityPage = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [revenuePerStop, setRevenuePerStop] = useState<number>(32);
  const [costPerMile, setCostPerMile] = useState<number>(0.45);
  const queryClient = useQueryClient();

  // State for selected week (defaults to current week)
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() => {
    const { monday } = getCurrentWeekRange();
    return monday;
  });

  const dateString = format(selectedDate, 'yyyy-MM-dd');

  // Calculate week range from selected start date
  const monday = selectedWeekStart;
  const sunday = new Date(selectedWeekStart);
  sunday.setDate(sunday.getDate() + 6); // Add 6 days to get Sunday
  
  const weekStartString = format(monday, 'yyyy-MM-dd');
  const weekEndString = format(sunday, 'yyyy-MM-dd');

  // Week navigation functions
  const goToPreviousWeek = () => {
    setSelectedWeekStart(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() - 7);
      return newDate;
    });
  };

  const goToNextWeek = () => {
    setSelectedWeekStart(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + 7);
      return newDate;
    });
  };

  const goToCurrentWeek = () => {
    const { monday } = getCurrentWeekRange();
    setSelectedWeekStart(monday);
  };

  const isCurrentWeek = () => {
    const { monday: currentMonday } = getCurrentWeekRange();
    return format(selectedWeekStart, 'yyyy-MM-dd') === format(currentMonday, 'yyyy-MM-dd');
  };

  const { data: weekTimeslips = [] } = useQuery({
    queryKey: ['profitability-week', weekStartString, weekEndString],
    queryFn: () => getTimeslipsForWeek(weekStartString, weekEndString),
  });

  const { data: weekAggregated } = useQuery({
    queryKey: ['profitability-week-summary', weekTimeslips, revenuePerStop, costPerMile],
    queryFn: () => aggregateProfitability(weekTimeslips, revenuePerStop, costPerMile),
    enabled: weekTimeslips.length > 0,
  });

  const { data: dailyChartData = [] } = useQuery({
    queryKey: ['profitability-daily-chart', weekTimeslips, revenuePerStop, costPerMile, monday, sunday],
    queryFn: () => calculateDailyProfitability(weekTimeslips, monday, sunday, revenuePerStop, costPerMile),
    enabled: weekTimeslips.length > 0,
  });

  const { data: timeslips = [], isLoading } = useQuery({
    queryKey: ['profitability-timeslips', dateString],
    queryFn: () => getTimeslipsForDate(dateString),
  });

  const updateMileageMutation = useMutation({
    mutationFn: ({ id, mileage }: { id: string; mileage: number }) =>
      updateTimeslipMileage(id, mileage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profitability-timeslips'] });
      toast.success("Mileage updated");
    },
    onError: (error) => {
      toast.error("Failed to update mileage");
      console.error(error);
    },
  });

  const handleMileageChange = (id: string, value: string) => {
    const mileage = parseFloat(value);
    if (!isNaN(mileage) && mileage >= 0) {
      updateMileageMutation.mutate({ id, mileage });
    }
  };

  const { data: aggregated } = useQuery({
    queryKey: ['profitability-summary', timeslips, revenuePerStop, costPerMile],
    queryFn: () => aggregateProfitability(timeslips, revenuePerStop, costPerMile),
    enabled: timeslips.length > 0,
  });

  return (
    <Layout>
      <DashboardHeader />
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Route Profitability</h1>
        </div>

        {/* Current Week Summary */}
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Week Overview
                </CardTitle>
                <CardDescription>
                  {format(monday, "MMM d")} - {format(sunday, "MMM d, yyyy")}
                </CardDescription>
              </div>
              
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPreviousWeek}
                  className="flex-1 sm:flex-none"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden xs:inline">Previous</span>
                </Button>
                
                {!isCurrentWeek() && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToCurrentWeek}
                    className="flex-1 sm:flex-none"
                  >
                    Current Week
                  </Button>
                )}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNextWeek}
                  className="flex-1 sm:flex-none"
                >
                  <span className="hidden xs:inline">Next</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Weekly Revenue</p>
                <p className="text-2xl font-bold text-green-600">
                  £{weekAggregated?.totalRevenue.toFixed(2) || '0.00'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Weekly Costs</p>
                <p className="text-2xl font-bold text-orange-600">
                  £{weekAggregated?.totalCosts.toFixed(2) || '0.00'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Weekly Profit</p>
                <p className={cn(
                  "text-2xl font-bold",
                  (weekAggregated?.totalProfit || 0) >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  £{weekAggregated?.totalProfit.toFixed(2) || '0.00'}
                </p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Total Timeslips</span>
                <span className="font-medium text-foreground">{weekTimeslips.length}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground mt-1">
                <span>Active Drivers</span>
                <span className="font-medium text-foreground">{weekAggregated?.driverCount || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Weekly Profitability Chart */}
        {weekTimeslips.length > 0 && (
          <WeeklyProfitabilityChart data={dailyChartData} />
        )}

        {/* Settings Section */}
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>Configure profitability calculation parameters</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="revenue">Revenue per Job (£)</Label>
              <Input
                id="revenue"
                type="number"
                step="0.01"
                min="0"
                value={revenuePerStop}
                onChange={(e) => setRevenuePerStop(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cost">Cost per Mile (£)</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                min="0"
                value={costPerMile}
                onChange={(e) => setCostPerMile(parseFloat(e.target.value) || 0)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Summary Section */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                £{aggregated?.totalRevenue.toFixed(2) || '0.00'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Costs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                £{aggregated?.totalCosts.toFixed(2) || '0.00'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Profit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn(
                "text-2xl font-bold",
                (aggregated?.totalProfit || 0) >= 0 ? "text-green-600" : "text-red-600"
              )}>
                £{aggregated?.totalProfit.toFixed(2) || '0.00'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Drivers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{aggregated?.driverCount || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Timeslips Table */}
        <Card>
          <CardHeader>
            <CardTitle>Timeslips for {format(selectedDate, "PPP")}</CardTitle>
            <CardDescription>
              {timeslips.length} timeslip{timeslips.length !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : timeslips.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No timeslips found for this date
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Driver</TableHead>
                      <TableHead className="text-right">Total Jobs</TableHead>
                      <TableHead className="text-right">Stops</TableHead>
                      <TableHead className="text-right">Mileage</TableHead>
                      <TableHead className="text-right">Driver Pay</TableHead>
                      <TableHead className="text-right">Custom Addons</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Total Costs</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timeslips.map((timeslip) => (
                      <TimeslipRow 
                        key={timeslip.id} 
                        timeslip={timeslip} 
                        revenuePerStop={revenuePerStop}
                        costPerMile={costPerMile}
                        onMileageChange={handleMileageChange}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

const TimeslipRow = ({ 
  timeslip, 
  revenuePerStop, 
  costPerMile, 
  onMileageChange 
}: { 
  timeslip: Timeslip; 
  revenuePerStop: number;
  costPerMile: number;
  onMileageChange: (id: string, value: string) => void;
}) => {
  const [totalJobs, setTotalJobs] = useState<number>(0);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);

  useEffect(() => {
    getTotalJobs(timeslip).then((jobs) => {
      setTotalJobs(jobs);
      setIsLoadingJobs(false);
    });
  }, [timeslip]);

  const metrics = calculateProfitability(totalJobs, timeslip, revenuePerStop, costPerMile);

  return (
    <TableRow>
      <TableCell className="font-medium">
        {timeslip.driver?.name || 'Unknown Driver'}
      </TableCell>
      <TableCell className="text-right">
        {isLoadingJobs ? (
          <span className="text-muted-foreground">...</span>
        ) : (
          <div className="flex items-center justify-end gap-2">
            <span className="font-semibold">{totalJobs}</span>
            {timeslip.total_jobs === null && (
              <span className="text-xs text-muted-foreground">(calc)</span>
            )}
          </div>
        )}
      </TableCell>
      <TableCell className="text-right">{timeslip.total_stops}</TableCell>
      <TableCell className="text-right">
        <Input
          type="number"
          step="0.1"
          min="0"
          placeholder="Enter miles"
          value={timeslip.mileage || ''}
          onChange={(e) => onMileageChange(timeslip.id, e.target.value)}
          className="w-24 text-right"
        />
      </TableCell>
      <TableCell className="text-right">
        £{(timeslip.total_pay || 0).toFixed(2)}
      </TableCell>
      <TableCell className="text-right">
        £{(metrics?.customAddonCosts ?? 0).toFixed(2)}
      </TableCell>
      <TableCell className="text-right text-green-600 font-medium">
        £{(metrics?.revenue ?? 0).toFixed(2)}
      </TableCell>
      <TableCell className="text-right text-orange-600">
        £{(metrics?.totalCosts ?? 0).toFixed(2)}
      </TableCell>
      <TableCell className={cn(
        "text-right font-bold",
        (metrics?.profit ?? 0) >= 0 ? "text-green-600" : "text-red-600"
      )}>
        £{(metrics?.profit ?? 0).toFixed(2)}
      </TableCell>
    </TableRow>
  );
};

export default RouteProfitabilityPage;
