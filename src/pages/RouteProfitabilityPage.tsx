import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar, TrendingUp } from "lucide-react";
import Layout from "@/components/Layout";
import DashboardHeader from "@/components/DashboardHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { 
  getTimeslipsForDate, 
  updateTimeslipMileage, 
  calculateProfitability,
  aggregateProfitability 
} from "@/services/profitabilityService";

const RouteProfitabilityPage = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [revenuePerStop, setRevenuePerStop] = useState<number>(32);
  const [costPerMile, setCostPerMile] = useState<number>(0.45);
  const queryClient = useQueryClient();

  const dateString = format(selectedDate, 'yyyy-MM-dd');

  const { data: timeslips = [], isLoading } = useQuery({
    queryKey: ['profitability-timeslips', dateString],
    queryFn: () => getTimeslipsForDate(dateString),
  });

  const updateMileageMutation = useMutation({
    mutationFn: ({ id, mileage }: { id: string; mileage: number }) =>
      updateTimeslipMileage(id, mileage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profitability-timeslips'] });
      toast.success("Mileage updated");
    },
    onError: (error) => {
      toast.error("Failed to update mileage");
      console.error(error);
    },
  });

  const handleMileageChange = (id: string, value: string) => {
    const mileage = parseFloat(value);
    if (!isNaN(mileage) && mileage >= 0) {
      updateMileageMutation.mutate({ id, mileage });
    }
  };

  const aggregated = aggregateProfitability(timeslips, revenuePerStop, costPerMile);

  return (
    <Layout>
      <DashboardHeader />
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Route Profitability</h1>
        </div>

        {/* Settings Section */}
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>Configure profitability calculation parameters</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="revenue">Revenue per Stop (£)</Label>
              <Input
                id="revenue"
                type="number"
                step="0.01"
                min="0"
                value={revenuePerStop}
                onChange={(e) => setRevenuePerStop(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cost">Cost per Mile (£)</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                min="0"
                value={costPerMile}
                onChange={(e) => setCostPerMile(parseFloat(e.target.value) || 0)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Summary Section */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                £{aggregated.totalRevenue.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Costs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                £{aggregated.totalCosts.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Profit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn(
                "text-2xl font-bold",
                aggregated.totalProfit >= 0 ? "text-green-600" : "text-red-600"
              )}>
                £{aggregated.totalProfit.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Drivers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{aggregated.driverCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Timeslips Table */}
        <Card>
          <CardHeader>
            <CardTitle>Timeslips for {format(selectedDate, "PPP")}</CardTitle>
            <CardDescription>
              {timeslips.length} timeslip{timeslips.length !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : timeslips.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No timeslips found for this date
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Driver</TableHead>
                      <TableHead className="text-right">Stops</TableHead>
                      <TableHead className="text-right">Mileage</TableHead>
                      <TableHead className="text-right">Driver Pay</TableHead>
                      <TableHead className="text-right">Custom Addons</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Total Costs</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timeslips.map((timeslip) => {
                      const metrics = calculateProfitability(timeslip, revenuePerStop, costPerMile);
                      return (
                        <TableRow key={timeslip.id}>
                          <TableCell className="font-medium">
                            {timeslip.driver?.name || 'Unknown Driver'}
                          </TableCell>
                          <TableCell className="text-right">{timeslip.total_stops}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              placeholder="Enter miles"
                              value={timeslip.mileage || ''}
                              onChange={(e) => handleMileageChange(timeslip.id, e.target.value)}
                              className="w-24 text-right"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            £{(timeslip.total_pay || 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            £{metrics.customAddonCosts.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right text-green-600 font-medium">
                            £{metrics.revenue.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right text-orange-600">
                            £{metrics.totalCosts.toFixed(2)}
                          </TableCell>
                          <TableCell className={cn(
                            "text-right font-bold",
                            metrics.profit >= 0 ? "text-green-600" : "text-red-600"
                          )}>
                            £{metrics.profit.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default RouteProfitabilityPage;
