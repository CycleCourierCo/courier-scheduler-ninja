import React, { useState } from "react";
import { Code2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Order } from "@/types/order";

interface AdminTrackingEditorProps {
  order: Order;
  onUpdate: () => void;
}

const AdminTrackingEditor: React.FC<AdminTrackingEditorProps> = ({ order, onUpdate }) => {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [trackingJson, setTrackingJson] = useState(
    JSON.stringify(order.trackingEvents || [], null, 2)
  );

  const openDialog = () => {
    setTrackingJson(JSON.stringify(order.trackingEvents || [], null, 2));
    setOpen(true);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      // Validate JSON
      let parsedJson;
      try {
        parsedJson = JSON.parse(trackingJson);
      } catch (e) {
        toast.error("Invalid JSON format. Please check your syntax.");
        return;
      }

      const { error } = await supabase
        .from('orders')
        .update({ tracking_events: parsedJson })
        .eq('id', order.id);

      if (error) throw error;

      toast.success("Tracking events updated successfully");
      setOpen(false);
      onUpdate();
    } catch (error) {
      console.error("Error updating tracking events:", error);
      toast.error("Failed to update tracking events");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={openDialog} className="gap-1">
        <Code2 className="h-3.5 w-3.5" />
        Edit tracking JSON
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tracking Events (JSON)</DialogTitle>
            <DialogDescription>
              Edit the raw tracking events for this order. Must be a valid JSON array.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="tracking-json" className="text-sm">
              Tracking events
            </Label>
            <Textarea
              id="tracking-json"
              value={trackingJson}
              onChange={(e) => setTrackingJson(e.target.value)}
              className="font-mono text-xs min-h-[320px]"
              placeholder='[{"status": "created", "timestamp": "2024-01-01T12:00:00Z"}]'
            />
            <p className="text-xs text-muted-foreground">
              Example: {`[{"status": "created", "timestamp": "2024-01-01T12:00:00Z", "message": "Order created"}]`}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminTrackingEditor;
