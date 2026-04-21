import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  lookupVehicleFromDVLA,
  updateVehicle,
  VEHICLE_STATUS_OPTIONS,
  type Vehicle,
  type VehicleStatus,
} from "@/services/vehicleService";

interface Props {
  vehicle: Vehicle | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export const EditVehicleDialog = ({ vehicle, open, onOpenChange, onSaved }: Props) => {
  const [status, setStatus] = useState<VehicleStatus>("purchased");
  const [londonAutoPay, setLondonAutoPay] = useState(false);
  const [dartford, setDartford] = useState(false);
  const [notes, setNotes] = useState("");
  const [purchaseDate, setPurchaseDate] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (vehicle) {
      setStatus(vehicle.status);
      setLondonAutoPay(vehicle.london_auto_pay);
      setDartford(vehicle.dartford_crossing);
      setNotes(vehicle.notes ?? "");
      setPurchaseDate(vehicle.purchase_date ?? "");
    }
  }, [vehicle]);

  if (!vehicle) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateVehicle(vehicle.id, {
        status,
        london_auto_pay: londonAutoPay,
        dartford_crossing: dartford,
        notes: notes || null,
        purchase_date: purchaseDate || null,
      });
      toast.success("Vehicle updated");
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await lookupVehicleFromDVLA(vehicle.registration);
      await updateVehicle(vehicle.id, {
        make: res.make,
        colour: res.colour,
        fuel_type: res.fuel_type,
        year_of_manufacture: res.year_of_manufacture,
        engine_capacity: res.engine_capacity,
        co2_emissions: res.co2_emissions,
        tax_status: res.tax_status,
        tax_due_date: res.tax_due_date,
        mot_status: res.mot_status,
        mot_expiry_date: res.mot_expiry_date,
        date_of_last_v5c_issued: res.date_of_last_v5c_issued,
        marked_for_export: res.marked_for_export,
        type_approval: res.type_approval,
        wheelplan: res.wheelplan,
        revenue_weight: res.revenue_weight,
        euro_status: res.euro_status,
        real_driving_emissions: res.real_driving_emissions,
        ves_raw: res.ves_raw as never,
        last_refreshed_at: new Date().toISOString(),
      });
      toast.success("Refreshed from DVLA");
      onSaved?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{vehicle.registration}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
              <div>Make: <span className="text-foreground">{vehicle.make ?? "—"}</span></div>
              <div>Colour: <span className="text-foreground">{vehicle.colour ?? "—"}</span></div>
              <div>Fuel: <span className="text-foreground">{vehicle.fuel_type ?? "—"}</span></div>
              <div>Year: <span className="text-foreground">{vehicle.year_of_manufacture ?? "—"}</span></div>
              <div>Tax: <span className="text-foreground">{vehicle.tax_status ?? "—"}{vehicle.tax_due_date ? ` · due ${vehicle.tax_due_date}` : ""}</span></div>
              <div>MOT: <span className="text-foreground">{vehicle.mot_status ?? "—"}{vehicle.mot_expiry_date ? ` · exp ${vehicle.mot_expiry_date}` : ""}</span></div>
            </div>
            <div className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
                {refreshing ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-2" />}
                Refresh from DVLA
              </Button>
              {vehicle.last_refreshed_at && (
                <span className="ml-2 text-xs text-muted-foreground">
                  Last: {new Date(vehicle.last_refreshed_at).toLocaleString()}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as VehicleStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VEHICLE_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchase-date-edit">Purchase date</Label>
              <Input
                id="purchase-date-edit"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="font-medium text-sm">London Auto Pay</div>
            <Switch checked={londonAutoPay} onCheckedChange={setLondonAutoPay} />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="font-medium text-sm">Dartford Crossing</div>
            <Switch checked={dartford} onCheckedChange={setDartford} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes-edit">Notes</Label>
            <Textarea id="notes-edit" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditVehicleDialog;
