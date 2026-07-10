import React, { useState } from "react";
import { Package, FileText, Wrench, Receipt, Pencil } from "lucide-react";
import { Order } from "@/types/order";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { enableInspectionForOrder, createInspectionServiceInvoice } from "@/services/inspectionService";
import { updateOrderBikes } from "@/services/orderService";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getGroupedBikes } from "@/utils/bikeSummary";
import { hasRole } from "@/lib/roles";

interface ItemDetailsProps {
  order: Order;
  onRefresh?: () => Promise<void>;
}


const ItemDetails: React.FC<ItemDetailsProps> = ({ order, onRefresh }) => {
  const { userProfile } = useAuth();
  const isAdmin = hasRole(userProfile, 'admin');
  const [isEnablingInspection, setIsEnablingInspection] = useState(false);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [savingBikes, setSavingBikes] = useState(false);
  const computeBikesFromOrder = React.useCallback(() => {
    if (order.bikes && order.bikes.length) {
      return order.bikes.map((b) => ({
        brand: b.brand || "",
        model: b.model || "",
        type: b.type || "",
        value: (b as any).value,
      }));
    }
    return [{
      brand: order.bikeBrand || "",
      model: order.bikeModel || "",
      type: order.bikeType || "",
    }];
  }, [order]);
  const [editBikes, setEditBikes] = useState(computeBikesFromOrder);

  const openEdit = () => {
    setEditBikes(computeBikesFromOrder());
    setEditOpen(true);
  };

  const handleSaveBikes = async () => {
    if (!order.id) return;
    setSavingBikes(true);
    const ok = await updateOrderBikes(order.id, editBikes);
    setSavingBikes(false);
    if (!ok) {
      toast.error("Failed to update bikes");
      return;
    }
    toast.success("Bikes updated");
    setEditOpen(false);
    if (onRefresh) await onRefresh();
  };


  const quantity = order.bikeQuantity || 1;
  const groupedBikes = getGroupedBikes(order);


  const handleEnableInspection = async () => {
    if (!order.id) return;
    
    try {
      setIsEnablingInspection(true);
      await enableInspectionForOrder(order.id);
      if (onRefresh) {
        await onRefresh();
      }
      toast.success("Inspection enabled for this order");
    } catch (error) {
      console.error("Error enabling inspection:", error);
      toast.error("Failed to enable inspection");
    } finally {
      setIsEnablingInspection(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Package className="text-courier-600" />
          <h3 className="font-semibold">Item Details</h3>
        </div>
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={openEdit} className="gap-1">
            <Pencil className="h-3.5 w-3.5" /> Edit Bikes
          </Button>

        )}
      </div>

      <div className="bg-muted p-3 rounded-md">
        <p><span className="font-medium">Total Quantity:</span> {quantity}</p>
        
        <div className="mt-2 space-y-1">
          {groupedBikes.map((group, idx) => (
            <div key={idx} className="text-small">
              <span className="font-medium">{group.quantity}×</span> {group.label}
              {group.value && <> — £{group.value}</>}
            </div>
          ))}
        </div>

        {order.customerOrderNumber && (
          <p className="mt-2"><span className="font-medium">Order #:</span> {order.customerOrderNumber}</p>
        )}
        {order.isBikeSwap && (
          <p className="text-courier-600 font-medium mt-2">This is a bike swap</p>
        )}
        {order.needsPaymentOnCollection && (
          <p className="text-courier-600 font-medium">Payment required on collection</p>
        )}
        {order.needsInspection && (
          <div className="flex items-center gap-2 text-amber-600 font-medium mt-2">
            <Wrench className="h-4 w-4" />
            Bike will be inspected and serviced
          </div>
        )}
        {isAdmin && !order.needsInspection && (
          <Button
            onClick={handleEnableInspection}
            disabled={isEnablingInspection}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 mt-3"
          >
            <Wrench className="h-4 w-4" />
            {isEnablingInspection ? "Enabling..." : "Inspect and Service"}
          </Button>
        )}
        {isAdmin && order.needsInspection && order.id && (
          <Button
            onClick={async () => {
              try {
                setIsCreatingInvoice(true);
                const result = await createInspectionServiceInvoice(order.id);
                toast.success(`Inspection invoice created: ${result.invoiceNumber}`, {
                  action: result.invoiceUrl
                    ? { label: "Open", onClick: () => window.open(result.invoiceUrl, "_blank") }
                    : undefined,
                });
              } catch (error: any) {
                console.error("Error creating inspection invoice:", error);
                toast.error(error?.message || "Failed to create inspection invoice");
              } finally {
                setIsCreatingInvoice(false);
              }
            }}
            disabled={isCreatingInvoice}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 mt-3"
          >
            <Receipt className="h-4 w-4" />
            {isCreatingInvoice ? "Creating..." : "Create Inspection Invoice"}
          </Button>
        )}
      </div>
      
      {order.deliveryInstructions && (
        <div className="mt-4">
          <div className="flex items-center space-x-2 mb-2">
            <FileText className="text-courier-600" />
            <h3 className="font-semibold">Delivery Instructions</h3>
          </div>
          <div className="bg-muted p-3 rounded-md">
            <p className="whitespace-pre-line">{order.deliveryInstructions}</p>
          </div>
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Bikes</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {editBikes.map((b, idx) => (
              <div key={idx} className="border rounded-md p-3 space-y-2">
                <div className="text-small font-medium">Bike {idx + 1}{b.type ? ` — ${b.type}` : ""}</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor={`brand-${idx}`}>Brand</Label>
                    <Input
                      id={`brand-${idx}`}
                      value={b.brand}
                      onChange={(e) => {
                        const next = [...editBikes];
                        next[idx] = { ...next[idx], brand: e.target.value };
                        setEditBikes(next);
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`model-${idx}`}>Model</Label>
                    <Input
                      id={`model-${idx}`}
                      value={b.model}
                      onChange={(e) => {
                        const next = [...editBikes];
                        next[idx] = { ...next[idx], model: e.target.value };
                        setEditBikes(next);
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={savingBikes}>
              Cancel
            </Button>
            <Button onClick={handleSaveBikes} disabled={savingBikes}>
              {savingBikes ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ItemDetails;

