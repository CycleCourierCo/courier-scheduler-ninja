
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  fetchOrdersForAnalytics, 
  getOrderStatusAnalytics,
  getOrderTimeAnalytics,
  getCustomerTypeAnalytics,
  getTopCustomersAnalytics,
  getPartExchangeAnalytics,
  getPaymentRequiredAnalytics,
  getBikeBrandAnalytics,
  getCollectionTimeAnalytics,
  getDeliveryTimeAnalytics,
  getStorageAnalytics
} from "@/services/analyticsService";
import OrderStatusChart from "@/components/analytics/OrderStatusChart";
import OrderTimeChart from "@/components/analytics/OrderTimeChart";
import CustomerTypeChart from "@/components/analytics/CustomerTypeChart";
import TopCustomersChart from "@/components/analytics/TopCustomersChart";
import BikeBrandsChart from "@/components/analytics/BikeBrandsChart";
import CollectionTimeChart from "@/components/analytics/CollectionTimeChart";
import DeliveryTimeChart from "@/components/analytics/DeliveryTimeChart";
import StorageAnalyticsChart from "@/components/analytics/StorageAnalyticsChart";
import StatsCard from "@/components/analytics/StatsCard";
import { Bike, Calendar, Package, Truck, BarChart, PieChart, LineChart, Clock, CheckCircle2, Target, Warehouse, Timer } from "lucide-react";

const AnalyticsPage = () => {
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch orders for analytics
  const { data: orders = [], isLoading, error } = useQuery({
    queryKey: ["ordersAnalytics"],
    queryFn: fetchOrdersForAnalytics
  });

  // Calculate quick stats
  const totalOrders = orders.length;
  const pendingOrders = orders.filter(order => 
    !["delivered", "cancelled"].includes(order.status)
  ).length;
  const deliveredOrders = orders.filter(order => order.status === "delivered").length;
  const cancelledOrders = orders.filter(order => order.status === "cancelled").length;
  
  // Calculate analytics data
  const orderStatusData = getOrderStatusAnalytics(orders);
  const orderTimeData = getOrderTimeAnalytics(orders);
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
  const b2bCustomers = topCustomersData.filter(customer => customer.isB2B);

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
                icon={Calendar}
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
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1 h-auto mb-4 sm:mb-8">
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
                <TabsTrigger value="performance" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-2 col-span-2 sm:col-span-1">
                  <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Performance</span>
                  <span className="sm:hidden">Perf</span>
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-2 sm:space-y-4">
                <h2 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-4">Order Overview</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4">
                  <OrderStatusChart data={orderStatusData} />
                  <OrderTimeChart data={orderTimeData} />
                </div>
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
                  <TopCustomersChart data={b2bCustomers} />
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
            </Tabs>
          </>
        )}
      </div>
    </Layout>
  );
};

export default AnalyticsPage;
