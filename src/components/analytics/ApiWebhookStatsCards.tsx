import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ApiWebhookTotals } from "@/services/apiWebhookAnalyticsService";

interface Props {
  totals: ApiWebhookTotals;
}

const Stat = ({ title, value, hint }: { title: string; value: string; hint?: string }) => (
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-xl sm:text-2xl font-bold break-words">{value}</div>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </CardContent>
  </Card>
);

const ApiWebhookStatsCards = ({ totals }: Props) => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
    <Stat
      title="API orders"
      value={String(totals.apiOrders)}
      hint={`${totals.apiOrdersShare}% of orders · ${totals.shopifyOrders} via Shopify`}
    />
    <Stat
      title="API keys"
      value={`${totals.activeKeys}/${totals.totalKeys}`}
      hint={`${totals.keysUsedLast30} used in 30 days · ${totals.keysNeverUsed} never used`}
    />
    <Stat
      title="API requests"
      value={String(totals.requests)}
      hint={`${totals.requestSuccessRate}% success · ${totals.avgRequestMs}ms avg`}
    />
    <Stat
      title="Webhook success"
      value={`${totals.deliverySuccessRate}%`}
      hint={`${totals.deliveries} deliveries · ${totals.activeEndpoints} active endpoints`}
    />
    <Stat title="Avg webhook latency" value={`${totals.avgDeliveryMs}ms`} hint="Per delivery attempt" />
    <Stat title="Avg attempts" value={String(totals.avgAttempts)} hint="Retries per delivery" />
  </div>
);

export default ApiWebhookStatsCards;
