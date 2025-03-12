
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Truck, Search, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import Layout from "@/components/Layout";
import StatusBadge from "@/components/StatusBadge";
import { getOrders, resendSenderAvailabilityEmail } from "@/services/orderService";
import { Order } from "@/types/order";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const Dashboard = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [resendingEmail, setResendingEmail] = useState<string | null>(null);
  
  const { data: orders = [], isLoading, error, refetch } = useQuery({
    queryKey: ["orders"],
    queryFn: getOrders,
  });

  const handleResendEmail = async (orderId: string) => {
    setResendingEmail(orderId);
    try {
      await resendSenderAvailabilityEmail(orderId);
      await refetch();
    } finally {
      setResendingEmail(null);
    }
  };

  const filteredOrders = orders.filter((order: Order) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      order.id.toLowerCase().includes(searchLower) ||
      order.sender.name.toLowerCase().includes(searchLower) ||
      order.receiver.name.toLowerCase().includes(searchLower) ||
      order.status.toLowerCase().includes(searchLower)
    );
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-3xl font-bold text-courier-800">Order Dashboard</h1>
          <Link to="/create-order">
            <Button className="bg-courier-600 hover:bg-courier-700">
              <Truck className="mr-2 h-4 w-4" />
              Create New Order
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Orders</CardTitle>
            <CardDescription>
              Manage and monitor all your courier orders from a single dashboard.
            </CardDescription>
            <div className="relative mt-4">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search orders..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-4">
                <p>Loading orders...</p>
              </div>
            ) : error ? (
              <div className="flex justify-center p-4 text-red-500">
                <p>Error loading orders. Please try again.</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-8">
                <Truck className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-4 text-lg font-medium">No orders found</h3>
                <p className="mt-2 text-gray-500">
                  {searchTerm
                    ? "No orders match your search criteria"
                    : "Create your first order to get started"}
                </p>
                {!searchTerm && (
                  <Link to="/create-order">
                    <Button className="mt-4 bg-courier-600 hover:bg-courier-700">
                      Create New Order
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Sender</TableHead>
                      <TableHead>Receiver</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Tracking</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order: Order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.id.substring(0, 8)}</TableCell>
                        <TableCell>{order.sender.name}</TableCell>
                        <TableCell>{order.receiver.name}</TableCell>
                        <TableCell>
                          <StatusBadge status={order.status} />
                        </TableCell>
                        <TableCell>
                          {format(new Date(order.createdAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          {order.trackingNumber ? order.trackingNumber : "-"}
                        </TableCell>
                        <TableCell>
                          {order.status === 'sender_availability_pending' && (
                            <Button 
                              size="sm"
                              variant="outline"
                              onClick={() => handleResendEmail(order.id)}
                              disabled={resendingEmail === order.id}
                            >
                              <Send className="mr-1 h-3 w-3" />
                              {resendingEmail === order.id ? 'Sending...' : 'Resend Email'}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
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

export default Dashboard;
