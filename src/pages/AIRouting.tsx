import React, { useState, useCallback } from "react";
import * as Sentry from "@sentry/react";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import AIRoutingControls from "@/components/ai-routing/AIRoutingControls";
import PredictedRouteCard from "@/components/ai-routing/PredictedRouteCard";
import DayOverview from "@/components/ai-routing/DayOverview";
import RouteComparisonView from "@/components/ai-routing/RouteComparisonView";
import ValidationBadge from "@/components/ai-routing/ValidationBadge";
import UnassignedStopsPanel from "@/components/ai-routing/UnassignedStopsPanel";
import { optimizeMultiDriverRoute } from "@/services/routeOptimizationService";

interface RouteStop {
  stop_id: string;
  order_id: string;
  type: string;
  day: string;
  driver_slot: number;
  contact_name: string;
  address: string;
  phone: string;
  lat: number;
  lon: number;
  postcode_prefix: string;
  date_match: 'exact' | 'flexible' | 'no_dates';
  sequenceOrder?: number;
  estimatedArrivalTime?: string;
  archetype_label?: string;
  similarity_score?: number;
  compactness_score?: number;
}

interface UnassignedStop {
  stop_id: string;
  order_id: string;
  type: string;
  contact_name: string;
  address: string;
  postcode_prefix: string;
  region: string;
}

interface PredictionResult {
  prediction_id: string;
  driver_count: number;
  total_stops: number;
  routes_by_day: Record<string, Record<string, RouteStop[]>>;
  validation: {
    passed: boolean;
    errors: string[];
    fallback_used: boolean;
  };
  ai_tokens_used: number;
  planning_mode?: string;
  unassigned_stops?: UnassignedStop[];
}

interface ComparisonScenario {
  driverCount: number;
  totalStops: number;
  daysUsed: number;
  avgStopsPerRoute: number;
  validationPassed: boolean;
  fallbackUsed: boolean;
  validationErrors: string[];
}

const getNextMonday = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? 1 : 8);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
};

const getNextFriday = () => {
  const monday = new Date(getNextMonday());
  monday.setDate(monday.getDate() + 4);
  return monday.toISOString().split('T')[0];
};

