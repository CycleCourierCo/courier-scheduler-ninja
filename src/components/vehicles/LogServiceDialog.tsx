import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  BRAKE_POSITIONS,
  POSITION_LABELS,
  SERVICE_TYPE_LABELS,
  TYRE_POSITIONS,
  type ServicePosition,
  type ServiceType,
} from "@/constants/vehicleMaintenance";
import { createLog } from "@/services/vehicleMaintenanceService";

interface Props {
  vehicleId: string;
  vehicleReg: string;
  currentMileage: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const LogServiceDialog = ({ vehicleId, vehicleReg, currentMileage, open, onOpenChange, onSaved }: Props) => {
  const [serviceType, setServiceType] = useState<ServiceType>("oil_filter");
  const [position, setPosition] = useState<ServicePosition | "">("");
  const [customName, setCustomName] = useState("");
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [odometerMi, setOdometerMi] = useState<string>(String(currentMileage || ""));
  const [cost, setCost] = useState("");
  const [vendor, setVendor] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const positions =
    serviceType === "tyre" ? TYRE_POSITIONS : serviceType === "brake_pads" || serviceType === "brake_discs" ? BRAKE_POSITIONS : [];

  const reset = () => {
    setServiceType("oil_filter");
    setPosition("");
    setCustomName("");
    setServiceDate(new Date().toISOString().slice(0, 10));
    setOdometerMi(String(currentMileage || ""));
    setCost("");
    setVendor("");
    setBrand("");
    setModel("");
    setPartNumber("");
    setNotes("");
  };

  const handleSave = async () => {
    if (positions.length > 0 && !position) {
      toast.error("Please choose a position");
      return;
    }
    if (serviceType === "other" && !customName.trim()) {
      toast.error("Please name the service");
      return;
    }
    setSaving(true);
    try {
      await createLog({
        vehicle_id: vehicleId,
        service_type: serviceType,
        custom_name: serviceType === "other" ? customName.trim() : null,
        position: positions.length > 0 ? (position as ServicePosition) : null,
        service_date: serviceDate,
        odometer_mi: odometerMi ? Number(odometerMi) : null,
        cost: cost ? Number(cost) : null,
        vendor: vendor.trim() || null,
        brand: brand.trim() || null,
        model: model.trim() || null,
        part_number: partNumber.trim() || null,
        notes: notes.trim() || null,
      });
      toast.success("Service logged");
      reset();
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log service — {vehicleReg}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Service type</Label>
              <Select value={serviceType} onValueChange={(v) => { setServiceType(v as ServiceType); setPosition(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(SERVICE_TYPE_LABELS) as ServiceType[]).map((k) => (
                    <SelectItem key={k} value={k}>{SERVICE_TYPE_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {positions.length > 0 && (
              <div>
                <Label>Position</Label>
                <Select value={position} onValueChange={(v) => setPosition(v as ServicePosition)}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {positions.map((p) => (
                      <SelectItem key={p} value={p}>{POSITION_LABELS[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {serviceType === "other" && (
              <div className="col-span-2">
                <Label>Service name</Label>
                <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="e.g. Cambelt, MOT, Air filter" />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} />
            </div>
            <div>
              <Label>Odometer (mi)</Label>
              <Input type="number" value={odometerMi} onChange={(e) => setOdometerMi(e.target.value)} placeholder="Optional override" />
            </div>
            <div>
              <Label>Cost (£)</Label>
              <Input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
            </div>
            <div>
              <Label>Vendor</Label>
              <Input value={vendor} onChange={(e) => setVendor(e.target.value)} />
            </div>
            <div>
              <Label>Brand</Label>
              <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
            </div>
            <div>
              <Label>Model</Label>
              <Input value={model} onChange={(e) => setModel(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>Part number</Label>
              <Input value={partNumber} onChange={(e) => setPartNumber(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Log service"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LogServiceDialog;
