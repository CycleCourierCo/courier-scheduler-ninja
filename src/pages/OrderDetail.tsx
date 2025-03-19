import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getOrderById } from "@/services/orderService";
import { Order } from "@/types/order";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeftIcon } from "@radix-ui/react-icons";
import { toast } from "sonner";
import { createShipdayOrder } from "@/services/shipdayService";
import { useUser } from "@/hooks/useUser";
import { ShipdayWebhookTest } from "@/components/ShipdayWebhookTest";

const OrderDetail: React.FC = () => {
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { id } = useParams<{ id: string }>();
  const { user, userRole } = useUser();

  useEffect(() => {
    const fetchOrder = async () => {
      if (id) {
        try {
          const orderData = await getOrderById(id);
          setOrder(orderData);
        } catch (error) {
          console.error("Error fetching order:", error);
          toast.error("Failed to fetch order details.");
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchOrder();
  }, [id]);

  const handleCreateShipdayOrder = async () => {
    if (order?.id) {
      try {
        setIsLoading(true);
        await createShipdayOrder(order.id);
      } catch (error) {
        console.error("Error creating Shipday order:", error);
        toast.error("Failed to create Shipday order.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  if (isLoading) {
    return <div>Loading order details...</div>;
  }

  if (!order) {
    return <div>Order not found</div>;
  }

  const statusColors: { [key: string]: string } = {
    created: "bg-gray-100 text-gray-800",
    scheduled: "bg-blue-100 text-blue-800",
    shipped: "bg-yellow-100 text-yellow-800",
    delivered: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    receiver_availability_pending: "bg-purple-100 text-purple-800",
    receiver_availability_confirmed: "bg-pink-100 text-pink-800",
  };

  return (
    <div className="container mx-auto mt-8">
      <Link to="/orders" className="inline-flex items-center mb-4">
        <ArrowLeftIcon className="mr-2 h-4 w-4" />
        Back to Orders
      </Link>

      <section className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-2xl font-semibold mb-4">Order Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <strong>Order ID:</strong> {order.id}
          </div>
          <div>
            <strong>Status:</strong>{" "}
            <Badge className={statusColors[order.status] || "bg-gray-500"}>
              {order.status}
            </Badge>
          </div>
          <div>
            <strong>Created At:</strong> {order.createdAt.toLocaleString()}
          </div>
          <div>
            <strong>Updated At:</strong> {order.updatedAt.toLocaleString()}
          </div>
          {order.trackingNumber && (
            <div>
              <strong>Tracking Number:</strong> {order.trackingNumber}
            </div>
          )}
        </div>
      </section>

      <section className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-xl font-semibold mb-4">Sender Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <strong>Name:</strong> {order.sender.name}
          </div>
          <div>
            <strong>Email:</strong> {order.sender.email}
          </div>
          <div>
            <strong>Phone:</strong> {order.sender.phone}
          </div>
          <div>
            <strong>Address:</strong> {order.sender.address.street}, {order.sender.address.city},{" "}
            {order.sender.address.state} {order.sender.address.zipCode}
          </div>
        </div>
      </section>

      <section className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-xl font-semibold mb-4">Receiver Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <strong>Name:</strong> {order.receiver.name}
          </div>
          <div>
            <strong>Email:</strong> {order.receiver.email}
          </div>
          <div>
            <strong>Phone:</strong> {order.receiver.phone}
          </div>
          <div>
            <strong>Address:</strong> {order.receiver.address.street}, {order.receiver.address.city},{" "}
            {order.receiver.address.state} {order.receiver.address.zipCode}
          </div>
        </div>
      </section>

      <section className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-xl font-semibold mb-4">Bike Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <strong>Brand:</strong> {order.bikeBrand}
          </div>
          <div>
            <strong>Model:</strong> {order.bikeModel}
          </div>
          <div>
            <strong>Customer Order Number:</strong> {order.customerOrderNumber}
          </div>
          <div>
            <strong>Needs Payment on Collection:</strong> {order.needsPaymentOnCollection ? "Yes" : "No"}
          </div>
          <div>
            <strong>Is Bike Swap:</strong> {order.isBikeSwap ? "Yes" : "No"}
          </div>
          <div>
            <strong>Delivery Instructions:</strong> {order.deliveryInstructions}
          </div>
        </div>
      </section>

      {order.trackingEvents && order.trackingEvents.length > 0 && (
        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-xl font-semibold mb-4">Tracking Events</h3>
          <Table>
            <TableCaption>A list of tracking events for this order.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Leg Type</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.trackingEvents.map((event, index) => (
                <TableRow key={index}>
                  <TableCell>{new Date(event.timestamp).toLocaleString()}</TableCell>
                  <TableCell>{event.shipdayEvent}</TableCell>
                  <TableCell>{event.shipdayStatus}</TableCell>
                  <TableCell>{event.legType}</TableCell>
                  <TableCell>
                    {event.details && (
                      <ul>
                        {event.details.carrier && (
                          <li>
                            Carrier: {event.details.carrier.name} ({event.details.carrier.phone})
                          </li>
                        )}
                        {event.details.eta && <li>ETA: {new Date(event.details.eta).toLocaleString()}</li>}
                        {event.details.pickedUpTime && (
                          <li>Picked Up Time: {new Date(event.details.pickedUpTime).toLocaleString()}</li>
                        )}
                        {event.details.deliveryTime && (
                          <li>Delivery Time: {new Date(event.details.deliveryTime).toLocaleString()}</li>
                        )}
                      </ul>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      {userRole === "admin" && order.status === "scheduled" && (
        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-xl font-semibold mb-4">Actions</h3>
          <Button onClick={handleCreateShipdayOrder} disabled={isLoading}>
            {isLoading ? "Creating Shipday Order..." : "Create Shipday Order"}
          </Button>
        </section>
      )}
    
    {/* Add the webhook test component */}
    {order && order.status === "shipped" && userRole === "admin" && (
      <section className="bg-white rounded-lg shadow p-6 mb-6">
        <ShipdayWebhookTest orderId={order.id} />
      </section>
    )}
    
    </div>
  );
};

export default OrderDetail;
