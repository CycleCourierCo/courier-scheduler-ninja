import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import {
  createVehicle,
  lookupVehicleFromDVLA,
  normaliseReg,
  VEHICLE_STATUS_OPTIONS,
  type VehicleStatus,
  type VesLookupResult,
} from "@/services/vehicleService";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  onCreated?: () => void;
}

const TOLL_FIELDS = [
  { key: "london_auto_pay", label: "London Auto Pay", desc: "ULEZ / Congestion auto pay" },
  { key: "dartford_crossing", label: "Dartford Crossing", desc: "Dart Charge auto pay" },
  { key: "clean_air_zones", label: "Gov Clean Air Zones", desc: "Birmingham, Bristol, etc." },
  { key: "tyne_tunnel", label: "Tyne Tunnel", desc: "Auto pay enrolled" },
  { key: "mersey_tunnel", label: "Mersey Tunnel", desc: "Fast Tag enrolled" },
  { key: "humber_bridge", label: "Humber Bridge", desc: "Auto pay enrolled" },
  { key: "tamar_bridge", label: "Tamar Bridge", desc: "Tag enrolled" },
] as const;

type TollKey = typeof TOLL_FIELDS[number]["key"];

export const AddVehicleDialog = ({ onCreated }: Props) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [registration, setRegistration] = useState("");
  const [looking, setLooking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [details, setDetails] = useState<VesLookupResult | null>(null);
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
  const todayIso = () => new Date().toISOString().slice(0, 10);
  const [purchaseDate, setPurchaseDate] = useState<string>(todayIso());
  const [purchaseMileage, setPurchaseMileage] = useState<string>("");

  const reset = () => {
    setRegistration("");
    setDetails(null);
    setStatus("purchased");
    setTolls({
      london_auto_pay: false,
      dartford_crossing: false,
      clean_air_zones: false,
      tyne_tunnel: false,
      mersey_tunnel: false,
      humber_bridge: false,
      tamar_bridge: false,
    });
    setNotes("");
    setPurchaseDate(todayIso());
    setPurchaseMileage("");
  };

  const handleLookup = async () => {
    const reg = normaliseReg(registration);
    if (!reg) {
      toast.error("Enter a registration");
      return;
    }
    setLooking(true);
    try {
      const res = await lookupVehicleFromDVLA(reg);
      setDetails(res);
      toast.success("Details loaded from DVLA");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLooking(false);
    }
  };

  const handleSave = async () => {
    if (!details) return;
    setSaving(true);
    try {
      await createVehicle({
        registration: details.registration,
        status,
        purchase_date: purchaseDate || null,
        purchase_mileage: purchaseMileage ? Number(purchaseMileage) : null,
        ...tolls,
        notes: notes || null,
        make: details.make,
        colour: details.colour,
        fuel_type: details.fuel_type,
        year_of_manufacture: details.year_of_manufacture,
        engine_capacity: details.engine_capacity,
        co2_emissions: details.co2_emissions,
        tax_status: details.tax_status,
        tax_due_date: details.tax_due_date,
        mot_status: details.mot_status,
        mot_expiry_date: details.mot_expiry_date,
        date_of_last_v5c_issued: details.date_of_last_v5c_issued,
        marked_for_export: details.marked_for_export,
        type_approval: details.type_approval,
        wheelplan: details.wheelplan,
        revenue_weight: details.revenue_weight,
        euro_status: details.euro_status,
        real_driving_emissions: details.real_driving_emissions,
        ves_raw: details.ves_raw as never,
        last_refreshed_at: new Date().toISOString(),
        created_by: user?.id ?? null,
      });
      toast.success("Vehicle added");
      onCreated?.();
      reset();
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" /> Add Vehicle
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a vehicle</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reg">Registration</Label>
            <div className="flex gap-2">
              <Input
                id="reg"
                value={registration}
                onChange={(e) => setRegistration(e.target.value.toUpperCase())}
                placeholder="e.g. AB12 CDE"
                className="uppercase"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleLookup(); } }}
              />
              <Button type="button" variant="secondary" onClick={handleLookup} disabled={looking}>
                {looking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                <span className="ml-2">Look up</span>
              </Button>
            </div>
          </div>

          {details && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
              <div className="font-semibold text-base">{details.registration}</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                <div>Make: <span className="text-foreground">{details.make ?? "—"}</span></div>
                <div>Colour: <span className="text-foreground">{details.colour ?? "—"}</span></div>
                <div>Fuel: <span className="text-foreground">{details.fuel_type ?? "—"}</span></div>
                <div>Year: <span className="text-foreground">{details.year_of_manufacture ?? "—"}</span></div>
                <div>Tax: <span className="text-foreground">{details.tax_status ?? "—"}{details.tax_due_date ? ` · due ${details.tax_due_date}` : ""}</span></div>
                <div>MOT: <span className="text-foreground">{details.mot_status ?? "—"}{details.mot_expiry_date ? ` · exp ${details.mot_expiry_date}` : ""}</span></div>
              </div>
            </div>
          )}

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
              <Label htmlFor="purchase-date">Purchase date</Label>
              <Input
                id="purchase-date"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="purchase-mileage">Mileage at purchase</Label>
            <Input
              id="purchase-mileage"
              type="number"
              inputMode="numeric"
              min={0}
              value={purchaseMileage}
              onChange={(e) => setPurchaseMileage(e.target.value)}
              placeholder="e.g. 45200"
            />
          </div>

          <div className="space-y-2">
            <Label>Tolls & Zones</Label>
            <div className="space-y-2">
              {TOLL_FIELDS.map((f) => (
                <div key={f.key} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="font-medium text-sm">{f.label}</div>
                    <div className="text-xs text-muted-foreground">{f.desc}</div>
                  </div>
                  <Switch
                    checked={tolls[f.key]}
                    onCheckedChange={(v) => setTolls((t) => ({ ...t, [f.key]: v }))}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!details || saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save vehicle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddVehicleDialog;
