import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calendar, ChevronLeft, ChevronRight, MapPin, Loader2, Save, Database, AlertTriangle, Clock, Merge } from "lucide-react";
import { OrderData } from "@/pages/JobScheduling";
import { 
  assignOrdersToWeek, 
  WeeklyPlan, 
  prioritizeDays, 
  savePlanToDatabase, 
  loadPlanFromDatabase,
  handleUnderMinimumForDay,
  UnderMinimumRoute,
  DeferredJob,
  countJobsForOrders
} from "@/services/weeklyPlanningService";
import { format, addWeeks, startOfWeek, addDays } from "date-fns";
import { toast } from "sonner";
import { Cluster } from "@/services/clusteringService";

interface WeeklyRoutePlannerProps {
  orders: OrderData[];
  onScheduleApplied?: () => void;
  clusters?: Cluster[];
}

const WeeklyRoutePlanner: React.FC<WeeklyRoutePlannerProps> = ({ orders, onScheduleApplied, clusters = [] }) => {
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>('monday');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [optimizingDay, setOptimizingDay] = useState<string | null>(null);
  const [processingDay, setProcessingDay] = useState<string | null>(null);

  const workingDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'saturday', 'sunday'];

  // Load saved plan when week changes
  useEffect(() => {
    const loadSavedPlan = async () => {
      setIsLoading(true);
      try {
        const savedPlan = await loadPlanFromDatabase(weekStart);
        if (savedPlan) {
          setWeeklyPlan(savedPlan);
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

  const handleGeneratePlan = async () => {
    setIsGenerating(true);
    try {
      const plan = assignOrdersToWeek(orders, weekStart);
      setWeeklyPlan(plan);
      
      const totalJobs = plan.days.reduce((sum, day) => sum + day.totalJobs, 0);
      const totalDistance = plan.days.reduce((sum, day) => sum + day.totalDistance, 0);
      const totalDriverDays = Object.values(plan.driversPerDay).reduce((sum, count) => sum + count, 0);
      
      const underMinCount = Object.values(plan.underMinimumByDay).reduce((sum, routes) => sum + routes.length, 0);
      let message = `Weekly plan generated: ${totalJobs} jobs, ${totalDriverDays} driver-days, ${Math.round(totalDistance)} miles`;
      if (underMinCount > 0) {
        message += `. ${underMinCount} routes have <10 stops - review each day to defer or combine.`;
      }
      
      toast.success(message);
      
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

  const handleDeferForDay = (dayName: string) => {
    if (!weeklyPlan) return;
    
    setProcessingDay(dayName);
    try {
      const updatedPlan = handleUnderMinimumForDay(weeklyPlan, dayName, 'defer');
      setWeeklyPlan(updatedPlan);
      
      const deferredCount = updatedPlan.deferredJobs.filter(j => j.originalDay === dayName).length;
      if (deferredCount > 0) {
        toast.success(`Deferred ${deferredCount} jobs from ${dayName} to later days or pending`);
      } else {
        toast.success(`Jobs from ${dayName} absorbed into later days`);
      }
    } catch (error: any) {
      console.error('Error deferring jobs:', error);
      toast.error(`Failed to defer: ${error.message}`);
    } finally {
      setProcessingDay(null);
    }
  };

  const handleCombineForDay = (dayName: string) => {
    if (!weeklyPlan) return;
    
    setProcessingDay(dayName);
    try {
      const updatedPlan = handleUnderMinimumForDay(weeklyPlan, dayName, 'combine');
      setWeeklyPlan(updatedPlan);
      toast.success(`Combined under-minimum routes for ${dayName}`);
    } catch (error: any) {
      console.error('Error combining routes:', error);
      toast.error(`Failed to combine: ${error.message}`);
    } finally {
      setProcessingDay(null);
    }
  };

  const totalDriverDays = weeklyPlan ? Object.values(weeklyPlan.driversPerDay).reduce((sum, count) => sum + count, 0) : 0;

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
            <div className="text-sm text-muted-foreground">
              {(() => {
                const { total, collections, deliveries } = countJobsForOrders(orders);
                return `Week of ${format(weekStart, 'MMMM d, yyyy')} • ${total} jobs (${collections} collections, ${deliveries} deliveries) from ${orders.length} orders`;
              })()}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleNextWeek}>
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {/* Auto-Calculated Drivers Display */}
        {weeklyPlan && (
          <div className="space-y-3">
            <div className="text-sm font-medium text-center">
              Drivers Required (Min 10 stops, Max 10 bikes, Max 600 miles per route)
            </div>
            <div className="grid grid-cols-6 gap-3">
              {workingDays.map((day, index) => {
                const dayIndices = [0, 1, 2, 3, 5, 6];
                const dayDate = addDays(weekStart, dayIndices[index]);
                const driversCount = weeklyPlan.driversPerDay[day] || 0;
                const dayPlan = weeklyPlan.days.find(d => d.day === day);
                const hasUnderMinimum = (weeklyPlan.underMinimumByDay[day]?.length || 0) > 0;
                
                return (
                  <div 
                    key={day} 
                    className={`text-center p-3 border rounded-lg ${hasUnderMinimum ? 'border-amber-500/50 bg-amber-500/10' : 'bg-muted/30'}`}
                  >
                    <div className="text-xs font-medium mb-1 capitalize">
                      {day.substring(0, 3)}
                    </div>
                    <div className="text-xs text-muted-foreground mb-2">
                      {format(dayDate, 'MMM d')}
                    </div>
                    <div className="text-2xl font-bold text-primary">
                      {driversCount}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {driversCount === 1 ? 'driver' : 'drivers'}
                    </div>
                    {dayPlan && dayPlan.totalJobs > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {dayPlan.totalJobs} jobs
                      </div>
                    )}
                    {hasUnderMinimum && (
                      <div className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center justify-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {weeklyPlan.underMinimumByDay[day].length}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 text-center p-3 bg-primary/10 rounded-lg">
              <span className="text-sm font-medium">
                Total driver-days needed this week: <span className="text-lg font-bold text-primary">{totalDriverDays}</span>
              </span>
            </div>
          </div>
        )}

        {/* Deferred Jobs Warning */}
        {weeklyPlan && weeklyPlan.deferredJobs.length > 0 && (
          <DeferredJobsPanel deferredJobs={weeklyPlan.deferredJobs} />
        )}

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
              <TabsList className="grid grid-cols-6 w-full">
                {weeklyPlan.days.map(day => {
                  const hasUnderMinimum = (weeklyPlan.underMinimumByDay[day.day]?.length || 0) > 0;
                  return (
                    <TabsTrigger key={day.day} value={day.day} className="capitalize relative">
                      {day.day.slice(0, 3)}
                      <Badge variant="secondary" className="ml-1">
                        {day.totalJobs}
                      </Badge>
                      {hasUnderMinimum && (
                        <span className="absolute -top-1 -right-1 h-2 w-2 bg-amber-500 rounded-full" />
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {weeklyPlan.days.map(day => {
                const underMinRoutes = weeklyPlan.underMinimumByDay[day.day] || [];
                const hasUnderMinimum = underMinRoutes.length > 0;
                
                return (
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
                        disabled={optimizingDay === day.day || day.totalJobs === 0}
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

                    {/* Under-Minimum Alert for this day */}
                    {hasUnderMinimum && (
                      <UnderMinimumDayAlert
                        dayName={day.day}
                        routes={underMinRoutes}
                        onDefer={() => handleDeferForDay(day.day)}
                        onCombine={() => handleCombineForDay(day.day)}
                        isProcessing={processingDay === day.day}
                      />
                    )}

                    {/* Driver Assignments */}
                    {day.drivers.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No jobs scheduled for this day
                      </div>
                    ) : (
                      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(day.drivers.length, 4)}, 1fr)` }}>
                        {day.drivers.map((driver) => {
                          const isUnderMinimum = driver.jobs.length > 0 && driver.jobs.length < 10;
                          return (
                            <Card key={driver.driverIndex} className={isUnderMinimum ? 'border-amber-500/50' : ''}>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-sm flex items-center justify-between">
                                  <span className="flex items-center gap-2">
                                    Driver {driver.driverIndex + 1}
                                    {isUnderMinimum && (
                                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                                    )}
                                  </span>
                                  <div className="flex gap-1">
                                    {driver.region && (
                                      <Badge variant="outline" className="capitalize">
                                        {driver.region}
                                      </Badge>
                                    )}
                                    <Badge variant={isUnderMinimum ? "destructive" : "secondary"}>
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
                                        {job.order.tracking_number && (
                                          <div className="text-xs font-mono text-primary mt-1">
                                            #{job.order.tracking_number}
                                          </div>
                                        )}
                                        {(job.order.bike_brand || job.order.bike_model) && (
                                          <div className="text-xs text-muted-foreground">
                                            🚲 {[job.order.bike_brand, job.order.bike_model].filter(Boolean).join(' ')}
                                            {job.bikeQuantity > 1 && ` (×${job.bikeQuantity})`}
                                          </div>
                                        )}
                                        <div className="text-xs text-muted-foreground mt-1">{job.address}</div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </TabsContent>
                );
              })}
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

// Under-Minimum Day Alert Component
interface UnderMinimumDayAlertProps {
  dayName: string;
  routes: UnderMinimumRoute[];
  onDefer: () => void;
  onCombine: () => void;
  isProcessing: boolean;
}

const UnderMinimumDayAlert: React.FC<UnderMinimumDayAlertProps> = ({ 
  dayName, 
  routes, 
  onDefer, 
  onCombine,
  isProcessing 
}) => {
  const totalJobs = routes.reduce((sum, r) => sum + r.driver.jobs.length, 0);
  
  return (
    <div className="p-4 border rounded-lg border-amber-500/50 bg-amber-500/10 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-500" />
        <span className="font-medium text-amber-700 dark:text-amber-400">
          {routes.length} {routes.length === 1 ? 'route has' : 'routes have'} fewer than 10 stops ({totalJobs} jobs total)
        </span>
      </div>
      
      <div className="text-sm text-muted-foreground">
        Routes with fewer than 10 stops are not efficient. Choose how to handle them:
      </div>
      
      <div className="flex gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onDefer}
          disabled={isProcessing}
          className="flex items-center gap-2"
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Clock className="h-4 w-4 text-amber-500" />
          )}
          Defer to Later Days
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onCombine}
          disabled={isProcessing}
          className="flex items-center gap-2"
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Merge className="h-4 w-4 text-blue-500" />
          )}
          Combine with Other Routes
        </Button>
      </div>
      
      <div className="text-xs text-muted-foreground">
        • <strong>Defer:</strong> Move jobs to later days in the week or mark as pending<br />
        • <strong>Combine:</strong> Merge with existing routes (respecting 600-mile limit)
      </div>
    </div>
  );
};

// Deferred Jobs Panel Component
const DeferredJobsPanel: React.FC<{ deferredJobs: DeferredJob[] }> = ({ deferredJobs }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Group by original day
  const byDay = deferredJobs.reduce((acc, job) => {
    const day = job.originalDay;
    if (!acc[day]) acc[day] = [];
    acc[day].push(job);
    return acc;
  }, {} as Record<string, DeferredJob[]>);

  return (
    <div className="p-4 border rounded-lg border-amber-500/50 bg-amber-500/10 space-y-3">
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <span className="font-medium text-amber-700 dark:text-amber-400">
            {deferredJobs.length} Jobs Pending (Could not be scheduled)
          </span>
        </div>
        <Button variant="ghost" size="sm">
          {isExpanded ? 'Hide' : 'Show'}
        </Button>
      </div>
      
      {isExpanded && (
        <div className="space-y-4 pt-2">
          {Object.entries(byDay).map(([day, jobs]) => (
            <div key={day} className="space-y-2">
              <div className="text-sm font-medium capitalize text-muted-foreground">
                From {day}:
              </div>
              <div className="grid gap-2">
                {jobs.map((job, idx) => (
                  <div 
                    key={`${job.orderId}-${job.type}-${idx}`} 
                    className="text-sm p-2 bg-background rounded border"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {job.type === 'collection' ? '📦' : '🚚'} {job.contactName}
                      </span>
                      <Badge variant={job.type === 'collection' ? 'default' : 'secondary'} className="text-xs">
                        {job.type}
                      </Badge>
                    </div>
                    {job.order.tracking_number && (
                      <div className="text-xs font-mono text-primary mt-1">
                        #{job.order.tracking_number}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">{job.address}</div>
                    <div className="text-xs text-amber-600 dark:text-amber-400 mt-1 italic">
                      {job.reason}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            These jobs will need to be scheduled manually or wait for more volume.
          </p>
        </div>
      )}
    </div>
  );
};

export default WeeklyRoutePlanner;