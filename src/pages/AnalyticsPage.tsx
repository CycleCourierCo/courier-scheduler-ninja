
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
      <div className="container px-4 py-6 md:px-6 mx-auto">
        <h1 className="text-3xl font-bold mb-8">Order Analytics</h1>
        
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <p>Error loading analytics data. Please try again later.</p>
          </div>
        ) : (
          <>
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
              className="mb-8"
            >
              <TabsList className="grid w-full grid-cols-1 md:grid-cols-5 mb-8">
                <TabsTrigger value="overview" className="flex items-center gap-2">
                  <BarChart className="h-4 w-4" />
                  <span>Overview</span>
                </TabsTrigger>
                <TabsTrigger value="customers" className="flex items-center gap-2">
                  <PieChart className="h-4 w-4" />
                  <span>Customers</span>
                </TabsTrigger>
                <TabsTrigger value="business" className="flex items-center gap-2">
                  <LineChart className="h-4 w-4" />
                  <span>Business</span>
                </TabsTrigger>
                <TabsTrigger value="products" className="flex items-center gap-2">
                  <Bike className="h-4 w-4" />
                  <span>Products</span>
                </TabsTrigger>
                <TabsTrigger value="performance" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Performance</span>
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div className="col-span-full">
                    <h2 className="text-xl font-semibold mb-4">Order Overview</h2>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <OrderStatusChart data={orderStatusData} />
                  <OrderTimeChart data={orderTimeData} />
                </div>
              </TabsContent>
              
              <TabsContent value="customers" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div className="col-span-full">
                    <h2 className="text-xl font-semibold mb-4">Customer Analysis</h2>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <CustomerTypeChart data={customerTypeData} title="B2B vs B2C Orders" />
                  </div>
                  <div className="md:col-span-2">
                    <CustomerTypeChart data={partExchangeData} title="Part Exchange Orders" />
                  </div>
                  <div className="md:col-span-4">
                    <TopCustomersChart data={topCustomersData} />
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="business" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div className="col-span-full">
                    <h2 className="text-xl font-semibold mb-4">Business Customer Analysis</h2>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <CustomerTypeChart data={customerTypeData} title="B2B vs B2C Distribution" />
                  </div>
                  <div className="md:col-span-2">
                    <CustomerTypeChart data={paymentRequiredData} title="Payment Required on Delivery" />
                  </div>
                  <div className="md:col-span-4">
                    <TopCustomersChart data={b2bCustomers} />
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="products" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div className="col-span-full">
                    <h2 className="text-xl font-semibold mb-4">Bike & Product Analysis</h2>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="col-span-2 lg:col-span-1">
                    <BikeBrandsChart data={bikeBrandData} />
                  </div>
                  <div className="col-span-2 lg:col-span-1">
                    <div className="grid grid-cols-1 gap-4">
                      <CustomerTypeChart data={partExchangeData} title="Bike Swap Orders" />
                      <CustomerTypeChart data={paymentRequiredData} title="Payment Required Orders" />
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="performance" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div className="col-span-full">
                    <h2 className="text-xl font-semibold mb-4">Performance & Timing Analytics</h2>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
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
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <CollectionTimeChart data={collectionTimeData} />
                  <DeliveryTimeChart data={deliveryTimeData} />
                </div>
                
                <div className="grid grid-cols-1 gap-4">
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
