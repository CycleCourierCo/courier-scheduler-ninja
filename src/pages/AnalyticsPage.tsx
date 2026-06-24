
import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import Layout from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { 
  fetchOrdersForAnalytics, 
  getOrderStatusAnalytics,
  // getOrderTimeAnalytics no longer used here
  getCustomerTypeAnalytics,
  getTopCustomersAnalytics,
  getPartExchangeAnalytics,
  getPaymentRequiredAnalytics,
  getBikeBrandAnalytics,
  getCollectionTimeAnalytics,
  getDeliveryTimeAnalytics,
  getStorageAnalytics,
  getAllCustomersAnalytics
} from "@/services/analyticsService";
import {
  fetchInspectionsForAnalytics,
  getInspectionsOverTime,
  getInspectionsWithIssuesRate,
  getAverageRepairCost,
  getAverageBikeValue,
  getIssueApprovalRate,
  getInspectionStageDurations,
} from "@/services/inspectionAnalyticsService";
import InspectionStageDurationsChart from "@/components/analytics/InspectionStageDurationsChart";
import {
  fetchTimeslipsForAnalytics,
  getWeeklyVehicleStats,
  getVehicleTotals,
  getVehicleLeaderboard,
  type DateRange,
} from "@/services/vehicleAnalyticsService";
import { listVehicles } from "@/services/vehicleService";
import WeeklyVehicleStatsChart from "@/components/analytics/WeeklyVehicleStatsChart";
import VehicleMileageChart from "@/components/analytics/VehicleMileageChart";
import VehicleLeaderboardCard from "@/components/analytics/VehicleLeaderboardCard";
import OrderStatusChart from "@/components/analytics/OrderStatusChart";
import OrdersCreatedChart from "@/components/analytics/OrdersCreatedChart";
import OrdersCompletedChart from "@/components/analytics/OrdersCompletedChart";
import CustomerTypeChart from "@/components/analytics/CustomerTypeChart";
import TopCustomersChart from "@/components/analytics/TopCustomersChart";
import B2BLeaderboard from "@/components/analytics/B2BLeaderboard";
import BikeBrandsChart from "@/components/analytics/BikeBrandsChart";
import CollectionTimeChart from "@/components/analytics/CollectionTimeChart";
import DeliveryTimeChart from "@/components/analytics/DeliveryTimeChart";
import StorageAnalyticsChart from "@/components/analytics/StorageAnalyticsChart";
import InspectionsOverTimeChart from "@/components/analytics/InspectionsOverTimeChart";
import StatsCard from "@/components/analytics/StatsCard";
import { Bike, Calendar as CalendarLucide, Package, Truck, BarChart, PieChart, LineChart, Clock, CheckCircle2, Target, Warehouse, Timer, ClipboardCheck, AlertTriangle, PoundSterling, ThumbsUp, Route, Users } from "lucide-react";

const weeksAgoRange = (weeks: number): DateRange => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - weeks * 7);
  return {
    start: format(start, "yyyy-MM-dd"),
    end: format(end, "yyyy-MM-dd"),
  };
};

