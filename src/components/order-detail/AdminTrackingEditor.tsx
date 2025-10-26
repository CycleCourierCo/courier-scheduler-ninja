import React, { useState } from "react";
import { Clock, Edit2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Order } from "@/types/order";

interface AdminTrackingEditorProps {
  order: Order;
  onUpdate: () => void;
}

const AdminTrackingEditor: React.FC<AdminTrackingEditorProps> = ({ order, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [trackingJson, setTrackingJson] = useState(
    JSON.stringify(order.trackingEvents || [], null, 2)
  );

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
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error("Error updating tracking events:", error);
      toast.error("Failed to update tracking events");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setTrackingJson(JSON.stringify(order.trackingEvents || [], null, 2));
    setIsEditing(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Clock className="text-courier-600" />
          <h3 className="font-semibold text-lg">Tracking Events (JSON)</h3>
        </div>
        {!isEditing ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
          >
            <Edit2 className="h-4 w-4 mr-2" />
            Edit Tracking
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isSaving}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        )}
      </div>
      
      <div className="bg-gray-50 p-4 rounded-md">
        {isEditing ? (
          <div>
            <Label htmlFor="tracking-json" className="text-sm mb-2 block">
              Edit tracking events JSON
            </Label>
            <Textarea
              id="tracking-json"
              value={trackingJson}
              onChange={(e) => setTrackingJson(e.target.value)}
              className="font-mono text-sm min-h-[300px]"
              placeholder='[{"status": "created", "timestamp": "2024-01-01T12:00:00Z"}]'
            />
            <p className="text-xs text-muted-foreground mt-2">
              Enter valid JSON array. Example: {`[{"status": "created", "timestamp": "2024-01-01T12:00:00Z", "message": "Order created"}]`}
            </p>
          </div>
        ) : (
          <pre className="font-mono text-sm overflow-x-auto whitespace-pre-wrap">
            {trackingJson}
          </pre>
        )}
      </div>
    </div>
  );
};

export default AdminTrackingEditor;