const AIRouting: React.FC = () => {
  const [dateStart, setDateStart] = useState(getNextMonday());
  const [dateEnd, setDateEnd] = useState(getNextFriday());
  const [driverCount, setDriverCount] = useState(3);
  const [includeNoDates, setIncludeNoDates] = useState(true);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [patternsLastUpdated, setPatternsLastUpdated] = useState<string>();
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [comparisons, setComparisons] = useState<Map<number, PredictionResult>>(new Map());
  const [optimizingRoutes, setOptimizingRoutes] = useState<Set<string>>(new Set());
  const [routeMileage, setRouteMileage] = useState<Map<string, number>>(new Map());
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [unassignedStops, setUnassignedStops] = useState<UnassignedStop[]>([]);

  const handleRefreshPatterns = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('build-postcode-patterns', {
        body: {},
      });
      if (error) throw error;
      setPatternsLastUpdated(new Date().toISOString());
      toast.success(`Patterns refreshed: ${data.patterns_updated} postcodes updated`);
    } catch (error) {
      console.error('Refresh patterns error:', error);
      Sentry.captureException(error);
      toast.error('Failed to refresh patterns');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const generatePlan = useCallback(async (drivers: number): Promise<PredictionResult | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('predict-routes-v2', {
        body: {
          driver_count: drivers,
          date_range_start: dateStart,
          date_range_end: dateEnd,
          include_no_dates: includeNoDates,
        },
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return null;
      }

      return data as PredictionResult;
    } catch (error: any) {
      console.error('Generate plan error:', error);
      Sentry.captureException(error);
      
      if (error?.status === 429) {
        toast.error('Rate limit reached. Please try again in a moment.');
      } else if (error?.status === 402) {
        toast.error('AI credits exhausted. Please add funds in Settings > Workspace > Usage.');
      } else {
        toast.error('Failed to generate plan');
      }
      return null;
    }
  }, [dateStart, dateEnd, includeNoDates]);

  const handleGeneratePlan = useCallback(async () => {
    setIsGenerating(true);
    const result = await generatePlan(driverCount);
    if (result) {
      setPrediction(result);
      setUnassignedStops(result.unassigned_stops || []);
      const days = Object.keys(result.routes_by_day).sort();
      if (days.length > 0) setSelectedDay(days[0]);
      
      const tokenInfo = result.ai_tokens_used > 0 ? ` (${result.ai_tokens_used} tokens)` : '';
      const method = result.validation.fallback_used ? 'heuristic fallback' : 'AI';
      const modeLabel = result.planning_mode === 'v2' ? ' [v2 Archetype]' : '';
      toast.success(`Plan generated via ${method}${modeLabel}: ${result.total_stops} stops across ${days.length} days${tokenInfo}`);
    }
    setIsGenerating(false);
  }, [driverCount, generatePlan]);

  const handleCompare = useCallback(async (compareDrivers: number) => {
    setIsGenerating(true);
    const result = await generatePlan(compareDrivers);
    if (result) {
      setComparisons(prev => new Map(prev).set(compareDrivers, result));
      toast.success(`Comparison plan generated for ${compareDrivers} drivers`);
    }
    setIsGenerating(false);
  }, [generatePlan]);

  const handleOptimizeRoute = useCallback(async (day: string, driverSlot: number) => {
    if (!prediction) return;
    const key = `${day}_${driverSlot}`;
    setOptimizingRoutes(prev => new Set(prev).add(key));

    try {
      const stops = prediction.routes_by_day[day]?.[driverSlot.toString()];
      if (!stops || stops.length === 0) return;

      const jobs = stops.map(s => ({
        orderId: s.order_id,
        type: s.type === 'collection' ? 'collection' as const : 'delivery' as const,
        contactName: s.contact_name,
        address: s.address,
        phoneNumber: s.phone,
        order: {},
        lat: s.lat,
        lon: s.lon,
      }));

      const result = await optimizeMultiDriverRoute(jobs, new Date(day), 1);
      const routeData = result.get(0);
      const optimizedJobs = routeData?.jobs || [];
      const distanceMiles = routeData?.distanceMiles || 0;

      if (optimizedJobs.length > 0) {
        const updatedPrediction = { ...prediction };
        const updatedStops = stops.map(stop => {
          const opt = optimizedJobs.find(j => j.orderId === stop.order_id && 
            (j.type === 'collection' ? 'collection' : 'delivery') === stop.type);
          if (opt) {
            return {
              ...stop,
              sequenceOrder: opt.sequenceOrder,
              estimatedArrivalTime: opt.estimatedArrivalTime,
            };
          }
          return stop;
        }).sort((a, b) => (a.sequenceOrder || 99) - (b.sequenceOrder || 99));

        updatedPrediction.routes_by_day = {
          ...updatedPrediction.routes_by_day,
          [day]: {
            ...updatedPrediction.routes_by_day[day],
            [driverSlot.toString()]: updatedStops,
          },
        };
        setPrediction(updatedPrediction);
        setRouteMileage(prev => new Map(prev).set(key, distanceMiles));
        toast.success(`Route optimized for Driver Slot ${driverSlot}`);
      }
    } catch (error) {
      console.error('Optimize route error:', error);
      Sentry.captureException(error);
      toast.error('Failed to optimize route sequence');
    } finally {
      setOptimizingRoutes(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, [prediction]);

  const handleOptimizeAll = useCallback(async (day: string) => {
    if (!prediction) return;
    const slots = Object.keys(prediction.routes_by_day[day] || {});
    for (const slot of slots) {
      await handleOptimizeRoute(day, parseInt(slot));
    }
  }, [prediction, handleOptimizeRoute]);

  // Build comparison scenarios
  const comparisonScenarios = React.useMemo(() => {
    const scenarios: ComparisonScenario[] = [];

    if (prediction) {
      const days = Object.keys(prediction.routes_by_day);
      let totalRoutes = 0;
      for (const day of days) {
        totalRoutes += Object.keys(prediction.routes_by_day[day]).length;
      }
      scenarios.push({
        driverCount: prediction.driver_count,
        totalStops: prediction.total_stops,
        daysUsed: days.length,
        avgStopsPerRoute: totalRoutes > 0 ? prediction.total_stops / totalRoutes : 0,
        validationPassed: prediction.validation.passed,
        fallbackUsed: prediction.validation.fallback_used,
        validationErrors: prediction.validation.errors,
      });
    }

    for (const [dc, comp] of comparisons) {
      const days = Object.keys(comp.routes_by_day);
      let totalRoutes = 0;
      for (const day of days) {
        totalRoutes += Object.keys(comp.routes_by_day[day]).length;
      }
      scenarios.push({
        driverCount: dc,
        totalStops: comp.total_stops,
        daysUsed: days.length,
        avgStopsPerRoute: totalRoutes > 0 ? comp.total_stops / totalRoutes : 0,
        validationPassed: comp.validation.passed,
        fallbackUsed: comp.validation.fallback_used,
        validationErrors: comp.validation.errors,
      });
    }

    return scenarios.sort((a, b) => a.driverCount - b.driverCount);
  }, [prediction, comparisons]);

  const days = prediction ? Object.keys(prediction.routes_by_day).sort() : [];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">AI Route Prediction</h1>
            <p className="text-sm text-muted-foreground">
              Generate and compare multi-day route plans using AI-assisted scheduling
            </p>
          </div>
          {prediction && (
            <ValidationBadge
              passed={prediction.validation.passed}
              fallbackUsed={prediction.validation.fallback_used}
              errors={prediction.validation.errors}
            />
          )}
        </div>

        <AIRoutingControls
          dateStart={dateStart}
          dateEnd={dateEnd}
          driverCount={driverCount}
          includeNoDates={includeNoDates}
          planningMode={planningMode}
          onDateStartChange={setDateStart}
          onDateEndChange={setDateEnd}
          onDriverCountChange={setDriverCount}
          onIncludeNoDatesChange={setIncludeNoDates}
          onPlanningModeChange={setPlanningMode}
          onRefreshPatterns={handleRefreshPatterns}
          onGeneratePlan={handleGeneratePlan}
          onCompare={handleCompare}
          isGenerating={isGenerating}
          isRefreshing={isRefreshing}
          patternsLastUpdated={patternsLastUpdated}
        />

        {comparisonScenarios.length >= 2 && (
          <RouteComparisonView
            scenarios={comparisonScenarios}
            onViewDetails={(dc) => {
              const comp = comparisons.get(dc);
              if (comp) {
                setPrediction(comp);
                const compDays = Object.keys(comp.routes_by_day).sort();
                if (compDays.length > 0) setSelectedDay(compDays[0]);
              }
            }}
          />
        )}

        {prediction && days.length > 0 && (
          <Tabs value={selectedDay} onValueChange={setSelectedDay}>
            <TabsList className="flex-wrap h-auto gap-1">
              {days.map(day => {
                const dayLabel = new Date(day + 'T00:00:00').toLocaleDateString('en-GB', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                });
                const slotCount = Object.keys(prediction.routes_by_day[day] || {}).length;
                const stopCount = Object.values(prediction.routes_by_day[day] || {})
                  .reduce((sum, stops) => sum + (stops as RouteStop[]).length, 0);
                return (
                  <TabsTrigger key={day} value={day} className="text-xs">
                    {dayLabel} ({stopCount})
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {days.map(day => {
              const dayRoutes = prediction.routes_by_day[day] || {};
              const slots = Object.keys(dayRoutes).sort((a, b) => parseInt(a) - parseInt(b));
              const totalStops = Object.values(dayRoutes)
                .reduce((sum, stops) => sum + (stops as RouteStop[]).length, 0);

              return (
                <TabsContent key={day} value={day} className="space-y-4">
                  <DayOverview
                    day={day}
                    totalStops={totalStops}
                    routeCount={slots.length}
                    estimatedMiles={slots.reduce((sum, s) => sum + (routeMileage.get(`${day}_${s}`) || 0), 0) || undefined}
                    onOptimizeAll={() => handleOptimizeAll(day)}
                    isOptimizing={slots.some(s => optimizingRoutes.has(`${day}_${s}`))}
                  />

                  {unassignedStops.length > 0 && planningMode === 'v2' && (
                    <UnassignedStopsPanel stops={unassignedStops} />
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {slots.map(slot => {
                      const stops = dayRoutes[slot] as RouteStop[];
                      const key = `${day}_${slot}`;
                      const firstStop = stops[0];
                      return (
                        <PredictedRouteCard
                          key={key}
                          driverSlot={parseInt(slot)}
                          day={day}
                          stops={stops}
                          estimatedMiles={routeMileage.get(key)}
                          isOptimized={stops.some(s => s.sequenceOrder !== undefined)}
                          onOptimize={() => handleOptimizeRoute(day, parseInt(slot))}
                          isOptimizing={optimizingRoutes.has(key)}
                          archetypeLabel={firstStop?.archetype_label}
                          similarityScore={firstStop?.similarity_score}
                          compactnessScore={firstStop?.compactness_score}
                        />
                      );
                    })}
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        )}

        {!prediction && !isGenerating && (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium">No plan generated yet</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Set your date range and driver count, then click "Generate AI Plan" to create an optimised route prediction.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AIRouting;
