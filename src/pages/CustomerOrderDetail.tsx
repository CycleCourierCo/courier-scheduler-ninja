
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Calendar, Truck, Package, User, Phone, Mail, MapPin } from "lucide-react";
import { format } from "date-fns";
import { getOrderById } from "@/services/orderService";
import { Order } from "@/types/order";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import StatusBadge from "@/components/StatusBadge";
import Layout from "@/components/Layout";
import { pollOrderUpdates } from '@/services/orderService';
import TrackingTimeline from "@/components/order-detail/TrackingTimeline";
import JobSchedulingForm from "@/components/scheduling/JobSchedulingForm";

const CustomerOrderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPickupForm, setShowPickupForm] = useState(false);
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);

  useEffect(() => {
    const fetchOrderDetails = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        const fetchedOrder = await getOrderById(id);
        
        if (fetchedOrder) {
          setOrder(fetchedOrder);
        } else {
          setError("Order not found");
        }
      } catch (err) {
        console.error("Error fetching order:", err);
        setError("Failed to load order details");
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetails();
  }, [id]);

  useEffect(() => {
    if (order?.id) {
      // Set up polling for updates
      const cleanup = pollOrderUpdates(order.id, (updatedOrder) => {
        setOrder(updatedOrder);
      }, 5000); // Poll every 5 seconds
      
      return cleanup;
    }
  }, [order?.id]);

  const handleScheduled = () => {
    // Hide scheduling forms and refresh order data
    setShowPickupForm(false);
    setShowDeliveryForm(false);
    if (id) {
      getOrderById(id).then(updatedOrder => {
        if (updatedOrder) setOrder(updatedOrder);
      });
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-courier-600"></div>
        </div>
      </Layout>
    );
  }

  if (error || !order) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <h2 className="text-xl font-semibold text-red-600">{error || "Order not found"}</h2>
          <Button asChild>
            <Link to="/dashboard">
              <ArrowLeft className="mr-2" />
              Return to Dashboard
            </Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const formatDate = (date: Date | undefined) => {
    if (!date) return "Not scheduled";
    return format(new Date(date), "PPP");
  };

  const formatDates = (dates: Date | Date[] | undefined) => {
    if (!dates) return "Not scheduled";
    
    if (Array.isArray(dates)) {
      return dates.map(date => format(new Date(date), "PPP")).join(", ");
    }
    
    return format(new Date(dates), "PPP");
  };

  const itemName = `${order.bikeBrand || ""}`.trim();

  // Check if pickup is ready to be scheduled
  const canSchedulePickup = order.status !== 'collection_scheduled' && 
                          order.status !== 'driver_to_collection' && 
                          order.status !== 'collected';

  // Determine if delivery can be scheduled (only after pickup is done)
  const canScheduleDelivery = (order.status === 'collected') && !order.scheduledDeliveryDate;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <Button variant="outline" asChild>
              <Link to="/dashboard">
                <ArrowLeft className="mr-2" />
                Back
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">Order Details</h1>
          </div>
          <StatusBadge status={order.status} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Package className="mr-2" />
              {order.bikeBrand} {order.bikeModel}
            </CardTitle>
            <CardDescription>
              Created on {format(new Date(order.createdAt), "PPP")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-3 rounded-md flex flex-col gap-2">
              <p className="font-medium">Tracking Number: {order.trackingNumber || "Not assigned"}</p>
              {order.customerOrderNumber && (
                <p className="font-medium">Customer Order Number: {order.customerOrderNumber}</p>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Calendar className="text-courier-600" />
                  <h3 className="font-semibold">Pickup Date</h3>
                </div>
                
                {order.scheduledPickupDate ? (
                  <div className="bg-green-50 p-2 rounded-md border border-green-200">
                    <div className="flex items-center">
                      <p className="font-medium">
                        {format(new Date(order.scheduledPickupDate), "PPP")}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p>{formatDates(order.pickupDate)}</p>
                    {canSchedulePickup && (
                      <div className="mt-2">
                        {showPickupForm ? (
                          <JobSchedulingForm 
                            orderId={order.id} 
                            type="pickup"
                            onScheduled={handleScheduled}
                            compact={true}
                          />
                        ) : (
                          <Button 
                            onClick={() => setShowPickupForm(true)}
                            size="sm"
                            className="mt-2"
                          >
                            Schedule Collection
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                <div className="flex items-center space-x-2">
                  <Calendar className="text-courier-600" />
                  <h3 className="font-semibold">Delivery Date</h3>
                </div>
                
                {order.scheduledDeliveryDate ? (
                  <div className="bg-green-50 p-2 rounded-md border border-green-200">
                    <div className="flex items-center">
                      <p className="font-medium">
                        {format(new Date(order.scheduledDeliveryDate), "PPP")}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p>{formatDates(order.deliveryDate)}</p>
                    {canScheduleDelivery && (
                      <div className="mt-2">
                        {showDeliveryForm ? (
                          <JobSchedulingForm 
                            orderId={order.id} 
                            type="delivery"
                            onScheduled={handleScheduled}
                            compact={true}
                          />
                        ) : (
                          <Button 
                            onClick={() => setShowDeliveryForm(true)}
                            size="sm"
                            className="mt-2"
                            disabled={!canScheduleDelivery}
                          >
                            Schedule Delivery
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                {/* Replace the custom tracking details with the TrackingTimeline component */}
                <TrackingTimeline order={order} />
                
                <div className="mt-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <h3 className="font-semibold">Item Details</h3>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p><span className="font-medium">Item:</span> {order.bikeBrand} {order.bikeModel}</p>
                    <p><span className="font-medium">Quantity:</span> 1</p>
                    {order.customerOrderNumber && (
                      <p><span className="font-medium">Customer Order #:</span> {order.customerOrderNumber}</p>
                    )}
                    {order.isBikeSwap && (
                      <p className="text-courier-600 font-medium mt-2">This is a bike swap</p>
                    )}
                    {order.needsPaymentOnCollection && (
                      <p className="text-courier-600 font-medium">Payment required on collection</p>
                    )}
                  </div>
                </div>
                
                {order.deliveryInstructions && (
                  <div className="mt-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="font-semibold">Delivery Instructions</h3>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-md">
                      <p>{order.deliveryInstructions}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <Separator className="my-6" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <User className="text-courier-600" />
                  <h3 className="font-semibold text-lg">Sender Information</h3>
                </div>
                <div className="bg-gray-50 p-4 rounded-md space-y-3">
                  <p className="font-medium text-gray-800">{order.sender.name}</p>
                  <div className="space-y-2">
                    <div className="flex items-start space-x-2">
                      <Mail className="h-4 w-4 mt-1 text-gray-500" />
                      <p>{order.sender.email}</p>
                    </div>
                    <div className="flex items-start space-x-2">
                      <Phone className="h-4 w-4 mt-1 text-gray-500" />
                      <p>{order.sender.phone}</p>
                    </div>
                    <div className="flex items-start space-x-2">
                      <MapPin className="h-4 w-4 mt-1 text-gray-500" />
                      <div>
                        <p>{order.sender.address.street}</p>
                        <p>{order.sender.address.city}, {order.sender.address.state} {order.sender.address.zipCode}</p>
                        <p>{order.sender.address.country}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <User className="text-courier-600" />
                  <h3 className="font-semibold text-lg">Receiver Information</h3>
                </div>
                <div className="bg-gray-50 p-4 rounded-md space-y-3">
                  <p className="font-medium text-gray-800">{order.receiver.name}</p>
                  <div className="space-y-2">
                    <div className="flex items-start space-x-2">
                      <Mail className="h-4 w-4 mt-1 text-gray-500" />
                      <p>{order.receiver.email}</p>
                    </div>
                    <div className="flex items-start space-x-2">
                      <Phone className="h-4 w-4 mt-1 text-gray-500" />
                      <p>{order.receiver.phone}</p>
                    </div>
                    <div className="flex items-start space-x-2">
                      <MapPin className="h-4 w-4 mt-1 text-gray-500" />
                      <div>
                        <p>{order.receiver.address.street}</p>
                        <p>{order.receiver.address.city}, {order.receiver.address.state} {order.receiver.address.zipCode}</p>
                        <p>{order.receiver.address.country}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button asChild>
              <Link to="/dashboard">
                <ArrowLeft className="mr-2" />
                Return to Dashboard
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </Layout>
  );
};

export default CustomerOrderDetail;
