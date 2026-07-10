import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface SelectedJob {
  orderId: string;
  type: 'pickup' | 'delivery' | 'break';
  address: string;
  contactName: string;
  phoneNumber: string;
  order: number;
  estimatedTime?: string;
  actualTime?: string;
  lat?: number;
  lon?: number;
  breakDuration?: number;
  breakType?: 'lunch' | 'stop';
}

interface SaveRouteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobs: SelectedJob[];
  startTime: string;
  startingBikes: number;
  onSaved: (routeId: string, routeName: string) => void;
}

const SaveRouteDialog: React.FC<SaveRouteDialogProps> = ({
  open,
  onOpenChange,
  jobs,
  startTime,
  startingBikes,
  onSaved
}) => {
  const [routeName, setRouteName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [generatedId] = useState(() => crypto.randomUUID());

  const handleSave = async () => {
    if (!routeName.trim()) {
      toast.error("Please enter a route name");
      return;
    }

    setIsSaving(true);
    try {
      // Prepare job data - strip out orderData to keep size small
      const jobData = jobs.map(job => ({
        orderId: job.orderId,
        type: job.type,
        address: job.address,
        contactName: job.contactName,
        phoneNumber: job.phoneNumber,
        order: job.order,
        estimatedTime: job.estimatedTime,
        lat: job.lat,
        lon: job.lon,
        breakDuration: job.breakDuration,
        breakType: job.breakType
      }));

      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("You must be logged in to save routes");
        return;
      }

      const { error } = await supabase
        .from('saved_routes')
        .insert({
          id: generatedId,
          name: routeName.trim(),
          job_data: jobData,
          start_time: startTime,
          starting_bikes: startingBikes,
          created_by: user.id
        });

      if (error) throw error;

      onSaved(generatedId, routeName.trim());
      onOpenChange(false);
      setRouteName("");
    } catch (error: any) {
      console.error("Error saving route:", error);
      toast.error(`Failed to save route: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const copyId = () => {
    navigator.clipboard.writeText(generatedId);
    toast.success("Route ID copied!");
  };

  const collectionCount = jobs.filter(j => j.type === 'pickup').length;
  const deliveryCount = jobs.filter(j => j.type === 'delivery').length;
  const jobCount = jobs.filter(j => j.type !== 'break').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            Save Route
          </DialogTitle>
          <DialogDescription>
            Save this route configuration for later use
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="routeName">Route Name</Label>
            <Input
              id="routeName"
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              placeholder="e.g., Birmingham North Morning Run"
              autoFocus
            />
          </div>
          
          <div className="space-y-2">
            <Label>Route ID</Label>
            <div className="flex items-center gap-2">
              <Input
                value={generatedId}
                readOnly
                className="font-mono text-xs bg-muted"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copyId}
                type="button"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Auto-generated unique identifier
            </p>
          </div>
          
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium">
              This route contains {jobCount} jobs
            </p>
            <p className="text-xs text-muted-foreground">
              ({collectionCount} collections, {deliveryCount} deliveries)
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Start time: {startTime} • Starting bikes: {startingBikes}
            </p>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !routeName.trim()}>
            {isSaving ? "Saving..." : "Save Route"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SaveRouteDialog;
