
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Calendar, Truck, Package, User, Phone, Mail, MapPin, Printer, Wrench } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";
import { getOrderById } from "@/services/orderService";
import { Order } from "@/types/order";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import StatusBadge from "@/components/StatusBadge";
import Layout from "@/components/Layout";
import { pollOrderUpdates } from '@/services/orderService';
import TrackingTimeline from "@/components/order-detail/TrackingTimeline";
import { formatTimeslotWindow } from "@/utils/timeslotUtils";
import { generateSingleOrderLabel } from "@/utils/labelUtils";

// Enhanced safe format function to better handle invalid dates
const safeFormat = (date: Date | string | null | undefined, formatStr: string): string => {
  if (!date) return "Not scheduled";
  
  try {
    // Check for empty strings and return early
    if (typeof date === 'string' && date.trim() === '') {
      return "Not scheduled";
    }
    
    // Parse the date object carefully
    let dateObj: Date;
    
    if (typeof date === 'string') {
      // Try to parse the date string, handling ISO format specifically
      try {
        // For ISO strings, use parseISO which is more reliable
        if (date.includes('T') || date.includes('-')) {
          dateObj = parseISO(date);
        } else {
          dateObj = new Date(date);
        }
      } catch (parseError) {
        console.warn("Failed to parse date string in CustomerOrderDetail:", date, parseError);
        return "Invalid date format";
      }
    } else {
      dateObj = date as Date;
    }
    
    // Validate the date object more thoroughly
    if (!dateObj || !(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
      console.warn("Invalid date detected in CustomerOrderDetail:", date);
      return "Invalid date";
    }
    
    // Additional safety check for invalid time values
    try {
      // This will throw if the date is invalid for toISOString
      dateObj.toISOString();
      // For date display, create a new date in UTC to avoid timezone conversion
      const utcDate = new Date(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate());
      return format(utcDate, formatStr);
    } catch (timeError) {
      console.error("Invalid time value in date object:", dateObj, timeError);
      return "Invalid time";
    }
  } catch (error) {
    console.error("Error formatting date in CustomerOrderDetail:", error, date);
    return "Date format error";
  }
};

const CustomerOrderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      const cleanup = pollOrderUpdates(order.id, (updatedOrder) => {
        setOrder(updatedOrder);
      }, 5000); // Poll every 5 seconds
      
      return cleanup;
    }
  }, [order?.id]);

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
    return safeFormat(date, "PPP");
  };

  const formatDates = (dates: Date | Date[] | undefined) => {
    if (!dates) return "Not scheduled";
    
    if (Array.isArray(dates)) {
      return dates
        .filter(date => date && !isNaN(new Date(date).getTime()))
        .map(date => {
          try {
            return safeFormat(date, "PPP");
          } catch (err) {
            console.error("Error formatting date in array:", err, date);
            return "Invalid date";
          }
        })
        .filter(Boolean)
        .join(", ") || "Not scheduled";
    }
    
    return safeFormat(dates, "PPP");
  };

  const itemName = `${order.bikeBrand || ""}`.trim();

  return (
    <Layout>
      <div className="container mx-auto px-4 py-4 sm:py-8 max-w-6xl">
        <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
          <div className="flex items-center space-x-4">
            <Button variant="outline" asChild size="sm">
              <Link to="/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Back</span>
                <span className="sm:hidden">Back</span>
              </Link>
            </Button>
            <h1 className="text-xl sm:text-2xl font-bold">Order Details</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateSingleOrderLabel(order)}
              className="flex-1 sm:flex-none"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print Label
            </Button>
            <div className="flex-1 sm:flex-none">
              <StatusBadge status={order.status} />
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Package className="mr-2" />
              {order.bikeBrand} {order.bikeModel}
            </CardTitle>
            <CardDescription>
              Created on {safeFormat(order.createdAt, "PPP")}
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
                  <h3 className="font-semibold">Scheduled Pickup Date</h3>
                </div>
                
                {(order.scheduledPickupDate || order.status === 'collected') ? (
                  <div className="bg-green-50 p-2 rounded-md border border-green-200">
                    <div className="flex items-center">
                      <p className="font-medium">
                        {order.scheduledPickupDate 
                          ? safeFormat(order.scheduledPickupDate, "PPP")
                          : "Collection completed"}
                      </p>
                    </div>
                    {order.pickupTimeslot && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Time: {formatTimeslotWindow(order.pickupTimeslot)}
                      </p>
                    )}
                  </div>
                ) : (
                  <p>{formatDates(order.pickupDate)}</p>
                )}
                
                <div className="flex items-center space-x-2">
                  <Calendar className="text-courier-600" />
                  <h3 className="font-semibold">Scheduled Delivery Date</h3>
                </div>
                
                {order.scheduledDeliveryDate ? (
                  <div className="bg-green-50 p-2 rounded-md border border-green-200">
                    <div className="flex items-center">
                      <p className="font-medium">
                        {safeFormat(order.scheduledDeliveryDate, "PPP")}
                      </p>
                    </div>
                    {order.deliveryTimeslot && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Time: {formatTimeslotWindow(order.deliveryTimeslot)}
                      </p>
                    )}
                  </div>
                ) : (
                  <p>{formatDates(order.deliveryDate)}</p>
                )}
              </div>
              
              <div className="space-y-4">
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
                    {order.needsInspection && (
                      <p className="text-amber-600 font-medium mt-2 flex items-center gap-2">
                        <Wrench className="h-4 w-4" />
                        Bike will be inspected and serviced
                      </p>
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
      </div>
    </Layout>
  );
};

export default CustomerOrderDetail;
