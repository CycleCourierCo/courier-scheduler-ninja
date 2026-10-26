import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { BRAKE_POSITIONS, POSITION_LABELS, SERVICE_TYPE_LABELS, TYRE_POSITIONS, type ServicePosition, type ServiceType } from "@/constants/vehicleMaintenance";
import { bulkLogService } from "@/services/vehicleMaintenanceService";

interface Props {
  vans: { id: string; registration: string; odometer: number }[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}

const BulkServiceDialog = ({ vans, open, onOpenChange, onSaved }: Props) => {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const [type, setType] = useState<ServiceType>("oil_filter");
  const [position, setPosition] = useState<string>("");
  const [customName, setCustomName] = useState("");
  const [date, setDate] = useState(today);
  const [vendor, setVendor] = useState("");
  const [cost, setCost] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [notes, setNotes] = useState("");
  const [miles, setMiles] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setMiles(Object.fromEntries(vans.map((v) => [v.id, String(v.odometer || "")])));
  }, [open, vans]);

  const positions = type === "tyre" ? TYRE_POSITIONS : type === "brake_pads" || type === "brake_discs" ? BRAKE_POSITIONS : [];

  const save = async () => {
    if (positions.length && !position) return toast.error("Please choose a position");
    if (type === "other" && !customName.trim()) return toast.error("Please name the service");
    setSaving(true);
    try {
      const n = await bulkLogService(vans.map((v) => ({
        vehicle_id: v.id, service_type: type, position: positions.length ? (position as ServicePosition) : null,
        custom_name: type === "other" ? customName.trim() : null, service_date: date,
        odometer_mi: miles[v.id] && Number(miles[v.id]) > 0 ? Math.round(Number(miles[v.id])) : null,
        cost: cost ? Number(cost) : null, vendor: vendor.trim() || null, notes: notes.trim() || null,
        brand: brand.trim() || null, model: model.trim() || null,
      })));
      toast.success(`Service saved on ${n} van${n === 1 ? "" : "s"}`);
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add service to {vans.length} van{vans.length === 1 ? "" : "s"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Service type</Label>
              <Select value={type} onValueChange={(v) => { setType(v as ServiceType); setPosition(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(SERVICE_TYPE_LABELS) as ServiceType[]).map((k) => <SelectItem key={k} value={k}>{SERVICE_TYPE_LABELS[k]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {positions.length > 0 && <div><Label>Position</Label>
              <Select value={position} onValueChange={setPosition}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{positions.map((p) => <SelectItem key={p} value={p}>{POSITION_LABELS[p]}</SelectItem>)}</SelectContent>
              </Select>
            </div>}
            {type === "other" && <div className="col-span-2"><Label>Service name</Label><Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="e.g. Air filter" /></div>}
            <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div><Label>Cost per van (£)</Label><Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} /></div>
            <div><Label>Garage / supplier</Label><Input value={vendor} onChange={(e) => setVendor(e.target.value)} /></div>
            <div><Label>Brand</Label><Input value={brand} onChange={(e) => setBrand(e.target.value)} /></div>
            <div><Label>Model</Label><Input value={model} onChange={(e) => setModel(e.target.value)} /></div>
            <div className="col-span-2"><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          </div>
          <div className="space-y-1">
            <Label>Mileage on each van</Label>
            <p className="text-xs text-muted-foreground">Filled with each van's current mileage. Change any that are wrong — it also updates the van's mileage.</p>
            {vans.map((v) => (
              <div key={v.id} className="grid grid-cols-[1fr,140px] items-center gap-2">
                <span className="font-mono text-sm">{v.registration}</span>
                <Input type="number" value={miles[v.id] ?? ""} onChange={(e) => setMiles((m) => ({ ...m, [v.id]: e.target.value }))} />
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || vans.length === 0}>{saving ? "Saving..." : "Save to all"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkServiceDialog;
