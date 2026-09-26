import React, { useState, useEffect } from "react";
import * as Sentry from "@sentry/react";
import { toast } from "sonner";
import { notify } from "@/lib/notify";
import { Plus, Trash2, Edit, Warehouse, Package, PackagePlus } from "lucide-react";
import ReceiveStockDialog from "@/components/warehouse/ReceiveStockDialog";
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
  updateWarehouseStock,
  removeWarehouseStock,
  checkLocationConflict,
  getCustomerList,
} from "@/services/warehouseStockService";
import type { WarehouseStock, WarehouseStockFormData } from "@/types/warehouseStock";
import { format } from "date-fns";
import { useStorageBays } from "@/hooks/useStorageBays";
import { useSites, defaultSite, findSite, DEFAULT_SITE_CODE } from "@/hooks/useSites";
import { COMPONENT_CATEGORIES } from "@/constants/bikeComponents";

const statusColors: Record<string, string> = {
  stored: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  reserved: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  dispatched: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  returned: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const emptyForm: WarehouseStockFormData = {
  user_id: "",
  item_kind: "bike",
  component_category: "",
  quantity: 1,
  spec: "",
  frame_size: "",
  bike_brand: "",
  bike_model: "",
  bike_type: "",
  bike_value: "",
  sku: "",
  item_notes: "",
  bay: "",
  position: 1,
};

const WarehouseStockPage: React.FC = () => {
  const { user } = useAuth();
  const { data: sites = [] } = useSites();
  // Warehouse stock is held at Birmingham only for now.
  const activeSiteId = findSite(sites, DEFAULT_SITE_CODE)?.id ?? defaultSite(sites)?.id ?? null;
  const { bays } = useStorageBays(false, activeSiteId);
  const [stock, setStock] = useState<WarehouseStock[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WarehouseStock | null>(null);
  const [formData, setFormData] = useState<WarehouseStockFormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCustomer, setFilterCustomer] = useState<string>("all");
  const [receiveItem, setReceiveItem] = useState<WarehouseStock | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [stockData, customerData] = await Promise.all([
        getWarehouseStock(activeSiteId),
        getCustomerList(),
      ]);
      setStock(stockData);
      setCustomers(customerData);
    } catch (err) {
      Sentry.captureException(err);
      toast.error("Couldn't load warehouse stock right now. Refresh the page to try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSiteId]);

  const handleSubmit = async () => {
    if (!formData.user_id) {
      toast.error("Pick which customer this item belongs to before saving.");
      return;
    }
    if (formData.item_kind === "component" && !formData.component_category) {
      toast.error("Choose a component category so it can be picked for a build.");
      return;
    }
    if (!formData.bay || !formData.position) {
      toast.error("Choose a bay and position so warehouse staff can find it.");
      return;
    }

    setSubmitting(true);
    try {
      // Several parts can share a shelf, so only whole bikes need a unique slot.
      // When editing, ignore the item's own current slot so it can be saved in place.
      const conflict = formData.item_kind === "component"
        ? false
        : await checkLocationConflict(formData.bay, formData.position, editingItem?.id, activeSiteId);
      if (conflict) {
        toast.error(`Bay ${formData.bay} Position ${formData.position} is already occupied`);
        setSubmitting(false);
        return;
      }

      if (editingItem) {
        await updateWarehouseStock(editingItem.id, {
          user_id: formData.user_id,
          item_kind: formData.item_kind || "bike",
          component_category: formData.item_kind === "component" ? formData.component_category || null : null,
          quantity: formData.quantity && formData.quantity > 0 ? formData.quantity : 1,
          spec: formData.spec || null,
          frame_size: formData.frame_size?.trim() || null,
          bike_brand: formData.bike_brand || null,
          bike_model: formData.bike_model || null,
          bike_type: formData.bike_type || null,
          bike_value: formData.bike_value || null,
          sku: formData.sku || null,
          item_notes: formData.item_notes || null,
          bay: formData.bay,
          position: formData.position,
        } as any);
        toast.success("Stock updated");
      } else {
        await addWarehouseStock({ ...formData, site_id: activeSiteId }, user?.id || "");
        toast.success("Stock added successfully");
      }
      setDialogOpen(false);
      setEditingItem(null);
      setFormData(emptyForm);
      fetchData();
    } catch (err) {
      Sentry.captureException(err);
      toast.error(editingItem
        ? "Couldn't save the changes. Check the details and try again."
        : "Couldn't add the bike to stock. Check the details and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (item: WarehouseStock) => {
    setEditingItem(item);
    setFormData({
      user_id: item.user_id,
      item_kind: (item.item_kind as any) || "bike",
      component_category: item.component_category || "",
      quantity: item.quantity || 1,
      spec: item.spec || "",
      frame_size: item.frame_size || "",
      bike_brand: item.bike_brand || "",
      bike_model: item.bike_model || "",
      bike_type: item.bike_type || "",
      bike_value: item.bike_value != null ? String(item.bike_value) : "",
      sku: item.sku || "",
      item_notes: item.item_notes || "",
      bay: item.bay || "",
      position: item.position || 1,
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    notify.confirm({
      title: "Remove this stock item?",
      confirmLabel: "Remove",
      destructive: true,
      onConfirm: async () => {
        try {
          await removeWarehouseStock(id);
          toast.success("Stock removed");
          fetchData();
        } catch (err) {
          Sentry.captureException(err);
          toast.error("Couldn't remove this bike. Refresh and try again.");
        }
      },
    });
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
          <Button onClick={() => { setEditingItem(null); setFormData(emptyForm); setDialogOpen(true); }}>
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
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.customer_name}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm flex items-center gap-2">
                        {[item.bike_brand, item.bike_model].filter(Boolean).join(" ") || item.component_category || "—"}
                        {item.item_kind === "component" && (
                          <Badge variant="secondary" className="text-[10px]">Part</Badge>
                        )}
                        {item.item_kind === "component" && Number(item.quantity || 0) === 0 && (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            Out of stock
                          </Badge>
                        )}
                      </div>
                      {item.item_kind === "component" ? (
                        <div className="text-xs text-muted-foreground">
                          {[item.component_category, item.frame_size ? `Size ${item.frame_size}` : null, item.spec, item.quantity > 1 ? `x${item.quantity}` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      ) : (
                        (item.bike_type || item.frame_size) && (
                          <div className="text-xs text-muted-foreground">
                            {[item.bike_type, item.frame_size ? `Size ${item.frame_size}` : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        )
                      )}
                      {item.sku && (
                        <div className="text-xs text-muted-foreground">SKU: <code className="bg-muted px-1 rounded">{item.sku}</code></div>
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
                      {item.item_kind === "component" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Receive stock"
                          onClick={() => setReceiveItem(item)}
                        >
                          <PackagePlus className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Edit item"
                        onClick={() => openEdit(item)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
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

      {/* Add / Edit Stock Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) { setEditingItem(null); setFormData(emptyForm); }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Stock Item" : "Add Stock Item"}</DialogTitle>
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
                <Label>Item type *</Label>
                <Select
                  value={formData.item_kind ?? "bike"}
                  onValueChange={(v) => setFormData({ ...formData, item_kind: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bike">Complete bike</SelectItem>
                    <SelectItem value="component">Component / part</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.item_kind === "component" && (
                <div>
                  <Label>Component category *</Label>
                  <Select
                    value={formData.component_category ?? ""}
                    onValueChange={(v) => setFormData({ ...formData, component_category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {COMPONENT_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{formData.item_kind === "component" ? "Brand" : "Bike Brand"}</Label>
                <Input
                  value={formData.bike_brand}
                  onChange={(e) => setFormData({ ...formData, bike_brand: e.target.value })}
                  placeholder={formData.item_kind === "component" ? "e.g. Shimano" : "e.g. Trek"}
                />
              </div>
              <div>
                <Label>{formData.item_kind === "component" ? "Model" : "Bike Model"}</Label>
                <Input
                  value={formData.bike_model}
                  onChange={(e) => setFormData({ ...formData, bike_model: e.target.value })}
                  placeholder={formData.item_kind === "component" ? "e.g. Ultegra R8000" : "e.g. Domane"}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {formData.item_kind === "component" ? (
                <div>
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.quantity ?? 1}
                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                  />
                </div>
              ) : (
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
              )}
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

            {(formData.item_kind === "bike" || formData.component_category === "Frame") && (
              <div>
                <Label>Frame size</Label>
                <Input
                  value={formData.frame_size ?? ""}
                  onChange={(e) => setFormData({ ...formData, frame_size: e.target.value })}
                  placeholder="e.g. M or 54cm"
                />
              </div>
            )}

            {formData.item_kind === "component" && (
              <div>
                <Label>Spec / size</Label>
                <Input
                  value={formData.spec ?? ""}
                  onChange={(e) => setFormData({ ...formData, spec: e.target.value })}
                  placeholder="e.g. 56cm, 11-speed, 700c"
                />
              </div>
            )}

            <div>
              <Label>SKU</Label>
              <Input
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="Match this exactly to your Shopify variant SKU"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Required for Shopify auto-dispatch
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Bay *</Label>
                <Select value={formData.bay} onValueChange={(v) => setFormData({ ...formData, bay: v, position: 1 })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select bay" />
                  </SelectTrigger>
                  <SelectContent>
                    {bays.map((b) => (
                      <SelectItem key={b.id} value={b.label}>Bay {b.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Position *</Label>
                <Select
                  value={String(formData.position)}
                  onValueChange={(v) => setFormData({ ...formData, position: parseInt(v) })}
                  disabled={!formData.bay}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const selected = bays.find((b) => b.label === formData.bay);
                      const count = selected?.position_count ?? 0;
                      return Array.from({ length: count }, (_, i) => i + 1).map((p) => (
                        <SelectItem key={p} value={String(p)}>Position {p}</SelectItem>
                      ));
                    })()}
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
              {submitting ? "Saving..." : editingItem ? "Save changes" : "Add Stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ReceiveStockDialog
        open={!!receiveItem}
        onOpenChange={(open) => { if (!open) setReceiveItem(null); }}
        item={receiveItem}
        siteId={activeSiteId}
        onReceived={fetchData}
      />
    </Layout>
  );
};

export default WarehouseStockPage;
