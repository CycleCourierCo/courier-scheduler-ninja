import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calendar, ChevronLeft, ChevronRight, MapPin, Loader2, Save, Database } from "lucide-react";
import { OrderData } from "@/pages/JobScheduling";
import { assignOrdersToWeek, WeeklyPlan, prioritizeDays, savePlanToDatabase, loadPlanFromDatabase } from "@/services/weeklyPlanningService";
import { format, addWeeks, startOfWeek } from "date-fns";
import { toast } from "sonner";

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
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [optimizingDay, setOptimizingDay] = useState<string | null>(null);

  // Load saved plan when week changes
  useEffect(() => {
    const loadSavedPlan = async () => {
      setIsLoading(true);
      try {
        const savedPlan = await loadPlanFromDatabase(weekStart);
        if (savedPlan) {
          setWeeklyPlan(savedPlan);
          setDriversPerDay(savedPlan.driversPerDay as typeof driversPerDay);
          toast.success("Loaded saved plan for this week");
          
          const prioritized = prioritizeDays(savedPlan);
          if (prioritized.length > 0) {
            setSelectedDay(prioritized[0]);
          }
        } else {
          setWeeklyPlan(null);
        }
      } catch (error) {
        console.error('Error loading plan:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadSavedPlan();
  }, [weekStart]);

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
      const totalDistance = plan.days.reduce((sum, day) => sum + day.totalDistance, 0);
      
      toast.success(`Weekly plan generated: ${totalJobs} jobs, ${Math.round(totalDistance)} miles total`);
      
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

  const handleSavePlan = async () => {
    if (!weeklyPlan) return;
    
    setIsSaving(true);
    try {
      const success = await savePlanToDatabase(weeklyPlan);
      if (success) {
        toast.success("Plan saved successfully!");
        setWeeklyPlan({ ...weeklyPlan, isSaved: true });
      } else {
        toast.error("Failed to save plan");
      }
    } catch (error: any) {
      console.error('Error saving plan:', error);
      toast.error(`Failed to save: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOptimizeDay = async (dayName: string) => {
    if (!weeklyPlan) return;
    
    const dayPlan = weeklyPlan.days.find(d => d.day === dayName);
    if (!dayPlan) return;

    setOptimizingDay(dayName);
    try {
      toast.success(`Route optimization for ${dayName} would use Geoapify's multi-agent API`);
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

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Weekly Route Planner
          {weeklyPlan?.isSaved && (
            <Badge variant="secondary" className="ml-auto">
              <Database className="h-3 w-3 mr-1" />
              Saved
            </Badge>
          )}
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

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button 
            onClick={handleGeneratePlan} 
            disabled={isGenerating}
            className="flex-1"
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
          
          {weeklyPlan && !weeklyPlan.isSaved && (
            <Button 
              onClick={handleSavePlan} 
              disabled={isSaving}
              variant="secondary"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Plan
                </>
              )}
            </Button>
          )}
        </div>

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
                        {format(day.date, 'MMMM d, yyyy')} • {day.totalJobs} jobs • {day.drivers.length} {day.drivers.length === 1 ? 'driver' : 'drivers'} • {Math.round(day.totalDistance)} miles
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
                          <CardTitle className="text-sm flex items-center justify-between">
                            <span>Driver {driver.driverIndex + 1}</span>
                            <div className="flex gap-1">
                              {driver.region && (
                                <Badge variant="outline" className="capitalize">
                                  {driver.region}
                                </Badge>
                              )}
                              <Badge variant="secondary">
                                {driver.jobs.length} jobs
                              </Badge>
                            </div>
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">
                            {Math.round(driver.estimatedDistance)} miles
                          </p>
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
                                    <Badge variant={job.type === 'collection' ? 'default' : 'secondary'} className="text-xs">
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