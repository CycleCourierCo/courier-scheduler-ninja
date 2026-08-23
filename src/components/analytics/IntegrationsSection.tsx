import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import StatsCard from "@/components/analytics/StatsCard";
import { Activity, AlertTriangle, ArrowDownLeft, ArrowUpRight, Timer } from "lucide-react";
import {
  fetchIntegrationCallLogs,
  getIntegrationCallsOverTime,
  getIntegrationTotals,
  getOperationStats,
  getProviderStats,
  getRecentIntegrationFailures,
  type IntegrationRange,
} from "@/services/integrationAnalyticsService";

const PRESETS: { label: string; days: number }[] = [
  { label: "24 hours", days: 1 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
];

const buildRange = (days: number): IntegrationRange => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  return { start: start.toISOString(), end: end.toISOString() };
};

const PROVIDER_LABELS: Record<string, string> = {
  shipday: "Shipday",
  whatsapp: "WhatsApp",
  quickbooks: "QuickBooks",
  resend: "Email (Resend)",
  shopify: "Shopify",
  inspectabike: "InspectaBike",
  geoapify: "Geoapify",
  dvla: "DVLA",
  fuel: "Fuel Finder",
  google_maps: "Google Maps",
  other: "Other",
};

const providerLabel = (provider: string) => PROVIDER_LABELS[provider] ?? provider;

const formatMs = (ms: number | null) => (ms === null ? "—" : `${ms.toLocaleString()} ms`);

const IntegrationsSection = () => {
  const [days, setDays] = useState<number>(7);
  const range = useMemo(() => buildRange(days), [days]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["integrationCallLogs", days],
    queryFn: () => fetchIntegrationCallLogs(range),
  });

  const totals = useMemo(() => getIntegrationTotals(rows), [rows]);
  const providers = useMemo(() => getProviderStats(rows), [rows]);
  const operations = useMemo(() => getOperationStats(rows).slice(0, 15), [rows]);
  const trend = useMemo(() => getIntegrationCallsOverTime(rows), [rows]);
  const failures = useMemo(() => getRecentIntegrationFailures(rows), [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((preset) => (
          <Button
            key={preset.days}
            size="sm"
            variant={days === preset.days ? "default" : "outline"}
            onClick={() => setDays(preset.days)}
          >
            {preset.label}
          </Button>
        ))}
        <span className="text-xs text-muted-foreground ml-auto">
          Metrics only — no message content or customer data is recorded. Logs are kept for 30 days.
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-4">
        <StatsCard
          title="Total calls"
          value={totals.total.toLocaleString()}
          icon={<Activity className="h-4 w-4" />}
          description={isLoading ? "Loading…" : "Outbound + inbound"}
        />
        <StatsCard
          title="Outbound"
          value={totals.outbound.toLocaleString()}
          icon={<ArrowUpRight className="h-4 w-4" />}
          description="Requests we sent"
        />
        <StatsCard
          title="Inbound webhooks"
          value={totals.inbound.toLocaleString()}
          icon={<ArrowDownLeft className="h-4 w-4" />}
          description="Received from partners"
        />
        <StatsCard
          title="Success rate"
          value={`${totals.successRate.toFixed(1)}%`}
          icon={<AlertTriangle className="h-4 w-4" />}
          description={`${totals.failures.toLocaleString()} failures`}
        />
        <StatsCard
          title="Avg response"
          value={formatMs(totals.avgDurationMs)}
          icon={<Timer className="h-4 w-4" />}
          description={`p95 ${formatMs(totals.p95DurationMs)}`}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base sm:text-lg">Calls over time</CardTitle>
        </CardHeader>
        <CardContent className="h-[260px] px-1 sm:px-6">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={(value: string) => format(parseISO(value), "d MMM")}
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                labelFormatter={(value) => format(parseISO(String(value)), "d MMM yyyy")}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="outbound" name="Outbound" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="inbound" name="Inbound" stroke="hsl(var(--chart-2, var(--muted-foreground)))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="failures" name="Failures" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base sm:text-lg">Volume by provider</CardTitle>
        </CardHeader>
        <CardContent className="h-[260px] px-1 sm:px-6">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={providers.map((p) => ({ ...p, label: providerLabel(p.provider) }))}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="total" name="Calls" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="failures" name="Failures" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg">Provider health</CardTitle>
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                    <TableHead className="text-right">Success</TableHead>
                    <TableHead className="text-right">Avg</TableHead>
                    <TableHead className="text-right">Last call</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {providers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                        {isLoading ? "Loading…" : "No integration traffic recorded yet."}
                      </TableCell>
                    </TableRow>
                  )}
                  {providers.map((p) => (
                    <TableRow key={p.provider}>
                      <TableCell className="font-medium">{providerLabel(p.provider)}</TableCell>
                      <TableCell className="text-right">{p.total.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={p.successRate >= 99 ? "secondary" : p.successRate >= 90 ? "outline" : "destructive"}>
                          {p.successRate.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatMs(p.avgDurationMs)}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {p.lastCallAt ? format(parseISO(p.lastCallAt), "d MMM HH:mm") : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg">Busiest operations</CardTitle>
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Operation</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                    <TableHead className="text-right">Success</TableHead>
                    <TableHead className="text-right">Avg</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {operations.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                        {isLoading ? "Loading…" : "Nothing to show yet."}
                      </TableCell>
                    </TableRow>
                  )}
                  {operations.map((o) => (
                    <TableRow key={`${o.provider}-${o.operation}`}>
                      <TableCell>{providerLabel(o.provider)}</TableCell>
                      <TableCell className="capitalize">{o.operation}</TableCell>
                      <TableCell className="text-right">{o.total.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{o.successRate.toFixed(1)}%</TableCell>
                      <TableCell className="text-right">{formatMs(o.avgDurationMs)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base sm:text-lg">Recent failures</CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Operation</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {failures.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                      {isLoading ? "Loading…" : "No failures in this period."}
                    </TableCell>
                  </TableRow>
                )}
                {failures.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(parseISO(f.createdAt), "d MMM HH:mm")}
                    </TableCell>
                    <TableCell>{providerLabel(f.provider)}</TableCell>
                    <TableCell className="capitalize">{f.operation}</TableCell>
                    <TableCell className="capitalize">{f.direction}</TableCell>
                    <TableCell className="text-right">{f.statusCode ?? "—"}</TableCell>
                    <TableCell className="text-xs">{f.errorLabel ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default IntegrationsSection;
