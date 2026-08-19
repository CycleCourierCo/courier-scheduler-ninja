import React, { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Order } from "@/types/order";

interface BoxBuyerDetailsProps {
  order: Order;
  onRefresh?: () => Promise<void>;
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * The buyer a Box My Bike order is ultimately going to. The order's receiver is
 * our depot, so this is who gets the boxing / courier-collected updates.
 */
const BoxBuyerDetails: React.FC<BoxBuyerDetailsProps> = ({ order, onRefresh }) => {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [buyer, setBuyer] = useState({
    name: order.boxBuyer?.name || "",
    email: order.boxBuyer?.email || "",
    phone: order.boxBuyer?.phone || "",
  });

  const startEdit = () => {
    setBuyer({
      name: order.boxBuyer?.name || "",
      email: order.boxBuyer?.email || "",
      phone: order.boxBuyer?.phone || "",
    });
    setEditing(true);
  };

  const save = async () => {
    if (!buyer.name.trim()) {
      toast.error("Buyer name is required");
      return;
    }
    if (!EMAIL_REGEX.test(buyer.email.trim())) {
      toast.error("A valid buyer email is required");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          box_buyer: {
            name: buyer.name.trim(),
            email: buyer.email.trim(),
            phone: buyer.phone.trim(),
          },
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", order.id);
      if (error) throw error;
      toast.success("Buyer details updated");
      setEditing(false);
      if (onRefresh) await onRefresh();
    } catch (err: any) {
      console.error("Failed to save box buyer", err);
      toast.error(err?.message || "Failed to save buyer details");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="rounded-md border p-3 space-y-3">
        <div className="text-sm font-medium">Buyer details</div>
        <div className="space-y-1">
          <Label htmlFor="buyer-name">Name</Label>
          <Input
            id="buyer-name"
            value={buyer.name}
            onChange={(e) => setBuyer({ ...buyer, name: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="buyer-email">Email</Label>
          <Input
            id="buyer-email"
            type="email"
            value={buyer.email}
            onChange={(e) => setBuyer({ ...buyer, email: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="buyer-phone">Phone</Label>
          <Input
            id="buyer-phone"
            value={buyer.phone}
            onChange={(e) => setBuyer({ ...buyer, phone: e.target.value })}
          />
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium">Buyer details</div>
        <Button size="sm" variant="outline" onClick={startEdit} className="gap-1">
          <Pencil className="h-3.5 w-3.5" /> {order.boxBuyer?.email ? "Edit" : "Add"}
        </Button>
      </div>
      {order.boxBuyer?.email ? (
        <div className="text-sm space-y-0.5 break-words">
          <p>{order.boxBuyer.name}</p>
          <p className="text-muted-foreground">{order.boxBuyer.email}</p>
          {order.boxBuyer.phone && (
            <p className="text-muted-foreground">{order.boxBuyer.phone}</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No buyer stored — add one so they receive boxing and courier collection updates.
        </p>
      )}
    </div>
  );
};

export default BoxBuyerDetails;
