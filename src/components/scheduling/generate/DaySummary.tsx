import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Loader2, PoundSterling } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { hasRole } from "@/lib/roles";
import { COST_PER_MILE, DRIVER_HOURLY_RATE, formatGBP } from "@/lib/routeCosts";
import { getRevenueForRouteStops } from "@/services/profitabilityService";
import { PlanRoute, formatDuration } from "@/services/routeGenerationService";

const THIN_ROUTE_STOPS = 13;

const Stat: React.FC<{ label: string; value: string; sub?: string }> = ({ label, value, sub }) => (
  <div>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="font-medium">{value}</p>
    {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
  </div>
);

interface Props {
  date: string;
  routes: PlanRoute[];
}

const DaySummary: React.FC<Props> = ({ date, routes }) => {
  const { userProfile } = useAuth();
  const isAdmin = hasRole(userProfile, "admin");

  const totals = useMemo(() => {
    const vans = routes.length;
    const stops = routes.reduce((n, r) => n + r.stop_count, 0);
    const seconds = routes.reduce((n, r) => n + r.duration_s, 0);
    const miles = routes.reduce((n, r) => n + r.miles, 0);
    const load = routes.reduce((n, r) => n + r.max_load, 0);
    const capacity = routes.reduce((n, r) => n + r.van_capacity, 0);
    const guaranteed = routes.reduce((n, r) => n + r.guaranteed_count, 0);
    const thin = routes.filter((r) => r.stop_count < THIN_ROUTE_STOPS).length;
    const orders = new Set<string>();
    routes.forEach((r) => r.stops.forEach((s) => orders.add(s.order_id)));
    return {
      vans, stops, seconds, miles, load, capacity, guaranteed, thin,
      orders: orders.size,
      hours: seconds / 3600,
    };
  }, [routes]);

  const [costs, setCosts] = useState<{ revenue: number; stopCount: number; orderCount: number } | null>(null);
  const [loadingCosts, setLoadingCosts] = useState(false);
  const [costError, setCostError] = useState(false);

  useEffect(() => {
    if (!isAdmin || routes.length === 0) {
      setCosts(null);
      setCostError(false);
      return;
    }
    let cancelled = false;
    setLoadingCosts(true);
    setCostError(false);
    const stops = routes.flatMap((r) =>
      r.stops.map((s) => ({
        orderId: s.order_id,
        type: s.leg_type === "collection" ? "pickup" : "delivery",
      })),
    );
    (async () => {
      try {
        const result = await getRevenueForRouteStops(stops);
        if (!cancelled) setCosts(result);
      } catch {
        if (!cancelled) {
          setCosts(null);
          setCostError(true);
        }
      } finally {
        if (!cancelled) setLoadingCosts(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isAdmin, date, routes]);

  if (routes.length === 0) return null;

  const mileageCost = totals.miles * COST_PER_MILE;
  const driverPay = totals.hours * DRIVER_HOURLY_RATE;
  const totalCost = mileageCost + driverPay;
  const revenue = costs?.revenue ?? 0;
  const profit = revenue - totalCost;

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" /> Day summary
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
          <Stat label="Total stops" value={String(totals.stops)} sub={`${totals.orders} job${totals.orders === 1 ? "" : "s"}`} />
          <Stat label="Vans used" value={String(totals.vans)} />
          <Stat
            label="Avg stops per van"
            value={totals.vans ? (totals.stops / totals.vans).toFixed(1) : "—"}
          />
          <Stat
            label="Total hours"
            value={formatDuration(totals.seconds)}
            sub={totals.vans ? `avg ${formatDuration(Math.round(totals.seconds / totals.vans))}` : undefined}
          />
          <Stat
            label="Total miles"
            value={`${Math.round(totals.miles)} mi`}
            sub={totals.vans ? `avg ${Math.round(totals.miles / totals.vans)} mi` : undefined}
          />
          <Stat label="Spaces used" value={`${totals.load}/${totals.capacity}`} />
          <Stat label="Guaranteed stops" value={String(totals.guaranteed)} />
          <Stat label="Thin routes" value={`${totals.thin} of ${totals.vans}`} />
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <PoundSterling className="h-4 w-4" /> Costings for this day
              {loadingCosts && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {costError ? (
              <p className="text-muted-foreground">Costs unavailable.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                <Stat label="Revenue" value={formatGBP(revenue)} />
                <Stat label="Mileage cost" value={formatGBP(mileageCost)} />
                <Stat label="Driver pay" value={formatGBP(driverPay)} />
                <Stat label="Total cost" value={formatGBP(totalCost)} />
                <div>
                  <p className="text-xs text-muted-foreground">Profit</p>
                  <p className={cn("font-semibold", profit >= 0 ? "text-green-600" : "text-red-600")}>
                    {formatGBP(profit)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {revenue > 0 ? `${((profit / revenue) * 100).toFixed(1)}% margin` : "—"}
                  </p>
                </div>
                <Stat label="£/stop" value={formatGBP(totals.stops ? revenue / totals.stops : 0)} />
                <Stat label="Cost/stop" value={formatGBP(totals.stops ? totalCost / totals.stops : 0)} />
                <Stat label="Profit/stop" value={formatGBP(totals.stops ? profit / totals.stops : 0)} />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DaySummary;
