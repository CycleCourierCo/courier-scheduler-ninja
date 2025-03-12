
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

const OrderDetail = () => {
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
                  <h3 className="font-semibold">Pickup Dates</h3>
                </div>
                <p>{formatDates(order.pickupDate)}</p>
                
                <div className="flex items-center space-x-2">
                  <Calendar className="text-courier-600" />
                  <h3 className="font-semibold">Delivery Dates</h3>
                </div>
                <p>{formatDates(order.deliveryDate)}</p>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Truck className="text-courier-600" />
                  <h3 className="font-semibold">Last Updated</h3>
                </div>
                <p>{format(new Date(order.updatedAt), "PPP 'at' p")}</p>
              </div>
            </div>
            
            <Separator className="my-6" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Sender Information */}
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
              
              {/* Receiver Information */}
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

export default OrderDetail;
