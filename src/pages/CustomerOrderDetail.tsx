
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Calendar, Truck, Package, User, Phone, Mail, MapPin, Check, Clock, ClipboardEdit } from "lucide-react";
import { format } from "date-fns";
import { getOrderById } from "@/services/orderService";
import { Order } from "@/types/order";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import StatusBadge from "@/components/StatusBadge";
import Layout from "@/components/Layout";
import { toast } from "sonner";

// Define the interface for the tracking events
interface TrackingEvent {
  timestamp: string;
  shipdayEvent: string;
  shipdayStatus: string;
  legType: string;
  details: {
    carrier?: any;
    eta?: string | null;
    pickedUpTime?: string | null;
    deliveryTime?: string | null;
  };
}

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

  // Function to get human-readable event titles
  const getEventTitle = (shipdayEvent: string, legType: string): string => {
    switch (shipdayEvent) {
      case "ORDER_ASSIGNED":
        return `Courier Assigned (${legType})`;
      case "ORDER_ACCEPTED_AND_STARTED":
        return `Courier Started Journey (${legType})`;
      case "ORDER_PIKEDUP":
        return legType === "pickup" ? "Bike Collected from Sender" : "Bike Picked Up for Delivery";
      case "ORDER_ONTHEWAY":
        return `On the Way (${legType})`;
      case "ORDER_COMPLETED":
        return legType === "delivery" ? "Delivered to Recipient" : "Pickup Completed";
      case "ORDER_FAILED":
        return `Delivery Failed (${legType})`;
      case "ORDER_INCOMPLETE":
        return `Delivery Incomplete (${legType})`;
      default:
        return `${shipdayEvent.replace(/_/g, " ")} (${legType})`;
    }
  };

  // Helper to determine which status events to show in the tracking timeline
  const getTrackingEvents = () => {
    const events = [];
    
    // Order created
    events.push({
      title: "Order Created",
      date: order.createdAt,
      icon: <Package className="h-4 w-4 text-courier-600" />,
      description: "Your order has been created in our system"
    });
    
    // Check if sender availability is confirmed
    if (order.senderConfirmedAt) {
      events.push({
        title: "Collection Dates Chosen",
        date: order.senderConfirmedAt,
        icon: <ClipboardEdit className="h-4 w-4 text-courier-600" />,
        description: "Collection dates have been confirmed"
      });
    }
    
    // Check if receiver availability is confirmed
    if (order.receiverConfirmedAt) {
      events.push({
        title: "Delivery Dates Chosen",
        date: order.receiverConfirmedAt,
        icon: <ClipboardEdit className="h-4 w-4 text-courier-600" />,
        description: "Delivery dates have been confirmed"
      });
    }
    
    // Check if order is scheduled
    if (order.scheduledAt) {
      events.push({
        title: "Transport Scheduled",
        date: order.scheduledAt,
        icon: <Calendar className="h-4 w-4 text-courier-600" />,
        description: "Transport manager has scheduled your pickup and delivery"
      });
    }
    
    // Add Shipday tracking events if available
    if (order.trackingEvents && Array.isArray(order.trackingEvents)) {
      // Cast to the correct interface
      const shipdayEvents = order.trackingEvents as TrackingEvent[];
      
      shipdayEvents.forEach(event => {
        const title = getEventTitle(event.shipdayEvent, event.legType);
        
        events.push({
          title: title,
          date: new Date(event.timestamp),
          icon: <Truck className="h-4 w-4 text-courier-600" />,
          description: `Status: ${event.shipdayStatus.replace(/_/g, " ")}`,
          // Add carrier info if available
          carrier: event.details.carrier ? event.details.carrier.name : null
        });
      });
    } else {
      // If no Shipday events but order is shipped or delivered, add basic events
      if (order.status === 'shipped') {
        events.push({
          title: "In Transit",
          date: order.updatedAt,
          icon: <Truck className="h-4 w-4 text-courier-600" />,
          description: "Your bike is on its way"
        });
      }
      
      if (order.status === 'delivered') {
        events.push({
          title: "Delivered",
          date: order.updatedAt,
          icon: <Check className="h-4 w-4 text-green-600" />,
          description: "Your bike has been delivered"
        });
      }
    }
    
    // Sort events by date (newest first)
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const trackingEvents = getTrackingEvents();

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
              Order #{order.id.substring(0, 8)}
            </CardTitle>
            <CardDescription>
              Created on {format(new Date(order.createdAt), "PPP")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {order.trackingNumber && (
              <div className="bg-muted p-3 rounded-md">
                <p className="font-medium">Tracking Number: {order.trackingNumber}</p>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Calendar className="text-courier-600" />
                  <h3 className="font-semibold">Pickup Date</h3>
                </div>
                
                {order.scheduledPickupDate ? (
                  <div className="bg-green-50 p-2 rounded-md border border-green-200">
                    <div className="flex items-center">
                      <Check className="h-4 w-4 text-green-600 mr-2" />
                      <p className="font-medium">
                        {format(new Date(order.scheduledPickupDate), "PPP")}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p>{formatDates(order.pickupDate)}</p>
                )}
                
                <div className="flex items-center space-x-2">
                  <Calendar className="text-courier-600" />
                  <h3 className="font-semibold">Delivery Date</h3>
                </div>
                
                {order.scheduledDeliveryDate ? (
                  <div className="bg-green-50 p-2 rounded-md border border-green-200">
                    <div className="flex items-center">
                      <Check className="h-4 w-4 text-green-600 mr-2" />
                      <p className="font-medium">
                        {format(new Date(order.scheduledDeliveryDate), "PPP")}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p>{formatDates(order.deliveryDate)}</p>
                )}
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Truck className="text-courier-600" />
                  <h3 className="font-semibold">Tracking Details</h3>
                </div>
                
                {trackingEvents.length > 0 ? (
                  <div className="space-y-3">
                    {trackingEvents.map((event, index) => (
                      <div key={index} className="relative pl-6 pb-3">
                        {index < trackingEvents.length - 1 && (
                          <div className="absolute top-2 left-[7px] h-full w-0.5 bg-gray-200" />
                        )}
                        <div className="absolute top-1 left-0 rounded-full bg-white">
                          {event.icon}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{event.title}</p>
                          <p className="text-sm text-gray-500">
                            {format(new Date(event.date), "PPP 'at' p")}
                          </p>
                          <p className="text-sm">{event.description}</p>
                          {event.carrier && (
                            <p className="text-sm text-gray-600">Courier: {event.carrier}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 text-gray-500">
                    <Clock className="h-4 w-4" />
                    <p>Waiting for the first update</p>
                  </div>
                )}
                
                {/* Bike details section */}
                {(order.bikeBrand || order.bikeModel) && (
                  <div className="mt-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="font-semibold">Bike Details</h3>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-md">
                      {order.bikeBrand && <p><span className="font-medium">Brand:</span> {order.bikeBrand}</p>}
                      {order.bikeModel && <p><span className="font-medium">Model:</span> {order.bikeModel}</p>}
                      {order.customerOrderNumber && (
                        <p><span className="font-medium">Order #:</span> {order.customerOrderNumber}</p>
                      )}
                      {order.isBikeSwap && (
                        <p className="text-courier-600 font-medium">This is a bike swap</p>
                      )}
                      {order.needsPaymentOnCollection && (
                        <p className="text-courier-600 font-medium">Payment required on collection</p>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Delivery instructions */}
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
