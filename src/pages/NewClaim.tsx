import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { CheckCircle2, AlertTriangle, Search, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  createClaim,
  DAMAGE_TYPES,
  deriveClaimFields,
  isWithinTimeframe,
  searchOrdersForClaim,
  TIMEFRAME_DAYS,
  type ClaimDamageType,
  type ClaimOrder,
} from "@/services/claimsService";

const EVIDENCE_FIELDS = [
  { key: "ev_booking_ref", label: "Booking reference provided" },
  { key: "ev_pre_collection_photos", label: "Pre-collection photos" },
  { key: "ev_delivery_photos", label: "Damage on delivery photos" },
  { key: "ev_full_bike_photos", label: "Full bike + damage area photos" },
  { key: "ev_proof_ownership", label: "Proof of ownership" },
  { key: "ev_proof_value", label: "Proof of value" },
  { key: "ev_upgrade_details", label: "Upgrade/custom parts details" },
  { key: "ev_repair_estimate", label: "Repair estimate" },
  { key: "ev_delivery_note", label: "Delivery note / Condition Report / Driver note" },
] as const;

const fmtDate = (v: string | null) => (v ? format(new Date(v), "dd MMM yyyy") : "—");

const NewClaim = () => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<ClaimOrder[]>([]);
  const [searching, setSearching] = useState(false);
  const [order, setOrder] = useState<ClaimOrder | null>(null);

  const [damageType, setDamageType] = useState<ClaimDamageType | "">("");
  const [recordedAtDelivery, setRecordedAtDelivery] = useState("unknown");
  const [damageDescription, setDamageDescription] = useState("");
  const [notificationDate, setNotificationDate] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [evidence, setEvidence] = useState<Record<string, boolean>>({});

  // debounced search
  useEffect(() => {
    if (!pickerOpen) return;
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const rows = await searchOrdersForClaim(searchTerm);
        setResults(rows);
      } catch (e: any) {
        toast.error(e.message || "Search failed");
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [searchTerm, pickerOpen]);

  const derived = useMemo(
    () =>
      order
        ? deriveClaimFields(
            { booking_ref: order.tracking_number ?? "" } as any,
            order,
          )
        : null,
    [order],
  );

  const timeframeOk = useMemo(
    () =>
      isWithinTimeframe(
        damageType || null,
        derived?.deliveryDate ?? null,
        notificationDate || null,
      ),
    [damageType, derived?.deliveryDate, notificationDate],
  );

  const submit = async (asDraft: boolean) => {
    if (!order) {
      toast.error("Please link an order first");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        order_id: order.id,
        booking_ref: order.tracking_number ?? "",
        damage_type: damageType || null,
        damage_description: damageDescription || null,
        recorded_at_delivery: recordedAtDelivery || null,
        notification_date: notificationDate || null,
        internal_notes: internalNotes || null,
        status: "opened",
      };
      if (!asDraft) {
        for (const f of EVIDENCE_FIELDS) payload[f.key] = !!evidence[f.key];
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
          <CardHeader>
            <CardTitle>Linked Order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!order ? (
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <Search className="h-4 w-4 mr-2" />
                    Search by tracking #, customer name, email…
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[min(640px,calc(100vw-2rem))] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Type to search orders…"
                      value={searchTerm}
                      onValueChange={setSearchTerm}
                    />
                    <CommandList>
                      {searching && <div className="p-3 text-sm text-muted-foreground">Searching…</div>}
                      {!searching && (
                        <CommandEmpty>No orders found.</CommandEmpty>
                      )}
                      <CommandGroup>
                        {results.map((o) => {
                          const d = deriveClaimFields({ booking_ref: o.tracking_number ?? "" } as any, o);
                          return (
                            <CommandItem
                              key={o.id}
                              value={o.id}
                              onSelect={() => {
                                setOrder(o);
                                setPickerOpen(false);
                              }}
                              className="flex flex-col items-start gap-1"
                            >
                              <div className="flex w-full justify-between gap-2">
                                <span className="font-mono text-sm">{o.tracking_number ?? "—"}</span>
                                <span className="text-xs text-muted-foreground">{o.status ?? ""}</span>
                              </div>
                              <div className="text-sm">{d.customerName ?? "—"}</div>
                              <div className="text-xs text-muted-foreground">
                                {d.senderPostcode ?? "—"} → {d.receiverPostcode ?? "—"} ·{" "}
                                {fmtDate(d.collectionDate)} → {fmtDate(d.deliveryDate)}
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-sm">{order.tracking_number}</div>
                    <div className="text-xs text-muted-foreground">Linked order</div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setOrder(null)}>
                    <X className="h-4 w-4 mr-1" /> Change
                  </Button>
                </div>
                {derived && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <div><span className="text-muted-foreground">Customer:</span> {derived.customerName ?? "—"}</div>
                    <div><span className="text-muted-foreground">Email:</span> {derived.customerEmail ?? "—"}</div>
                    <div><span className="text-muted-foreground">Phone:</span> {derived.customerPhone ?? "—"}</div>
                    <div><span className="text-muted-foreground">Collection driver:</span> {derived.collectionDriverName ?? "—"}</div>
                    <div><span className="text-muted-foreground">Delivery driver:</span> {derived.deliveryDriverName ?? "—"}</div>
                    <div><span className="text-muted-foreground">Collection:</span> {fmtDate(derived.collectionDate)}</div>
                    <div><span className="text-muted-foreground">Delivery:</span> {fmtDate(derived.deliveryDate)}</div>
                    <div><span className="text-muted-foreground">Bike:</span> {derived.bikeMakeModel ?? "—"}</div>
                    <div><span className="text-muted-foreground">Declared value:</span> {derived.declaredValue != null ? `£${derived.declaredValue}` : "—"}</div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Damage Report</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Damage Type</Label>
                <Select value={damageType} onValueChange={(v) => setDamageType(v as ClaimDamageType)}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {DAMAGE_TYPES.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Recorded at delivery?</Label>
                <Select value={recordedAtDelivery} onValueChange={setRecordedAtDelivery}>
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
                <Textarea value={damageDescription} onChange={(e) => setDamageDescription(e.target.value)} rows={4} />
              </div>
              <div>
                <Label>Notification Date</Label>
                <Input type="date" value={notificationDate} onChange={(e) => setNotificationDate(e.target.value)} />
              </div>
            </div>
            {damageType && derived?.deliveryDate && notificationDate && (
              timeframeOk ? (
                <Alert className="border-green-600/40 bg-green-500/10">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription>Notification within {TIMEFRAME_DAYS[damageType as ClaimDamageType]} days — within T&amp;C timeframe.</AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>Notification outside the {TIMEFRAME_DAYS[damageType as ClaimDamageType]}-day window. This claim may be out of time.</AlertDescription>
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
                <Checkbox checked={!!evidence[f.key]} onCheckedChange={(v) => setEvidence((p) => ({ ...p, [f.key]: !!v }))} />
                {f.label}
              </label>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Internal Notes</CardTitle></CardHeader>
          <CardContent>
            <Textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={4} placeholder="Staff-only notes" />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={saving || !order} onClick={() => submit(true)}>Save as Draft</Button>
          <Button className="bg-green-600 hover:bg-green-700 text-white" disabled={saving || !order} onClick={() => submit(false)}>Open Claim</Button>
        </div>
      </div>
    </Layout>
  );
};

export default NewClaim;
