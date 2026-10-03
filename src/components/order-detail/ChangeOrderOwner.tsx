import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserCog, AlertTriangle } from "lucide-react";
import CustomerAccountPicker, { PickedAccount } from "@/components/orders/CustomerAccountPicker";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  orderId: string;
  currentOwnerId?: string | null;
  currentOwnerName?: string | null;
  bookedByName?: string | null;
  bookedById?: string | null;
  mayBeInvoiced: boolean;
  isAdmin: boolean;
  onChanged: () => void;
}

const ChangeOrderOwner: React.FC<Props> = ({
  orderId, currentOwnerId, currentOwnerName, bookedByName, bookedById, mayBeInvoiced, isAdmin, onChanged,
}) => {
  const { user, userProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<PickedAccount | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!picked || !user) return;
    if (picked.id === currentOwnerId) { toast.info("That account already owns this order"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("orders").update({ user_id: picked.id }).eq("id", orderId);
      if (error) throw error;
      const newName = picked.company_name || picked.name || picked.email || "account";
      await supabase.from("order_comments").insert({
        order_id: orderId,
        admin_id: user.id,
        admin_name: (userProfile as any)?.name || user.email || "Admin",
        comment: `Order owner changed from ${currentOwnerName || "previous account"} to ${newName}.`,
      });
      toast.success(`Order moved to ${newName}`);
      setOpen(false);
      setPicked(null);
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "Could not change the owner");
    } finally {
      setSaving(false);
    }
  };

  const showBookedBy = bookedByName && bookedById && bookedById !== currentOwnerId;
  if (!isAdmin && !showBookedBy) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
      {showBookedBy && <span>Booked by {bookedByName}</span>}
      {isAdmin && (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <UserCog className="mr-2 h-4 w-4" /> Change owner
        </Button>
      )}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setPicked(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change order owner</DialogTitle>
            <DialogDescription>
              Currently owned by {currentOwnerName || "unknown account"}. Choose the account this order should belong to.
            </DialogDescription>
          </DialogHeader>
          <CustomerAccountPicker value={picked} onChange={setPicked} />
          {mayBeInvoiced && (
            <div className="flex gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
              <span>This order may already have been invoiced. Existing invoices won't be changed.</span>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={!picked || saving}>
              {saving ? "Saving…" : "Confirm change"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChangeOrderOwner;
