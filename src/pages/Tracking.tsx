
import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Package, Search, Truck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublicOrder } from "@/services/fetchOrderService";
import { Order } from "@/types/order";
import TrackingTimeline from "@/components/order-detail/TrackingTimeline";
import ItemDetails from "@/components/order-detail/ItemDetails";

const Tracking = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [orderId, setOrderId] = useState(searchParams.get("id") || "");
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Check for order ID in query params when component mounts
  React.useEffect(() => {
    const id = searchParams.get("id");
    if (id) {
      setOrderId(id);
      handleTrackOrder(id);
    }
  }, [searchParams]);
  
  const handleTrackOrder = async (id: string = orderId) => {
    if (!id.trim()) {
      setError("Please enter an order ID");
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      console.log("Fetching order with ID:", id);
      const fetchedOrder = await getPublicOrder(id);
      
      if (fetchedOrder) {
        setOrder(fetchedOrder);
        // Update URL with order ID for easy sharing
        if (searchParams.get("id") !== id) {
          navigate(`/tracking?id=${id}`);
        }
      } else {
        setError("Order not found. Please check the ID and try again.");
        setOrder(null);
      }
    } catch (err) {
      console.error("Error fetching order:", err);
      setError("Failed to load tracking information. Please try again later.");
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleTrackOrder();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto py-4 px-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Truck className="h-6 w-6 text-courier-600" />
              <h1 className="text-xl font-bold text-gray-900">Order Tracking</h1>
            </div>
            <Button variant="outline" onClick={() => navigate("/")}>
              Home
            </Button>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto py-8 px-4">
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Track Your Order
            </CardTitle>
            <CardDescription>
              Enter your order ID to track the status of your shipment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Enter your order ID"
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    className="w-full"
                  />
                </div>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    "Searching..."
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" /> Track
                    </>
                  )}
                </Button>
              </div>
              
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md flex items-start">
                  <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}
            </form>
            
            {loading && (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-courier-600"></div>
              </div>
            )}
            
            {order && !loading && (
              <div className="mt-8 space-y-8">
                <div className="bg-green-50 border border-green-200 rounded-md p-4">
                  <h2 className="font-semibold text-lg mb-2">
                    Status: {order.status.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                  </h2>
                  <p>Order ID: {order.id}</p>
                  <p>Created: {new Date(order.createdAt).toLocaleDateString()}</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <TrackingTimeline order={order} />
                  <ItemDetails order={order} />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-200">
                  <div>
                    <h3 className="font-semibold mb-2">From</h3>
                    <p>{order.sender.name}</p>
                    <p>{order.sender.address.city}, {order.sender.address.state}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">To</h3>
                    <p>{order.receiver.name}</p>
                    <p>{order.receiver.address.city}, {order.receiver.address.state}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      
      <footer className="bg-gray-100 py-6">
        <div className="container mx-auto px-4 text-center text-gray-600">
          <p>© {new Date().getFullYear()} Cycle Courier. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Tracking;
