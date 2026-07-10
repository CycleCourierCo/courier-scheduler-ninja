import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { FileText, Calendar, TrendingUp, ArrowDownUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { cn } from "@/lib/utils";
import { aggregateProfitability, getTimeslipsForWeek } from "@/services/profitabilityService";

interface InvoiceVsCostComparisonProps {
  costPerMile: number;
  revenuePerStop: number;
  useBikeTypePricing: boolean;
}

const chartConfig = {
  invoiced: { label: "Invoiced", color: "hsl(var(--primary))" },
  routeRevenue: { label: "Route Revenue", color: "hsl(142, 76%, 36%)" },
  costs: { label: "Costs", color: "hsl(25, 95%, 53%)" },
};

const InvoiceVsCostComparison = ({ costPerMile, revenuePerStop, useBikeTypePricing }: InvoiceVsCostComparisonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));

  const startStr = format(startDate, "yyyy-MM-dd");
  const endStr = format(endDate, "yyyy-MM-dd");

  // Fetch invoices for overlapping date range
  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ["invoice-comparison", startStr, endStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_history")
        .select("*")
        .lte("start_date", endStr)
        .gte("end_date", startStr)
        .order("customer_name");
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen,
  });

  // Fetch timeslips for the same period
  const { data: timeslips = [], isLoading: loadingTimeslips } = useQuery({
    queryKey: ["invoice-comparison-timeslips", startStr, endStr],
    queryFn: () => getTimeslipsForWeek(startStr, endStr),
    enabled: isOpen,
  });

  // Calculate route profitability
  const { data: routeData, isLoading: loadingRoute } = useQuery({
    queryKey: ["invoice-comparison-route", timeslips, revenuePerStop, costPerMile, useBikeTypePricing],
    queryFn: () => aggregateProfitability(timeslips, revenuePerStop, costPerMile, useBikeTypePricing),
    enabled: isOpen && timeslips.length > 0,
  });

  const totalInvoiced = useMemo(() => invoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0), [invoices]);
  const totalOrders = useMemo(() => invoices.reduce((sum, inv) => sum + inv.order_count, 0), [invoices]);
  const routeRevenue = routeData?.totalRevenue || 0;
  const routeCosts = routeData?.totalCosts || 0;
  const trueProfit = totalInvoiced - routeCosts;
  const margin = totalInvoiced > 0 ? (trueProfit / totalInvoiced) * 100 : 0;

  const isLoading = loadingInvoices || loadingTimeslips || loadingRoute;

  // Per-customer breakdown
  const customerBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; amount: number; orders: number }>();
    invoices.forEach((inv) => {
      const existing = map.get(inv.customer_name) || { name: inv.customer_name, amount: 0, orders: 0 };
      existing.amount += Number(inv.total_amount);
      existing.orders += inv.order_count;
      map.set(inv.customer_name, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [invoices]);

  const chartData = [
    { name: "Invoiced", invoiced: totalInvoiced, routeRevenue: 0, costs: 0 },
    { name: "Route Revenue", invoiced: 0, routeRevenue, costs: 0 },
    { name: "Costs", invoiced: 0, routeRevenue: 0, costs: routeCosts },
  ];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ArrowDownUp className="h-5 w-5" />
                  Invoice vs Route Comparison
                </CardTitle>
                <CardDescription>
                  Compare actual invoiced revenue against route profitability estimates
                </CardDescription>
              </div>
              <span className="text-sm text-muted-foreground">{isOpen ? "▲" : "▼"}</span>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* Date Range Picker */}
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-1">
                <label className="text-sm font-medium">Start Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[180px] justify-start text-left font-normal">
                      <Calendar className="mr-2 h-4 w-4" />
                      {format(startDate, "PP")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={startDate}
                      onSelect={(d) => d && setStartDate(d)}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">End Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[180px] justify-start text-left font-normal">
                      <Calendar className="mr-2 h-4 w-4" />
                      {format(endDate, "PP")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={endDate}
                      onSelect={(d) => d && setEndDate(d)}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading comparison data...</div>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
                  <Card>
                    <CardHeader className="pb-2 p-3">
                      <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <FileText className="h-3 w-3" /> Invoiced
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <p className="text-xl font-bold text-primary">£{totalInvoiced.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{totalOrders} orders</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2 p-3">
                      <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" /> Route Revenue
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <p className="text-xl font-bold text-green-600">£{routeRevenue.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">
                        {totalInvoiced > 0 && routeRevenue > 0
                          ? `${((routeRevenue / totalInvoiced) * 100).toFixed(0)}% of invoiced`
                          : "—"}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2 p-3">
                      <CardTitle className="text-xs font-medium text-muted-foreground">Route Costs</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <p className="text-xl font-bold text-orange-600">£{routeCosts.toFixed(2)}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2 p-3">
                      <CardTitle className="text-xs font-medium text-muted-foreground">True Profit</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <p className={cn("text-xl font-bold", trueProfit >= 0 ? "text-green-600" : "text-red-600")}>
                        £{trueProfit.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">Invoiced − Costs</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2 p-3">
                      <CardTitle className="text-xs font-medium text-muted-foreground">Margin</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <p className={cn("text-xl font-bold", margin >= 0 ? "text-green-600" : "text-red-600")}>
                        {margin.toFixed(1)}%
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Bar Chart */}
                {(totalInvoiced > 0 || routeRevenue > 0 || routeCosts > 0) && (
                  <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(v) => `£${v}`} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="invoiced" fill="var(--color-invoiced)" name="Invoiced" />
                      <Bar dataKey="routeRevenue" fill="var(--color-routeRevenue)" name="Route Revenue" />
                      <Bar dataKey="costs" fill="var(--color-costs)" name="Costs" />
                    </BarChart>
                  </ChartContainer>
                )}

                {/* Customer Breakdown */}
                {customerBreakdown.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Per-Customer Breakdown</h3>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Customer</TableHead>
                            <TableHead className="text-right">Invoiced</TableHead>
                            <TableHead className="text-right">Orders</TableHead>
                            <TableHead className="text-right">Share</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {customerBreakdown.map((cust) => (
                            <TableRow key={cust.name}>
                              <TableCell className="font-medium">{cust.name}</TableCell>
                              <TableCell className="text-right">£{cust.amount.toFixed(2)}</TableCell>
                              <TableCell className="text-right">{cust.orders}</TableCell>
                              <TableCell className="text-right">
                                {totalInvoiced > 0 ? ((cust.amount / totalInvoiced) * 100).toFixed(1) : 0}%
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {invoices.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    No invoices found for this date range
                  </p>
                )}
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default InvoiceVsCostComparison;
