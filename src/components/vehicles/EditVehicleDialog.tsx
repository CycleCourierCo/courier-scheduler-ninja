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

const TOLL_FIELDS = [
  { key: "london_auto_pay", label: "London Auto Pay" },
  { key: "dartford_crossing", label: "Dartford Crossing" },
  { key: "clean_air_zones", label: "Gov Clean Air Zones" },
  { key: "tyne_tunnel", label: "Tyne Tunnel" },
  { key: "mersey_tunnel", label: "Mersey Tunnel" },
  { key: "humber_bridge", label: "Humber Bridge" },
  { key: "tamar_bridge", label: "Tamar Bridge" },
] as const;

type TollKey = typeof TOLL_FIELDS[number]["key"];

const todayIso = () => new Date().toISOString().slice(0, 10);

export const EditVehicleDialog = ({ vehicle, open, onOpenChange, onSaved }: Props) => {
  const [status, setStatus] = useState<VehicleStatus>("purchased");
  const [tolls, setTolls] = useState<Record<TollKey, boolean>>({
    london_auto_pay: false,
    dartford_crossing: false,
    clean_air_zones: false,
    tyne_tunnel: false,
    mersey_tunnel: false,
    humber_bridge: false,
    tamar_bridge: false,
  });
  const [notes, setNotes] = useState("");
  const [purchaseDate, setPurchaseDate] = useState<string>("");
  const [purchaseMileage, setPurchaseMileage] = useState<string>("");
  const [soldDate, setSoldDate] = useState<string>("");
  const [soldMileage, setSoldMileage] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (vehicle) {
      const v = vehicle as Vehicle & Partial<Record<TollKey | "purchase_mileage" | "sold_date" | "sold_mileage", unknown>>;
      setStatus(vehicle.status);
      setTolls({
        london_auto_pay: !!vehicle.london_auto_pay,
        dartford_crossing: !!vehicle.dartford_crossing,
        clean_air_zones: !!v.clean_air_zones,
        tyne_tunnel: !!v.tyne_tunnel,
        mersey_tunnel: !!v.mersey_tunnel,
        humber_bridge: !!v.humber_bridge,
        tamar_bridge: !!v.tamar_bridge,
      });
      setNotes(vehicle.notes ?? "");
      setPurchaseDate(vehicle.purchase_date ?? "");
      setPurchaseMileage(v.purchase_mileage != null ? String(v.purchase_mileage) : "");
      setSoldDate((v.sold_date as string | null) ?? "");
      setSoldMileage(v.sold_mileage != null ? String(v.sold_mileage) : "");
    }
  }, [vehicle]);

  if (!vehicle) return null;

  const isSold = status === "sold";
  const soldFieldsValid = !isSold || (!!soldDate && !!soldMileage);

  const handleSave = async () => {
    if (isSold && !soldFieldsValid) {
      toast.error("Sold date and mileage at sale are required");
      return;
    }
    setSaving(true);
    try {
      await updateVehicle(vehicle.id, {
        status,
        ...tolls,
        notes: notes || null,
        purchase_date: purchaseDate || null,
        purchase_mileage: purchaseMileage ? Number(purchaseMileage) : null,
        sold_date: isSold ? soldDate : null,
        sold_mileage: isSold && soldMileage ? Number(soldMileage) : null,
      } as never);
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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

          <div className="space-y-2">
            <Label htmlFor="purchase-mileage-edit">Mileage at purchase</Label>
            <Input
              id="purchase-mileage-edit"
              type="number"
              inputMode="numeric"
              min={0}
              value={purchaseMileage}
              onChange={(e) => setPurchaseMileage(e.target.value)}
              placeholder="e.g. 45200"
            />
          </div>

          {isSold && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-3">
              <div className="text-sm font-medium">Sold details (required)</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="sold-date">Sold date</Label>
                  <Input
                    id="sold-date"
                    type="date"
                    value={soldDate || todayIso()}
                    onChange={(e) => setSoldDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sold-mileage">Mileage at sale</Label>
                  <Input
                    id="sold-mileage"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={soldMileage}
                    onChange={(e) => setSoldMileage(e.target.value)}
                    placeholder="e.g. 89400"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Tolls & Zones</Label>
            <div className="space-y-2">
              {TOLL_FIELDS.map((f) => (
                <div key={f.key} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="font-medium text-sm">{f.label}</div>
                  <Switch
                    checked={tolls[f.key]}
                    onCheckedChange={(v) => setTolls((t) => ({ ...t, [f.key]: v }))}
                  />
                </div>
              ))}
            </div>
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
