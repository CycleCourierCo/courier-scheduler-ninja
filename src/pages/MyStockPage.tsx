import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Package, Truck, Clock, ExternalLink } from "lucide-react";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { getMyWarehouseStock, requestDeliveryFromStock } from "@/services/warehouseStockService";
import type { WarehouseStock } from "@/types/warehouseStock";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";

const MyStockPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedItem, setSelectedItem] = useState<WarehouseStock | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiver, setReceiver] = useState({
    name: "",
    email: "",
    phone: "",
    street: "",
    city: "",
    state: "",
    zipCode: "",
    country: "United Kingdom",
  });

  const { data: stock = [], isLoading } = useQuery({
    queryKey: ["my-warehouse-stock", user?.id],
    queryFn: () => getMyWarehouseStock(user!.id),
    enabled: !!user?.id,
  });

  const storedItems = stock.filter((s) => s.status === "stored");
  const reservedItems = stock.filter((s) => s.status === "reserved");

  const handleRequestDelivery = async () => {
    if (!selectedItem || !user) return;
    if (!receiver.name || !receiver.street || !receiver.zipCode) {
      toast.error("Please fill in receiver name, address and postcode");
      return;
    }

    setIsSubmitting(true);
    try {
      const orderId = await requestDeliveryFromStock(selectedItem, receiver, user.id);
      toast.success("Delivery requested! Order created.");
      queryClient.invalidateQueries({ queryKey: ["my-warehouse-stock"] });
      setSelectedItem(null);
      setReceiver({ name: "", email: "", phone: "", street: "", city: "", state: "", zipCode: "", country: "United Kingdom" });
    } catch (err: any) {
      toast.error(err.message || "Failed to request delivery");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">My Stock</h1>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Package className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{storedItems.length}</p>
                <p className="text-sm text-muted-foreground">Stored</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Truck className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{reservedItems.length}</p>
                <p className="text-sm text-muted-foreground">Reserved for Delivery</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading your stock...</p>
        ) : stock.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-lg font-medium">No stock stored</p>
              <p className="text-sm text-muted-foreground">Items deposited at the warehouse will appear here.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stock.map((item) => (
              <Card key={item.id} className="relative">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">
                      {[item.bike_brand, item.bike_model].filter(Boolean).join(" ") || "Item"}
                    </CardTitle>
                    <Badge variant={item.status === "stored" ? "default" : "secondary"}>
                      {item.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {item.bike_type && (
                    <p className="text-sm text-muted-foreground">Type: {item.bike_type}</p>
                  )}
                  {item.bike_value && (
                    <p className="text-sm text-muted-foreground">Value: £{item.bike_value}</p>
                  )}
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Stored {formatDistanceToNow(new Date(item.deposited_at), { addSuffix: true })}
                  </p>
                  {item.item_notes && (
                    <p className="text-sm text-muted-foreground italic">{item.item_notes}</p>
                  )}

                  {item.status === "stored" && (
                    <Button
                      className="w-full mt-2"
                      size="sm"
                      onClick={() => setSelectedItem(item)}
                    >
                      <Truck className="mr-2 h-4 w-4" />
                      Request Delivery
                    </Button>
                  )}

                  {item.status === "reserved" && item.linked_order_id && (
                    <Button variant="outline" size="sm" className="w-full mt-2" asChild>
                      <Link to={`/customer-orders/${item.linked_order_id}`}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        View Order
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Request Delivery Dialog */}
        <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Delivery</DialogTitle>
              <DialogDescription>
                {selectedItem && (
                  <>Deliver: {[selectedItem.bike_brand, selectedItem.bike_model].filter(Boolean).join(" ") || "Item"}</>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div>
                <Label htmlFor="recv-name">Receiver Name *</Label>
                <Input id="recv-name" value={receiver.name} onChange={(e) => setReceiver({ ...receiver, name: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="recv-email">Email</Label>
                <Input id="recv-email" type="email" value={receiver.email} onChange={(e) => setReceiver({ ...receiver, email: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="recv-phone">Phone</Label>
                <Input id="recv-phone" value={receiver.phone} onChange={(e) => setReceiver({ ...receiver, phone: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="recv-street">Address *</Label>
                <Input id="recv-street" value={receiver.street} onChange={(e) => setReceiver({ ...receiver, street: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="recv-city">City</Label>
                  <Input id="recv-city" value={receiver.city} onChange={(e) => setReceiver({ ...receiver, city: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="recv-zip">Postcode *</Label>
                  <Input id="recv-zip" value={receiver.zipCode} onChange={(e) => setReceiver({ ...receiver, zipCode: e.target.value })} />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedItem(null)}>Cancel</Button>
              <Button onClick={handleRequestDelivery} disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Request Delivery"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default MyStockPage;
