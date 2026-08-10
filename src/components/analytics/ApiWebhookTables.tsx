import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  WebhookEndpointHealthRow,
  WebhookFailureRow,
  EndpointStatRow,
  ApiCustomerRow,
  WebhookEventRow,
} from "@/services/apiWebhookAnalyticsService";

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

export const WebhookEndpointHealthTable = ({ rows }: { rows: WebhookEndpointHealthRow[] }) => (
  <Card>
    <CardHeader>
      <CardTitle>Webhook endpoint health</CardTitle>
      <CardDescription>Delivery success and latency per configured endpoint</CardDescription>
    </CardHeader>
    <CardContent className="p-0">
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="p-3 font-medium">Endpoint</th>
              <th className="p-3 font-medium">Customer</th>
              <th className="p-3 font-medium text-right">Deliveries</th>
              <th className="p-3 font-medium text-right">Success</th>
              <th className="p-3 font-medium text-right">Avg ms</th>
              <th className="p-3 font-medium text-right">Attempts</th>
              <th className="p-3 font-medium">Last fired</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-muted-foreground">
                  No webhook endpoints configured
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.configId} className="border-t align-top">
                <td className="p-3">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground break-all max-w-[240px]">{r.endpointUrl}</div>
                  {!r.isActive && (
                    <Badge variant="outline" className="mt-1">
                      Inactive
                    </Badge>
                  )}
                </td>
                <td className="p-3">{r.customer}</td>
                <td className="p-3 text-right">{r.deliveries}</td>
                <td className="p-3 text-right">
                  <Badge variant={r.successRate >= 95 ? "default" : r.successRate >= 80 ? "secondary" : "destructive"}>
                    {r.successRate}%
                  </Badge>
                </td>
                <td className="p-3 text-right">{r.avgDurationMs}</td>
                <td className="p-3 text-right">{r.avgAttempts}</td>
                <td className="p-3 whitespace-nowrap">{fmtDate(r.lastTriggeredAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CardContent>
  </Card>
);

export const ApiEndpointStatsTable = ({ rows }: { rows: EndpointStatRow[] }) => (
  <Card>
    <CardHeader>
      <CardTitle>API endpoint performance</CardTitle>
      <CardDescription>Request volume, error rate and latency per endpoint</CardDescription>
    </CardHeader>
    <CardContent className="p-0">
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="p-3 font-medium">Endpoint</th>
              <th className="p-3 font-medium text-right">Requests</th>
              <th className="p-3 font-medium text-right">Errors</th>
              <th className="p-3 font-medium text-right">Error rate</th>
              <th className="p-3 font-medium text-right">Avg ms</th>
              <th className="p-3 font-medium">Top error</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-muted-foreground">
                  No API requests logged yet for this period
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={`${r.method}-${r.endpoint}`} className="border-t">
                <td className="p-3 font-mono text-xs">
                  {r.method} /{r.endpoint}
                </td>
                <td className="p-3 text-right">{r.requests}</td>
                <td className="p-3 text-right">{r.errors}</td>
                <td className="p-3 text-right">
                  <Badge variant={r.errorRate <= 2 ? "default" : r.errorRate <= 10 ? "secondary" : "destructive"}>
                    {r.errorRate}%
                  </Badge>
                </td>
                <td className="p-3 text-right">{r.avgDurationMs}</td>
                <td className="p-3 text-xs">{r.topError ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CardContent>
  </Card>
);

export const ApiCustomerLeaderboardTable = ({ rows }: { rows: ApiCustomerRow[] }) => (
  <Card>
    <CardHeader>
      <CardTitle>API customers</CardTitle>
      <CardDescription>Integration usage by customer</CardDescription>
    </CardHeader>
    <CardContent className="p-0">
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="p-3 font-medium">Customer</th>
              <th className="p-3 font-medium">Keys</th>
              <th className="p-3 font-medium text-right">Orders</th>
              <th className="p-3 font-medium text-right">Requests</th>
              <th className="p-3 font-medium text-right">Errors</th>
              <th className="p-3 font-medium">Key last used</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-muted-foreground">
                  No API customers yet
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.userId} className="border-t">
                <td className="p-3">{r.customer}</td>
                <td className="p-3 text-xs text-muted-foreground max-w-[200px] break-words">{r.keyNames}</td>
                <td className="p-3 text-right">{r.orders}</td>
                <td className="p-3 text-right">{r.requests}</td>
                <td className="p-3 text-right">{r.errors}</td>
                <td className="p-3 whitespace-nowrap">{fmtDate(r.lastUsedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CardContent>
  </Card>
);

export const WebhookEventBreakdownTable = ({ rows }: { rows: WebhookEventRow[] }) => (
  <Card>
    <CardHeader>
      <CardTitle>Webhook events</CardTitle>
      <CardDescription>Volume and failure rate per event type</CardDescription>
    </CardHeader>
    <CardContent className="p-0">
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="p-3 font-medium">Event</th>
              <th className="p-3 font-medium text-right">Total</th>
              <th className="p-3 font-medium text-right">Failed</th>
              <th className="p-3 font-medium text-right">Failure rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="p-4 text-center text-muted-foreground">
                  No webhook deliveries in this period
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.event} className="border-t">
                <td className="p-3 font-mono text-xs">{r.event}</td>
                <td className="p-3 text-right">{r.total}</td>
                <td className="p-3 text-right">{r.failed}</td>
                <td className="p-3 text-right">{r.failureRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CardContent>
  </Card>
);

export const RecentWebhookFailuresTable = ({ rows }: { rows: WebhookFailureRow[] }) => (
  <Card>
    <CardHeader>
      <CardTitle>Recent webhook failures</CardTitle>
      <CardDescription>Most recent failed delivery attempts</CardDescription>
    </CardHeader>
    <CardContent className="p-0">
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="p-3 font-medium">When</th>
              <th className="p-3 font-medium">Endpoint</th>
              <th className="p-3 font-medium">Event</th>
              <th className="p-3 font-medium text-right">Status</th>
              <th className="p-3 font-medium text-right">Attempts</th>
              <th className="p-3 font-medium">Error</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-muted-foreground">
                  No failures — everything delivered
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3 whitespace-nowrap">{fmtDate(r.deliveredAt)}</td>
                <td className="p-3">{r.endpointName}</td>
                <td className="p-3 font-mono text-xs">{r.event}</td>
                <td className="p-3 text-right">{r.status ?? "—"}</td>
                <td className="p-3 text-right">{r.attempts ?? "—"}</td>
                <td className="p-3 text-xs text-muted-foreground max-w-[260px] break-words">{r.error ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CardContent>
  </Card>
);
