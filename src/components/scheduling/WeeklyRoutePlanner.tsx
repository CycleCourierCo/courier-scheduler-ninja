import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calendar, ChevronLeft, ChevronRight, MapPin, Loader2 } from "lucide-react";
import { OrderData } from "@/pages/JobScheduling";
import { assignOrdersToWeek, WeeklyPlan, prioritizeDays } from "@/services/weeklyPlanningService";
import { format, addWeeks, startOfWeek } from "date-fns";
import { toast } from "sonner";
import { optimizeRouteWithGeoapify } from "@/services/routeOptimizationService";

interface WeeklyRoutePlannerProps {
  orders: OrderData[];
  onScheduleApplied?: () => void;
}

const WeeklyRoutePlanner: React.FC<WeeklyRoutePlannerProps> = ({ orders, onScheduleApplied }) => {
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [driversPerDay, setDriversPerDay] = useState({
    monday: 1,
    tuesday: 1,
    wednesday: 1,
    thursday: 1,
    friday: 1
  });
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>('monday');
  const [isGenerating, setIsGenerating] = useState(false);
  const [optimizingDay, setOptimizingDay] = useState<string | null>(null);

  const handlePreviousWeek = () => {
    setWeekStart(addWeeks(weekStart, -1));
    setWeeklyPlan(null);
  };

  const handleNextWeek = () => {
    setWeekStart(addWeeks(weekStart, 1));
    setWeeklyPlan(null);
  };

  const handleDriversChange = (day: string, value: string) => {
    setDriversPerDay(prev => ({
      ...prev,
      [day]: parseInt(value)
    }));
  };

  const handleGeneratePlan = async () => {
    setIsGenerating(true);
    try {
      const plan = assignOrdersToWeek(orders, weekStart, driversPerDay);
      setWeeklyPlan(plan);
      
      const totalJobs = plan.days.reduce((sum, day) => sum + day.totalJobs, 0);
      toast.success(`Weekly plan generated with ${totalJobs} jobs across ${plan.days.length} days`);
      
      // Auto-select first day with most jobs
      const prioritized = prioritizeDays(plan);
      if (prioritized.length > 0) {
        setSelectedDay(prioritized[0]);
      }
    } catch (error: any) {
      console.error('Error generating plan:', error);
      toast.error(`Failed to generate plan: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOptimizeDay = async (dayName: string) => {
    if (!weeklyPlan) return;
    
    const dayPlan = weeklyPlan.days.find(d => d.day === dayName);
    if (!dayPlan) return;

    setOptimizingDay(dayName);
    try {
      // For now, just show success - actual route optimization will use Geoapify
      toast.success(`Route optimization for ${dayName} would use Geoapify's multi-agent API`);
      
      // TODO: Implement actual Geoapify optimization per driver
      // const optimizedRoutes = await optimizeRouteWithGeoapify(...)
      
    } catch (error: any) {
      console.error('Error optimizing route:', error);
      toast.error(`Failed to optimize: ${error.message}`);
    } finally {
      setOptimizingDay(null);
    }
  };

  const getDayPlan = () => {
    if (!weeklyPlan) return null;
    return weeklyPlan.days.find(d => d.day === selectedDay);
  };

  const currentDayPlan = getDayPlan();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Weekly Route Planner
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Week Selection */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={handlePreviousWeek}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <div className="text-center">
            <div className="font-semibold">
              {format(weekStart, 'MMM d')} - {format(addWeeks(weekStart, 1), 'MMM d, yyyy')}
            </div>
            <div className="text-sm text-muted-foreground">Week of {format(weekStart, 'MMMM d, yyyy')}</div>
          </div>
          <Button variant="outline" size="sm" onClick={handleNextWeek}>
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {/* Drivers Per Day Configuration */}
        <div className="space-y-3">
          <label className="text-sm font-medium">Drivers Per Day</label>
          <div className="grid grid-cols-5 gap-2">
            {Object.keys(driversPerDay).map(day => (
              <div key={day} className="space-y-1">
                <label className="text-xs text-muted-foreground capitalize">{day.slice(0, 3)}</label>
                <Select
                  value={driversPerDay[day as keyof typeof driversPerDay].toString()}
                  onValueChange={(value) => handleDriversChange(day, value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map(num => (
                      <SelectItem key={num} value={num.toString()}>
                        {num} {num === 1 ? 'driver' : 'drivers'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <Button 
          onClick={handleGeneratePlan} 
          disabled={isGenerating}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating Plan...
            </>
          ) : (
            'Generate Weekly Plan'
          )}
        </Button>

        {/* Weekly Plan Display */}
        {weeklyPlan && (
          <div className="space-y-4">
            <Tabs value={selectedDay} onValueChange={setSelectedDay}>
              <TabsList className="grid grid-cols-5 w-full">
                {weeklyPlan.days.map(day => (
                  <TabsTrigger key={day.day} value={day.day} className="capitalize">
                    {day.day.slice(0, 3)}
                    <Badge variant="secondary" className="ml-1">
                      {day.totalJobs}
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>

              {weeklyPlan.days.map(day => (
                <TabsContent key={day.day} value={day.day} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold capitalize">{day.day}</h3>
                      <p className="text-sm text-muted-foreground">
                        {format(day.date, 'MMMM d, yyyy')} • {day.totalJobs} jobs • {day.drivers.length} {day.drivers.length === 1 ? 'driver' : 'drivers'}
                      </p>
                    </div>
                    <Button
                      onClick={() => handleOptimizeDay(day.day)}
                      disabled={optimizingDay === day.day}
                      size="sm"
                    >
                      {optimizingDay === day.day ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Optimizing...
                        </>
                      ) : (
                        <>
                          <MapPin className="h-4 w-4 mr-2" />
                          Optimize Route
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Driver Assignments */}
                  <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${day.drivers.length}, 1fr)` }}>
                    {day.drivers.map((driver) => (
                      <Card key={driver.driverIndex}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm">
                            Driver {driver.driverIndex + 1}
                            <Badge variant="secondary" className="ml-2">
                              {driver.jobs.length} jobs
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {driver.jobs.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No jobs assigned</p>
                            ) : (
                              driver.jobs.map((job, idx) => (
                                <div key={`${job.orderId}-${job.type}-${idx}`} className="text-sm border-l-2 border-primary pl-2">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium">
                                      {idx + 1}. {job.type === 'collection' ? '📦' : '🚚'} {job.contactName}
                                    </span>
                                    <Badge variant={job.type === 'collection' ? 'default' : 'secondary'}>
                                      {job.type}
                                    </Badge>
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1">{job.address}</div>
                                </div>
                              ))
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>

            {/* Apply Schedule Button */}
            <Button 
              variant="default" 
              className="w-full"
              onClick={() => {
                toast.info("Schedule application would update order dates in database");
                // TODO: Implement actual database updates
                onScheduleApplied?.();
              }}
            >
              Apply Schedule to Orders
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WeeklyRoutePlanner;
