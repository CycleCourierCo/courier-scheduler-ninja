import React, { useState, useEffect } from "react";
import * as Sentry from "@sentry/react";
import { toast } from "sonner";
import { Plus, Trash2, Edit, Warehouse, Package } from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import {
  getWarehouseStock,
  addWarehouseStock,
  removeWarehouseStock,
  checkLocationConflict,
  getCustomerList,
} from "@/services/warehouseStockService";
import type { WarehouseStock, WarehouseStockFormData } from "@/types/warehouseStock";
import { format } from "date-fns";

const BAYS = ["A", "B", "C", "D"];
const POSITIONS = Array.from({ length: 20 }, (_, i) => i + 1);

const statusColors: Record<string, string> = {
  stored: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  reserved: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  dispatched: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  returned: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const emptyForm: WarehouseStockFormData = {
  user_id: "",
  bike_brand: "",
  bike_model: "",
  bike_type: "",
  bike_value: "",
  item_notes: "",
  bay: "A",
  position: 1,
};

const WarehouseStockPage: React.FC = () => {
  const { user } = useAuth();
  const [stock, setStock] = useState<WarehouseStock[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<WarehouseStockFormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCustomer, setFilterCustomer] = useState<string>("all");

  const fetchData = async () => {
    try {
      setLoading(true);
      const [stockData, customerData] = await Promise.all([
        getWarehouseStock(),
        getCustomerList(),
      ]);
      setStock(stockData);
      setCustomers(customerData);
    } catch (err) {
      Sentry.captureException(err);
      toast.error("Failed to load warehouse stock");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async () => {
    if (!formData.user_id) {
      toast.error("Please select a customer");
      return;
    }
    if (!formData.bay || !formData.position) {
      toast.error("Please select a storage location");
      return;
    }

    setSubmitting(true);
    try {
      const conflict = await checkLocationConflict(formData.bay, formData.position);
      if (conflict) {
        toast.error(`Bay ${formData.bay} Position ${formData.position} is already occupied`);
        setSubmitting(false);
        return;
      }

      await addWarehouseStock(formData, user?.id || "");
      toast.success("Stock added successfully");
      setDialogOpen(false);
      setFormData(emptyForm);
      fetchData();
    } catch (err) {
      Sentry.captureException(err);
      toast.error("Failed to add stock");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this stock item?")) return;
    try {
      await removeWarehouseStock(id);
      toast.success("Stock removed");
      fetchData();
    } catch (err) {
      Sentry.captureException(err);
      toast.error("Failed to remove stock");
    }
  };

  const filtered = stock.filter((item) => {
    if (filterStatus !== "all" && item.status !== filterStatus) return false;
    if (filterCustomer !== "all" && item.user_id !== filterCustomer) return false;
    return true;
  });

  const storedCount = stock.filter((s) => s.status === "stored").length;
  const reservedCount = stock.filter((s) => s.status === "reserved").length;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Warehouse className="h-6 w-6" />
              Warehouse Stock
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage customer inventory stored at the depot
            </p>
          </div>
          <Button onClick={() => { setFormData(emptyForm); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Add Stock
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold">{stock.length}</div>
              <div className="text-xs text-muted-foreground">Total Items</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-green-600">{storedCount}</div>
              <div className="text-xs text-muted-foreground">Stored</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-yellow-600">{reservedCount}</div>
              <div className="text-xs text-muted-foreground">Reserved</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold">{new Set(stock.filter(s => s.status === 'stored').map(s => s.user_id)).size}</div>
              <div className="text-xs text-muted-foreground">Customers</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="stored">Stored</SelectItem>
              <SelectItem value="reserved">Reserved</SelectItem>
              <SelectItem value="dispatched">Dispatched</SelectItem>
              <SelectItem value="returned">Returned</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterCustomer} onValueChange={setFilterCustomer}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Customer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Customers</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.company_name || c.name || c.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No stock items found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Deposited</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.customer_name}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {[item.bike_brand, item.bike_model].filter(Boolean).join(" ") || "—"}
                      </div>
                      {item.bike_type && (
                        <div className="text-xs text-muted-foreground">{item.bike_type}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        Bay {item.bay} · Pos {item.position}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[item.status] || ""}`}>
                        {item.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(item.deposited_at), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(item.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Add Stock Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Stock Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Customer *</Label>
              <Select value={formData.user_id} onValueChange={(v) => setFormData({ ...formData, user_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.company_name || c.name || c.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Bike Brand</Label>
                <Input
                  value={formData.bike_brand}
                  onChange={(e) => setFormData({ ...formData, bike_brand: e.target.value })}
                  placeholder="e.g. Trek"
                />
              </div>
              <div>
                <Label>Bike Model</Label>
                <Input
                  value={formData.bike_model}
                  onChange={(e) => setFormData({ ...formData, bike_model: e.target.value })}
                  placeholder="e.g. Domane"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Bike Type</Label>
                <Select value={formData.bike_type} onValueChange={(v) => setFormData({ ...formData, bike_type: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Road">Road</SelectItem>
                    <SelectItem value="Mountain">Mountain</SelectItem>
                    <SelectItem value="Hybrid">Hybrid</SelectItem>
                    <SelectItem value="Electric">Electric</SelectItem>
                    <SelectItem value="Gravel">Gravel</SelectItem>
                    <SelectItem value="BMX">BMX</SelectItem>
                    <SelectItem value="Folding">Folding</SelectItem>
                    <SelectItem value="Kids">Kids</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Value (£)</Label>
                <Input
                  type="number"
                  value={formData.bike_value}
                  onChange={(e) => setFormData({ ...formData, bike_value: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Bay *</Label>
                <Select value={formData.bay} onValueChange={(v) => setFormData({ ...formData, bay: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BAYS.map((b) => (
                      <SelectItem key={b} value={b}>Bay {b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Position *</Label>
                <Select
                  value={String(formData.position)}
                  onValueChange={(v) => setFormData({ ...formData, position: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POSITIONS.map((p) => (
                      <SelectItem key={p} value={String(p)}>Position {p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.item_notes}
                onChange={(e) => setFormData({ ...formData, item_notes: e.target.value })}
                placeholder="Any notes about this item..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Adding..." : "Add Stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default WarehouseStockPage;
