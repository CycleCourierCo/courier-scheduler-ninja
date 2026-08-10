import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import ApiWebhookStatsCards from "@/components/analytics/ApiWebhookStatsCards";
import ApiOrdersOverTimeChart from "@/components/analytics/ApiOrdersOverTimeChart";
import ApiWebhookTrendChart from "@/components/analytics/ApiWebhookTrendChart";
import {
  ApiCustomerLeaderboardTable,
  ApiEndpointStatsTable,
  RecentWebhookFailuresTable,
  WebhookEndpointHealthTable,
  WebhookEventBreakdownTable,
} from "@/components/analytics/ApiWebhookTables";
import {
  fetchApiCreatedOrders,
  fetchApiKeys,
  fetchApiRequestLogs,
  fetchWebhookConfigs,
  fetchWebhookDeliveries,
  getApiCustomerLeaderboard,
  getApiEndpointStats,
  getApiOrdersOverTime,
  getApiRequestsOverTime,
  getApiWebhookTotals,
  getRecentWebhookFailures,
  getWebhookDeliveriesOverTime,
  getWebhookEndpointHealth,
  getWebhookEventBreakdown,
  type ApiWebhookRange,
} from "@/services/apiWebhookAnalyticsService";

const PRESETS: { label: string; days: number | "all" }[] = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "All time", days: "all" },
];

const buildRange = (days: number | "all"): ApiWebhookRange | undefined => {
  if (days === "all") return undefined;
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  return { start: start.toISOString(), end: end.toISOString() };
};

const ApiWebhookSection = () => {
  const [days, setDays] = useState<number | "all">(30);
  const range = useMemo(() => buildRange(days), [days]);
  const rangeKey = days === "all" ? "all" : String(days);

  const { data: apiOrders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ["apiOrders", rangeKey],
    queryFn: () => fetchApiCreatedOrders(range),
  });

  const { data: requestLogs = [] } = useQuery({
    queryKey: ["apiRequestLogs", rangeKey],
    queryFn: () => fetchApiRequestLogs(range),
  });

  const { data: deliveries = [] } = useQuery({
    queryKey: ["webhookDeliveries", rangeKey],
    queryFn: () => fetchWebhookDeliveries(range),
  });

  const { data: configs = [] } = useQuery({
    queryKey: ["webhookConfigs"],
    queryFn: fetchWebhookConfigs,
  });

  const { data: keys = [] } = useQuery({
    queryKey: ["apiKeysAnalytics"],
    queryFn: fetchApiKeys,
  });

  const { data: totalOrders = 0 } = useQuery({
    queryKey: ["ordersCountForApiShare", rangeKey],
    queryFn: async () => {
      let q = supabase.from("orders").select("id", { count: "exact", head: true });
      if (range) q = q.gte("created_at", range.start).lte("created_at", range.end);
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: nameLookup = {} } = useQuery({
    queryKey: ["apiCustomerNames"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,name,email,company_name");
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const p of data ?? []) {
        map[p.id] = p.company_name || p.name || p.email || "Unknown customer";
      }
      return map;
    },
  });

  const totals = useMemo(
    () => getApiWebhookTotals(apiOrders, totalOrders, requestLogs, keys, deliveries, configs),
    [apiOrders, totalOrders, requestLogs, keys, deliveries, configs],
  );

  const ordersSeries = useMemo(() => getApiOrdersOverTime(apiOrders), [apiOrders]);
  const requestSeries = useMemo(() => getApiRequestsOverTime(requestLogs), [requestLogs]);
  const deliverySeries = useMemo(() => getWebhookDeliveriesOverTime(deliveries), [deliveries]);
  const endpointStats = useMemo(() => getApiEndpointStats(requestLogs), [requestLogs]);
  const customerRows = useMemo(
    () => getApiCustomerLeaderboard(apiOrders, requestLogs, keys, nameLookup),
    [apiOrders, requestLogs, keys, nameLookup],
  );
  const endpointHealth = useMemo(
    () => getWebhookEndpointHealth(configs, deliveries, nameLookup),
    [configs, deliveries, nameLookup],
  );
  const eventRows = useMemo(() => getWebhookEventBreakdown(deliveries), [deliveries]);
  const failures = useMemo(() => getRecentWebhookFailures(deliveries, configs), [deliveries, configs]);

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p.label}
            size="sm"
            variant={days === p.days ? "default" : "outline"}
            onClick={() => setDays(p.days)}
          >
            {p.label}
          </Button>
        ))}
        {loadingOrders && <span className="text-xs text-muted-foreground">Loading…</span>}
      </div>

      <ApiWebhookStatsCards totals={totals} />

      <Separator />
      <section className="space-y-4">
        <h3 className="text-base font-semibold">Inbound API</h3>
        <ApiOrdersOverTimeChart data={ordersSeries} />
        <ApiWebhookTrendChart
          data={requestSeries}
          title="API requests"
          description="Successful vs failed requests to the public orders API"
        />
        <ApiEndpointStatsTable rows={endpointStats} />
        <ApiCustomerLeaderboardTable rows={customerRows} />
      </section>

      <Separator />
      <section className="space-y-4">
        <h3 className="text-base font-semibold">Outbound webhooks</h3>
        <ApiWebhookTrendChart
          data={deliverySeries}
          title="Webhook deliveries"
          description="Delivered vs failed outbound webhook attempts"
        />
        <WebhookEndpointHealthTable rows={endpointHealth} />
        <WebhookEventBreakdownTable rows={eventRows} />
        <RecentWebhookFailuresTable rows={failures} />
      </section>
    </div>
  );
};

export default ApiWebhookSection;
