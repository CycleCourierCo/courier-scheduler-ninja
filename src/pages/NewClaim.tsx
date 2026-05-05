import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  createClaim,
  DAMAGE_TYPES,
  isWithinTimeframe,
  TIMEFRAME_DAYS,
  type ClaimDamageType,
} from "@/services/claimsService";

const EVIDENCE_FIELDS: { key: string; label: string }[] = [
  { key: "ev_booking_ref", label: "Booking reference provided" },
  { key: "ev_pre_collection_photos", label: "Pre-collection photos" },
  { key: "ev_delivery_photos", label: "Damage on delivery photos" },
  { key: "ev_full_bike_photos", label: "Full bike + damage area photos" },
  { key: "ev_proof_ownership", label: "Proof of ownership" },
  { key: "ev_proof_value", label: "Proof of value" },
  { key: "ev_upgrade_details", label: "Upgrade/custom parts details" },
  { key: "ev_repair_estimate", label: "Repair estimate" },
  { key: "ev_delivery_note", label: "Delivery note / Condition Report / Driver note" },
];

const NewClaim = () => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({
    booking_ref: "",
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    collection_date: "",
    delivery_date: "",
    route_name: "",
    driver_name: "",
    bike_make_model: "",
    declared_value: "",
    has_upgrades: false,
    upgrades_notes: "",
    damage_type: "" as ClaimDamageType | "",
    damage_description: "",
    recorded_at_delivery: "unknown",
    notification_date: "",
    internal_notes: "",
  });
  EVIDENCE_FIELDS.forEach((f) => {
    if (form[f.key] === undefined) form[f.key] = false;
  });

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const timeframeOk = useMemo(
    () => isWithinTimeframe(form.damage_type || null, form.delivery_date || null, form.notification_date || null),
    [form.damage_type, form.delivery_date, form.notification_date],
  );

  const submit = async (asDraft: boolean) => {
    if (!form.booking_ref.trim()) {
      toast.error("Booking reference is required");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        booking_ref: form.booking_ref,
        customer_name: form.customer_name || null,
        customer_email: form.customer_email || null,
        customer_phone: form.customer_phone || null,
        collection_date: form.collection_date || null,
        delivery_date: form.delivery_date || null,
        route_name: form.route_name || null,
        driver_name: form.driver_name || null,
        bike_make_model: form.bike_make_model || null,
        declared_value: form.declared_value ? Number(form.declared_value) : null,
        has_upgrades: !!form.has_upgrades,
        upgrades_notes: form.upgrades_notes || null,
        damage_type: form.damage_type || null,
        damage_description: form.damage_description || null,
        recorded_at_delivery: form.recorded_at_delivery || null,
        notification_date: form.notification_date || null,
        internal_notes: form.internal_notes || null,
        status: "open",
      };
      if (!asDraft) {
        EVIDENCE_FIELDS.forEach((f) => (payload[f.key] = !!form[f.key]));
      }
      const created = await createClaim(payload);
      toast.success(`Claim ${created.claim_ref} created`);
      navigate(`/claims/${created.id}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to create claim");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
        <h1 className="text-2xl font-bold">New Damage Claim</h1>

        <Card>
          <CardHeader><CardTitle>Booking Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Booking Reference *</Label><Input value={form.booking_ref} onChange={(e) => set("booking_ref", e.target.value)} /></div>
            <div><Label>Customer Name</Label><Input value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} /></div>
            <div><Label>Customer Email</Label><Input type="email" value={form.customer_email} onChange={(e) => set("customer_email", e.target.value)} /></div>
            <div><Label>Customer Phone</Label><Input value={form.customer_phone} onChange={(e) => set("customer_phone", e.target.value)} /></div>
            <div><Label>Collection Date</Label><Input type="date" value={form.collection_date} onChange={(e) => set("collection_date", e.target.value)} /></div>
            <div><Label>Delivery Date</Label><Input type="date" value={form.delivery_date} onChange={(e) => set("delivery_date", e.target.value)} /></div>
            <div><Label>Route</Label><Input value={form.route_name} onChange={(e) => set("route_name", e.target.value)} /></div>
            <div><Label>Driver</Label><Input value={form.driver_name} onChange={(e) => set("driver_name", e.target.value)} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Bike Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>Make &amp; Model</Label><Input value={form.bike_make_model} onChange={(e) => set("bike_make_model", e.target.value)} /></div>
              <div><Label>Declared Value (£)</Label><Input type="number" step="0.01" value={form.declared_value} onChange={(e) => set("declared_value", e.target.value)} /></div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={!!form.has_upgrades} onCheckedChange={(v) => set("has_upgrades", v)} />
              <Label>Declared upgrades or custom parts</Label>
            </div>
            {form.has_upgrades && (
              <div><Label>Upgrade details</Label><Textarea value={form.upgrades_notes} onChange={(e) => set("upgrades_notes", e.target.value)} /></div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Damage Report</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Damage Type</Label>
                <Select value={form.damage_type} onValueChange={(v) => set("damage_type", v)}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {DAMAGE_TYPES.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Recorded at delivery?</Label>
                <Select value={form.recorded_at_delivery} onValueChange={(v) => set("recorded_at_delivery", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Damage Description</Label>
                <Textarea value={form.damage_description} onChange={(e) => set("damage_description", e.target.value)} rows={4} />
              </div>
              <div>
                <Label>Notification Date</Label>
                <Input type="date" value={form.notification_date} onChange={(e) => set("notification_date", e.target.value)} />
              </div>
            </div>
            {form.damage_type && form.delivery_date && form.notification_date && (
              timeframeOk ? (
                <Alert className="border-green-600/40 bg-green-500/10">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription>Notification within {TIMEFRAME_DAYS[form.damage_type as ClaimDamageType]} days — within T&amp;C timeframe.</AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>Notification outside the {TIMEFRAME_DAYS[form.damage_type as ClaimDamageType]}-day window. This claim may be out of time.</AlertDescription>
                </Alert>
              )
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Evidence Checklist</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {EVIDENCE_FIELDS.map((f) => (
              <label key={f.key} className="flex items-center gap-2 text-sm">
                <Checkbox checked={!!form[f.key]} onCheckedChange={(v) => set(f.key, !!v)} />
                {f.label}
              </label>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Internal Notes</CardTitle></CardHeader>
          <CardContent>
            <Textarea value={form.internal_notes} onChange={(e) => set("internal_notes", e.target.value)} rows={4} placeholder="Staff-only notes" />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={saving} onClick={() => submit(true)}>Save as Draft</Button>
          <Button className="bg-green-600 hover:bg-green-700 text-white" disabled={saving} onClick={() => submit(false)}>Open Claim</Button>
        </div>
      </div>
    </Layout>
  );
};

export default NewClaim;