const AnalyticsPage = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [vehicleRange, setVehicleRange] = useState<DateRange | undefined>(() => weeksAgoRange(8));

  // Fetch orders for analytics
  const { data: orders = [], isLoading, error } = useQuery({
    queryKey: ["ordersAnalytics"],
    queryFn: fetchOrdersForAnalytics
  });

  const { data: inspections = [] } = useQuery({
    queryKey: ["inspectionsAnalytics"],
    queryFn: fetchInspectionsForAnalytics,
  });

  const inspectionsOverTime = getInspectionsOverTime(inspections);
  const inspectionsWithIssues = getInspectionsWithIssuesRate(inspections);
  const avgRepairCost = getAverageRepairCost(inspections);
  const avgBikeValue = getAverageBikeValue(inspections);
  const issueApproval = getIssueApprovalRate(inspections);
  const stageDurations = getInspectionStageDurations(inspections);

  const { data: vehicleTimeslips = [] } = useQuery({
    queryKey: ["vehiclesAnalytics", vehicleRange?.start ?? "all", vehicleRange?.end ?? "all"],
    queryFn: () => fetchTimeslipsForAnalytics(vehicleRange),
  });
  const { data: vehiclesList = [] } = useQuery({
    queryKey: ["vehiclesListForAnalytics"],
    queryFn: listVehicles,
  });
  const weeklyVehicleStats = getWeeklyVehicleStats(vehicleTimeslips);
  const vehicleTotals = getVehicleTotals(weeklyVehicleStats);

  const vehicleLookup = useMemo(() => {
    const o: Record<string, { registration: string }> = {};
    for (const v of vehiclesList) o[v.id] = { registration: v.registration };
    return o;
  }, [vehiclesList]);
  const vehicleLeaderboard = useMemo(
    () => getVehicleLeaderboard(vehicleTimeslips, vehicleLookup),
    [vehicleTimeslips, vehicleLookup],
  );
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    if (vehicleLeaderboard.length === 0) return;
    seededRef.current = true;
    setSelectedVehicleIds(vehicleLeaderboard.slice(0, 5).map((r) => r.vehicle_id));
  }, [vehicleLeaderboard]);

  const milesPerRoute = vehicleTotals.totalRoutes > 0
    ? Math.round(vehicleTotals.totalMiles / vehicleTotals.totalRoutes)
    : 0;
  const topVehicle = vehicleLeaderboard[0];

  // Calculate quick stats
  const totalOrders = orders.length;
  const pendingOrders = orders.filter(order => 
    !["delivered", "cancelled"].includes(order.status)
  ).length;
  const deliveredOrders = orders.filter(order => order.status === "delivered").length;
  const cancelledOrders = orders.filter(order => order.status === "cancelled").length;
  
  // Calculate analytics data
  const orderStatusData = getOrderStatusAnalytics(orders);
  // orderTimeData removed — Orders Created chart now computes its own series
  const customerTypeData = getCustomerTypeAnalytics(orders);
  const topCustomersData = getTopCustomersAnalytics(orders);
  const partExchangeData = getPartExchangeAnalytics(orders);
  const paymentRequiredData = getPaymentRequiredAnalytics(orders);
  const bikeBrandData = getBikeBrandAnalytics(orders);
  
  // Calculate timing analytics
  const collectionTimeData = getCollectionTimeAnalytics(orders);
  const deliveryTimeData = getDeliveryTimeAnalytics(orders);
  const storageData = getStorageAnalytics(orders);

  // Get only B2B customers for business tab
  const b2bCustomers = getAllCustomersAnalytics(orders).filter(customer => customer.isB2B);

  return (
    <Layout>
      <div className="container px-2 sm:px-4 py-4 sm:py-6 mx-auto max-w-7xl">
        <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-8">Order Analytics</h1>
        
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
            <p className="text-sm text-destructive">Error loading analytics data. Please try again later.</p>
          </div>
        ) : (
          <>
            {/* Quick Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-8">
              <StatsCard
                title="Total Orders"
                value={totalOrders}
                icon={Package}
              />
              <StatsCard
                title="Pending Orders"
                value={pendingOrders}
                icon={Truck}
              />
              <StatsCard
                title="Delivered Orders"
                value={deliveredOrders}
                icon={CalendarLucide}
              />
              <StatsCard
                title="Cancelled Orders"
                value={cancelledOrders}
                icon={Bike}
              />
            </div>
            
            <Tabs 
              defaultValue="overview" 
              value={activeTab}
              onValueChange={setActiveTab}
              className="mb-4 sm:mb-8"
            >
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1 h-auto mb-4 sm:mb-8">
                <TabsTrigger value="overview" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-2">
                  <BarChart className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Overview</span>
                  <span className="sm:hidden">Over</span>
                </TabsTrigger>
                <TabsTrigger value="customers" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-2">
                  <PieChart className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Customers</span>
                  <span className="sm:hidden">Cust</span>
                </TabsTrigger>
                <TabsTrigger value="business" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-2">
                  <LineChart className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Business</span>
                  <span className="sm:hidden">Biz</span>
                </TabsTrigger>
                <TabsTrigger value="products" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-2">
                  <Bike className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Products</span>
                  <span className="sm:hidden">Prod</span>
                </TabsTrigger>
                <TabsTrigger value="performance" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-2">
                  <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Performance</span>
                  <span className="sm:hidden">Perf</span>
                </TabsTrigger>
                <TabsTrigger value="inspections" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-2">
                  <ClipboardCheck className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Inspections</span>
                  <span className="sm:hidden">Insp</span>
                </TabsTrigger>
                <TabsTrigger value="vehicles" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-2 col-span-2 sm:col-span-1">
                  <Truck className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Vehicles</span>
                  <span className="sm:hidden">Veh</span>
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-8">
                <h2 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-4">Order Overview</h2>
                <section>
                  <h3 className="text-base font-semibold mb-3">Order Status</h3>
                  <OrderStatusChart data={orderStatusData} />
                </section>
                <Separator />
                <section>
                  <h3 className="text-base font-semibold mb-3">Orders Created</h3>
                  <OrdersCreatedChart orders={orders} />
                </section>
                <Separator />
                <section>
                  <h3 className="text-base font-semibold mb-3">Orders Completed</h3>
                  <OrdersCompletedChart orders={orders} />
                </section>
              </TabsContent>
              
              <TabsContent value="customers" className="space-y-2 sm:space-y-4">
                <h2 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-4">Customer Analysis</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4">
                  <CustomerTypeChart data={customerTypeData} title="B2B vs B2C Orders" />
                  <CustomerTypeChart data={partExchangeData} title="Part Exchange Orders" />
                </div>
                <div className="grid grid-cols-1 gap-2 sm:gap-4">
                  <TopCustomersChart data={topCustomersData} />
                </div>
              </TabsContent>
              
              <TabsContent value="business" className="space-y-2 sm:space-y-4">
                <h2 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-4">Business Customer Analysis</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4">
                  <CustomerTypeChart data={customerTypeData} title="B2B vs B2C Distribution" />
                  <CustomerTypeChart data={paymentRequiredData} title="Payment Required on Delivery" />
                </div>
                <div className="grid grid-cols-1 gap-2 sm:gap-4">
                  <B2BLeaderboard customers={b2bCustomers} orders={orders} />
                </div>
              </TabsContent>
              
              <TabsContent value="products" className="space-y-2 sm:space-y-4">
                <h2 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-4">Bike & Product Analysis</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4">
                  <BikeBrandsChart data={bikeBrandData} />
                  <div className="grid grid-cols-1 gap-2 sm:gap-4">
                    <CustomerTypeChart data={partExchangeData} title="Bike Swap Orders" />
                    <CustomerTypeChart data={paymentRequiredData} title="Payment Required Orders" />
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="performance" className="space-y-2 sm:space-y-4">
                <h2 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-4">Performance & Timing Analytics</h2>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
                  <StatsCard
                    title="Avg Collection Time"
                    value={`${collectionTimeData.averageTimeToCollect.toFixed(1)}h`}
                    description="From order creation to collection"
                    icon={Clock}
                  />
                  <StatsCard
                    title="Collection SLA"
                    value={`${collectionTimeData.collectionSLA.toFixed(0)}%`}
                    description="Within 24 hours"
                    icon={CheckCircle2}
                  />
                  <StatsCard
                    title="Avg Delivery Time"
                    value={`${deliveryTimeData.averageCollectionToDelivery.toFixed(1)}h`}
                    description="From collection to delivery"
                    icon={Truck}
                  />
                  <StatsCard
                    title="Delivery SLA"
                    value={`${deliveryTimeData.deliverySLA.toFixed(0)}%`}
                    description="Within 48 hours"
                    icon={Target}
                  />
                  <StatsCard
                    title="Bikes in Storage"
                    value={storageData.currentInStorage}
                    description="Currently stored"
                    icon={Warehouse}
                  />
                  <StatsCard
                    title="Avg Storage Duration"
                    value={`${storageData.averageDaysInStorage.toFixed(1)} days`}
                    description="Average time in storage"
                    icon={Timer}
                  />
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4 mb-2 sm:mb-4">
                  <CollectionTimeChart data={collectionTimeData} />
                  <DeliveryTimeChart data={deliveryTimeData} />
                </div>
                
                <div className="grid grid-cols-1 gap-2 sm:gap-4">
                  <StorageAnalyticsChart data={storageData} />
                </div>
              </TabsContent>

              <TabsContent value="inspections" className="space-y-2 sm:space-y-4">
                <h2 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-4">Inspections</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
                  <StatsCard
                    title="% With Issues"
                    value={`${inspectionsWithIssues.percentage.toFixed(0)}%`}
                    description={`${inspectionsWithIssues.withIssues} of ${inspectionsWithIssues.total} inspections`}
                    icon={AlertTriangle}
                  />
                  <StatsCard
                    title="Avg Repair Cost"
                    value={`£${avgRepairCost.average.toFixed(2)}`}
                    description={`Across ${avgRepairCost.sampleSize} repaired inspections`}
                    icon={PoundSterling}
                  />
                  <StatsCard
                    title="Avg Bike Value"
                    value={`£${avgBikeValue.average.toFixed(2)}`}
                    description={`Across ${avgBikeValue.sampleSize} bikes`}
                    icon={Bike}
                  />
                  <StatsCard
                    title="Issues Approved"
                    value={`${issueApproval.percentage.toFixed(0)}%`}
                    description={`${issueApproval.approved} of ${issueApproval.responded} responded`}
                    icon={ThumbsUp}
                  />
                </div>
                <div className="grid grid-cols-1 gap-2 sm:gap-4">
                  <InspectionsOverTimeChart data={inspectionsOverTime} />
                  <InspectionStageDurationsChart data={stageDurations} />
                </div>
              </TabsContent>

              <TabsContent value="vehicles" className="space-y-2 sm:space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2 sm:mb-4">
                  <h2 className="text-lg sm:text-xl font-semibold">Vehicles & Routes</h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant={vehicleRange && Math.round((new Date(vehicleRange.end).getTime() - new Date(vehicleRange.start).getTime()) / (7 * 86400000)) === 4 ? "default" : "outline"} onClick={() => setVehicleRange(weeksAgoRange(4))}>4w</Button>
                      <Button size="sm" variant={vehicleRange && Math.round((new Date(vehicleRange.end).getTime() - new Date(vehicleRange.start).getTime()) / (7 * 86400000)) === 8 ? "default" : "outline"} onClick={() => setVehicleRange(weeksAgoRange(8))}>8w</Button>
                      <Button size="sm" variant={vehicleRange && Math.round((new Date(vehicleRange.end).getTime() - new Date(vehicleRange.start).getTime()) / (7 * 86400000)) === 12 ? "default" : "outline"} onClick={() => setVehicleRange(weeksAgoRange(12))}>12w</Button>
                      <Button size="sm" variant={!vehicleRange ? "default" : "outline"} onClick={() => setVehicleRange(undefined)}>All</Button>
                    </div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button size="sm" variant="outline" className={cn("justify-start text-left font-normal", !vehicleRange && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {vehicleRange?.start ? format(new Date(vehicleRange.start), "dd MMM yy") : "Start"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                          mode="single"
                          selected={vehicleRange?.start ? new Date(vehicleRange.start) : undefined}
                          onSelect={(d) => d && setVehicleRange((r) => ({ start: format(d, "yyyy-MM-dd"), end: r?.end ?? format(new Date(), "yyyy-MM-dd") }))}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button size="sm" variant="outline" className={cn("justify-start text-left font-normal", !vehicleRange && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {vehicleRange?.end ? format(new Date(vehicleRange.end), "dd MMM yy") : "End"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                          mode="single"
                          selected={vehicleRange?.end ? new Date(vehicleRange.end) : undefined}
                          onSelect={(d) => d && setVehicleRange((r) => ({ start: r?.start ?? format(new Date(), "yyyy-MM-dd"), end: format(d, "yyyy-MM-dd") }))}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4 mb-4 sm:mb-6">
                  <StatsCard
                    title="Total Miles"
                    value={vehicleTotals.totalMiles.toLocaleString()}
                    description={`Avg ${vehicleTotals.avgMilesPerWeek.toLocaleString()} miles/week`}
                    icon={Truck}
                  />
                  <StatsCard
                    title="Total Routes"
                    value={vehicleTotals.totalRoutes.toLocaleString()}
                    description={`Avg ${vehicleTotals.avgRoutesPerWeek} routes/week`}
                    icon={Route}
                  />
                  <StatsCard
                    title="Avg Drivers / Week"
                    value={vehicleTotals.avgDriversPerWeek}
                    description="Unique drivers active per week"
                    icon={Users}
                  />
                  <StatsCard
                    title="Miles / Route"
                    value={milesPerRoute.toLocaleString()}
                    description="Average miles per completed route"
                    icon={Route}
                  />
                  <StatsCard
                    title="Most-Used Vehicle"
                    value={topVehicle?.registration ?? "—"}
                    description={topVehicle ? `${topVehicle.miles.toLocaleString()} mi · ${topVehicle.routes} routes` : "No data"}
                    icon={Truck}
                  />
                </div>
                <div className="grid grid-cols-1 gap-2 sm:gap-4">
                  <WeeklyVehicleStatsChart data={weeklyVehicleStats} />
                  <VehicleMileageChart
                    rows={vehicleTimeslips}
                    vehicles={vehiclesList}
                    selectedIds={selectedVehicleIds}
                    onSelectedIdsChange={setSelectedVehicleIds}
                  />
                  <VehicleLeaderboardCard rows={vehicleLeaderboard} />
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </Layout>
  );
};

export default AnalyticsPage;
