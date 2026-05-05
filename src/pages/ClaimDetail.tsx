import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, CheckCircle2, AlertTriangle, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import ClaimStatusBadge from "@/components/claims/ClaimStatusBadge";
import ClaimStepper from "@/components/claims/ClaimStepper";
import {
  addNote,
  advanceClaim,
  canonicalStep,
  changeStatus,
  CLAIM_STATUSES,
  DAMAGE_TYPES,
  deleteEvidence,
  deriveClaimFields,
  getClaim,
  getEvidenceSignedUrl,
  getStatusLog,
  isWithinTimeframe,
  listEvidence,
  listNotes,
  nextStep,
  rejectClaim,
  TIMEFRAME_DAYS,
  updateClaim,
  uploadEvidence,
  type Claim,
  type ClaimDamageType,
  type ClaimEvidenceFile,
  type ClaimNote,
  type ClaimOrder,
  type ClaimStatus,
  type ClaimStatusLogEntry,
} from "@/services/claimsService";

const EVIDENCE_FIELDS: { key: keyof Claim; label: string }[] = [
  { key: "ev_booking_ref", label: "Booking reference provided" },
  { key: "ev_pre_collection_photos", label: "Pre-collection photos" },
  { key: "ev_delivery_photos", label: "Damage on delivery photos" },
  { key: "ev_full_bike_photos", label: "Full bike + damage area photos" },
  { key: "ev_proof_ownership", label: "Proof of ownership" },
  { key: "ev_proof_value", label: "Proof of value" },
  { key: "ev_upgrade_details", label: "Upgrade/custom parts details" },
  { key: "ev_repair_estimate", label: "Repair estimate" },
  { key: "ev_delivery_note", label: "Delivery note / Driver note" },
];

const fmtMoney = (n: number | null | undefined) =>
  n == null ? "—" : `£${Number(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (v: string | null) => (v ? format(new Date(v), "dd MMM yyyy") : "—");

const ClaimDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [order, setOrder] = useState<ClaimOrder | null>(null);
  const [notes, setNotes] = useState<ClaimNote[]>([]);
  const [statusLog, setStatusLog] = useState<ClaimStatusLogEntry[]>([]);
  const [evidence, setEvidence] = useState<ClaimEvidenceFile[]>([]);
  const [evidenceUrls, setEvidenceUrls] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Partial<Claim>>({});
  const [dirty, setDirty] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploadKind, setUploadKind] = useState<"photo" | "document">("photo");
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerForm, setOfferForm] = useState({ amount: "", date: new Date().toISOString().slice(0, 10) });

  const reload = async () => {
    if (!id) return;
    const [{ claim: c, order: o }, n, s, e] = await Promise.all([
      getClaim(id),
      listNotes(id),
      getStatusLog(id),
      listEvidence(id),
    ]);
    setClaim(c);
    setOrder(o);
    setNotes(n);
    setStatusLog(s);
    setEvidence(e);
    setDraft({});
    setDirty(false);
    const urls: Record<string, string> = {};
    await Promise.all(
      e.map(async (f) => {
        const u = await getEvidenceSignedUrl(f.storage_path);
        if (u) urls[f.id] = u;
      }),
    );
    setEvidenceUrls(urls);
  };

  useEffect(() => {
    reload().catch((err) => toast.error(err.message || "Failed to load"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const derived = useMemo(
    () => (claim ? deriveClaimFields(claim, order) : null),
    [claim, order],
  );

  const view: Claim | null = claim ? ({ ...claim, ...draft } as Claim) : null;

  const cap = useMemo(() => {
    if (!view || !derived) return null;
    const vals = [view.repair_quote, view.market_value, derived.declaredValue]
      .map((v) => (v == null ? null : Number(v)))
      .filter((v) => v != null && !Number.isNaN(v)) as number[];
    if (!vals.length) return null;
    return Math.min(...vals);
  }, [view?.repair_quote, view?.market_value, derived?.declaredValue]);

  if (!claim || !derived || !view) {
    return <Layout><div className="container mx-auto p-6">Loading…</div></Layout>;
  }

  const setField = <K extends keyof Claim>(k: K, v: Claim[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setDirty(true);
  };

  const saveDraft = async () => {
    try {
      const updated = await updateClaim(claim.id, draft);
      setClaim(updated);
      setDraft({});
      setDirty(false);
      toast.success("Saved");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleStatus = async (status: ClaimStatus, extra: Partial<Claim> = {}) => {
    try {
      const updated = await changeStatus(claim.id, status, extra);
      setClaim(updated);
      const log = await getStatusLog(claim.id);
      setStatusLog(log);
      toast.success(`Status → ${CLAIM_STATUSES.find((s) => s.value === status)?.label}`);
    } catch (e: any) { toast.error(e.message); }
  };

  const submitNote = async () => {
    if (!newNote.trim()) return;
    try {
      await addNote(claim.id, newNote.trim());
      setNewNote("");
      setNotes(await listNotes(claim.id));
    } catch (e: any) { toast.error(e.message); }
  };

  const onUpload = async (file: File) => {
    try {
      await uploadEvidence(claim.id, file, uploadLabel || file.name, uploadKind);
      setUploadLabel("");
      await reload();
      toast.success("Uploaded");
    } catch (e: any) { toast.error(e.message); }
  };

  const removeFile = async (f: ClaimEvidenceFile) => {
    try {
      await deleteEvidence(f);
      await reload();
    } catch (e: any) { toast.error(e.message); }
  };

  const evidenceToggle = async (key: keyof Claim, val: boolean) => {
    try {
      const updated = await updateClaim(claim.id, { [key]: val } as any);
      setClaim(updated);
    } catch (e: any) { toast.error(e.message); }
  };


  const tfOk = isWithinTimeframe(view.damage_type, derived.deliveryDate, view.notification_date);
  const daysOpen = Math.floor((Date.now() - new Date(claim.created_at).getTime()) / 86400000);

  const handleAdvance = async (extra: Partial<Claim> = {}) => {
    try {
      const updated = await advanceClaim(claim.id, extra);
      setClaim(updated);
      const [n, log] = await Promise.all([listNotes(claim.id), getStatusLog(claim.id)]);
      setNotes(n);
      setStatusLog(log);
      toast.success(`Advanced to ${CLAIM_STATUSES.find((s) => s.value === updated.status)?.label}`);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleReject = async () => {
    if (!confirm("Reject this claim? This is a terminal action.")) return;
    try {
      const updated = await rejectClaim(claim.id);
      setClaim(updated);
      const n = await listNotes(claim.id);
      setNotes(n);
      toast.success("Claim rejected");
    } catch (e: any) { toast.error(e.message); }
  };

  const next = nextStep(claim.status);
  const nextLabel = next ? CLAIM_STATUSES.find((s) => s.value === next)?.label : null;
  const isTerminal = !next;

  const onAdvanceClick = () => {
    if (next === "settlement_proposed") {
      setOfferForm({
        amount: view.recommended_settlement?.toString() ?? view.offer_amount?.toString() ?? "",
        date: new Date().toISOString().slice(0, 10),
      });
      setOfferOpen(true);
      return;
    }
    handleAdvance();
  };

  const actionButtons = () => (
    <>
      {next && (
        <Button size="sm" onClick={onAdvanceClick} className="bg-green-600 hover:bg-green-700 text-white">
          Advance to: {nextLabel}
        </Button>
      )}
      {!isTerminal && (
        <Button size="sm" variant="destructive" onClick={handleReject}>
          Reject Claim
        </Button>
      )}
      {isTerminal && claim.status !== "rejected" && (
        <Button size="sm" variant="outline" onClick={() => changeStatus(claim.id, "assessment").then(reload)}>
          Reopen
        </Button>
      )}
    </>
  );

  const timeline = [
    ...statusLog.map((s) => ({
      ts: s.changed_at,
      text: `${s.from_status ? `${s.from_status} → ` : "Created as "}${s.to_status}`,
      who: s.changed_by_name,
      kind: "status" as const,
    })),
    ...notes.map((n) => ({ ts: n.created_at, text: n.note, who: n.author_name, kind: "note" as const })),
  ].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => navigate("/claims")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div className="flex flex-wrap gap-2">{actionButtons()}</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          {/* Sticky summary */}
          <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="font-mono text-sm text-muted-foreground">{claim.claim_ref}</div>
                <ClaimStatusBadge status={claim.status} className="text-sm px-3 py-1" />
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Booking:</span> {derived.bookingRef}
                    {claim.order_id && (
                      <Link to={`/orders/${claim.order_id}`} className="text-primary inline-flex items-center ml-1">
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                  <div><span className="text-muted-foreground">Customer:</span> {derived.customerName ?? "—"}</div>
                  {derived.customerEmail && <div className="text-xs text-muted-foreground">{derived.customerEmail}</div>}
                  {derived.customerPhone && <div className="text-xs text-muted-foreground">{derived.customerPhone}</div>}
                  <div><span className="text-muted-foreground">Bike:</span> {derived.bikeMakeModel ?? "—"}</div>
                  <div><span className="text-muted-foreground">Declared value:</span> {fmtMoney(derived.declaredValue)}</div>
                  <div><span className="text-muted-foreground">Collection:</span> {fmtDate(derived.collectionDate)}</div>
                  <div><span className="text-muted-foreground">Delivery:</span> {fmtDate(derived.deliveryDate)}</div>
                  <div><span className="text-muted-foreground">Collection driver:</span> {derived.collectionDriverName ?? "—"}</div>
                  <div><span className="text-muted-foreground">Delivery driver:</span> {derived.deliveryDriverName ?? "—"}</div>
                  <div><span className="text-muted-foreground">Opened:</span> {format(new Date(claim.created_at), "dd MMM yyyy")}</div>
                  <div><span className="text-muted-foreground">Days open:</span> {daysOpen}</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Timeline</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-xs">
                {statusLog.map((s) => (
                  <div key={s.id} className="border-l-2 pl-2 border-primary">
                    <div className="font-medium">{s.from_status ? `${s.from_status} → ${s.to_status}` : `Opened (${s.to_status})`}</div>
                    <div className="text-muted-foreground">{format(new Date(s.changed_at), "dd MMM yyyy HH:mm")} · {s.changed_by_name ?? "—"}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="details">
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="evidence">Evidence</TabsTrigger>
              <TabsTrigger value="assessment">Assessment</TabsTrigger>
              <TabsTrigger value="settlement">Settlement</TabsTrigger>
              <TabsTrigger value="notes">Notes &amp; History</TabsTrigger>
            </TabsList>

            {/* DETAILS */}
            <TabsContent value="details" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Linked Order</span>
                    {claim.order_id && (
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/orders/${claim.order_id}`}>
                          <ExternalLink className="h-3 w-3 mr-1" /> View order
                        </Link>
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {order ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div><span className="text-muted-foreground">Tracking #:</span> <span className="font-mono">{order.tracking_number}</span></div>
                      <div><span className="text-muted-foreground">Order status:</span> {order.status ?? "—"}</div>
                      <div><span className="text-muted-foreground">Customer:</span> {derived.customerName ?? "—"}</div>
                      <div><span className="text-muted-foreground">Email:</span> {derived.customerEmail ?? "—"}</div>
                      <div><span className="text-muted-foreground">Phone:</span> {derived.customerPhone ?? "—"}</div>
                      <div><span className="text-muted-foreground">Collection driver:</span> {derived.collectionDriverName ?? "—"}</div>
                      <div><span className="text-muted-foreground">Delivery driver:</span> {derived.deliveryDriverName ?? "—"}</div>
                      <div><span className="text-muted-foreground">Collection:</span> {fmtDate(derived.collectionDate)}</div>
                      <div><span className="text-muted-foreground">Delivery:</span> {fmtDate(derived.deliveryDate)}</div>
                      <div><span className="text-muted-foreground">Bike:</span> {derived.bikeMakeModel ?? "—"}</div>
                      <div><span className="text-muted-foreground">Declared value:</span> {fmtMoney(derived.declaredValue)}</div>
                    </div>
                  ) : (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>Linked order not found.</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Damage</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Damage Type</Label>
                      <Select value={view.damage_type ?? ""} onValueChange={(v) => setField("damage_type", v as ClaimDamageType)}>
                        <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                        <SelectContent>{DAMAGE_TYPES.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Recorded at delivery?</Label>
                      <Select value={view.recorded_at_delivery ?? "unknown"} onValueChange={(v) => setField("recorded_at_delivery", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">Yes</SelectItem>
                          <SelectItem value="no">No</SelectItem>
                          <SelectItem value="unknown">Unknown</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2"><Label>Damage Description</Label><Textarea rows={4} value={view.damage_description ?? ""} onChange={(e) => setField("damage_description", e.target.value)} /></div>
                    <div><Label>Notification Date</Label><Input type="date" value={view.notification_date ?? ""} onChange={(e) => setField("notification_date", e.target.value)} /></div>
                  </div>
                  {view.damage_type && derived.deliveryDate && view.notification_date && (
                    tfOk ? (
                      <Alert className="border-green-600/40 bg-green-500/10"><CheckCircle2 className="h-4 w-4 text-green-600" /><AlertDescription>Within {TIMEFRAME_DAYS[view.damage_type]}-day T&amp;C window.</AlertDescription></Alert>
                    ) : (
                      <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>Outside the {TIMEFRAME_DAYS[view.damage_type]}-day window.</AlertDescription></Alert>
                    )
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Internal Notes</CardTitle></CardHeader>
                <CardContent><Textarea rows={4} value={view.internal_notes ?? ""} onChange={(e) => setField("internal_notes", e.target.value)} /></CardContent>
              </Card>
              {dirty && (
                <div className="flex justify-end">
                  <Button onClick={saveDraft} className="bg-green-600 hover:bg-green-700 text-white">Save changes</Button>
                </div>
              )}
            </TabsContent>

            {/* EVIDENCE */}
            <TabsContent value="evidence" className="space-y-4">
              <Card>
                <CardHeader><CardTitle>Checklist</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {EVIDENCE_FIELDS.map((f) => (
                    <label key={f.key as string} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={!!claim[f.key]}
                        onCheckedChange={(v) => evidenceToggle(f.key, !!v)}
                      />
                      {f.label}
                    </label>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Upload</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2"><Label>Label</Label><Input value={uploadLabel} onChange={(e) => setUploadLabel(e.target.value)} placeholder="e.g. Front fork damage" /></div>
                    <div>
                      <Label>Type</Label>
                      <Select value={uploadKind} onValueChange={(v) => setUploadKind(v as any)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="photo">Photo</SelectItem>
                          <SelectItem value="document">Document</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Input type="file" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.currentTarget.value = ""; }} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Files ({evidence.length})</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {evidence.map((f) => (
                      <div key={f.id} className="border rounded p-2 space-y-1">
                        {f.kind === "photo" && evidenceUrls[f.id] ? (
                          <a href={evidenceUrls[f.id]} target="_blank" rel="noreferrer">
                            <img src={evidenceUrls[f.id]} alt={f.label ?? f.file_name} className="w-full h-32 object-cover rounded" />
                          </a>
                        ) : (
                          <a className="text-sm underline block truncate" href={evidenceUrls[f.id]} target="_blank" rel="noreferrer">{f.file_name}</a>
                        )}
                        <div className="text-xs truncate">{f.label ?? f.file_name}</div>
                        <Button size="sm" variant="ghost" className="text-destructive h-7 px-2" onClick={() => removeFile(f)}>
                          <Trash2 className="h-3 w-3 mr-1" /> Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ASSESSMENT */}
            <TabsContent value="assessment" className="space-y-4">
              <Card>
                <CardContent className="space-y-3 p-4">
                  <div>
                    <Label>Claim Type</Label>
                    <Select value={view.claim_kind ?? ""} onValueChange={(v) => setField("claim_kind", v)}>
                      <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="repair">Repair</SelectItem>
                        <SelectItem value="total_loss">Total Loss</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={!!view.assessor_appointed} onCheckedChange={(v) => setField("assessor_appointed", v)} />
                    <Label>Assessor appointed</Label>
                  </div>
                  {view.assessor_appointed && (
                    <div><Label>Assessor name</Label><Input value={view.assessor_name ?? ""} onChange={(e) => setField("assessor_name", e.target.value)} /></div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><Label>Repair Quote (£)</Label><Input type="number" step="0.01" value={view.repair_quote ?? ""} onChange={(e) => setField("repair_quote", e.target.value === "" ? null : Number(e.target.value))} /></div>
                    <div><Label>Market Value (£)</Label><Input type="number" step="0.01" value={view.market_value ?? ""} onChange={(e) => setField("market_value", e.target.value === "" ? null : Number(e.target.value))} /></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={!!view.betterment} onCheckedChange={(v) => setField("betterment", v)} />
                    <Label>Apply betterment deduction</Label>
                  </div>
                  {view.betterment && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><Label>Amount (£)</Label><Input type="number" step="0.01" value={view.betterment_amount ?? ""} onChange={(e) => setField("betterment_amount", e.target.value === "" ? null : Number(e.target.value))} /></div>
                      <div><Label>Reason</Label><Input value={view.betterment_reason ?? ""} onChange={(e) => setField("betterment_reason", e.target.value)} /></div>
                    </div>
                  )}
                  <Alert>
                    <AlertDescription>
                      <strong>T&amp;C cap:</strong> {cap == null ? "—" : fmtMoney(cap)} (lowest of repair / market / declared value)
                    </AlertDescription>
                  </Alert>
                  <div>
                    <Label>Recommended Settlement (£)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={view.recommended_settlement ?? (cap ?? "")}
                      onChange={(e) => setField("recommended_settlement", e.target.value === "" ? null : Number(e.target.value))}
                    />
                  </div>
                  {view.recommended_settlement != null && cap != null && Number(view.recommended_settlement) !== cap && (
                    <div><Label>Override reason (required when above cap)</Label><Textarea value={view.settlement_override_reason ?? ""} onChange={(e) => setField("settlement_override_reason", e.target.value)} /></div>
                  )}
                  {dirty && <Button onClick={saveDraft} className="bg-green-600 hover:bg-green-700 text-white">Save</Button>}
                </CardContent>
              </Card>
            </TabsContent>

            {/* SETTLEMENT */}
            <TabsContent value="settlement" className="space-y-4">
              <Card>
                <CardContent className="space-y-3 p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><Label>Offer Amount (£)</Label><Input type="number" step="0.01" value={view.offer_amount ?? ""} onChange={(e) => setField("offer_amount", e.target.value === "" ? null : Number(e.target.value))} /></div>
                    <div><Label>Date Offer Made</Label><Input type="date" value={view.offer_date ?? ""} onChange={(e) => setField("offer_date", e.target.value)} /></div>
                    <div>
                      <Label>Offer Accepted?</Label>
                      <Select value={view.offer_accepted ?? "pending"} onValueChange={(v) => setField("offer_accepted", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="yes">Yes</SelectItem>
                          <SelectItem value="no">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Payment Reference</Label><Input value={view.payment_reference ?? ""} onChange={(e) => setField("payment_reference", e.target.value)} /></div>
                  </div>
                  <div><Label>Settlement Notes</Label><Textarea value={view.settlement_notes ?? ""} onChange={(e) => setField("settlement_notes", e.target.value)} /></div>
                  {view.offer_amount != null && derived.declaredValue != null && Number(view.offer_amount) >= Number(derived.declaredValue) && (
                    <Alert>
                      <AlertDescription className="space-y-2">
                        <div>Full declared value paid — title transfer applies.</div>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox checked={!!view.title_transferred} onCheckedChange={(v) => setField("title_transferred", !!v)} />
                          Title transferred to Cycle Courier Co.
                        </label>
                      </AlertDescription>
                    </Alert>
                  )}
                  {dirty && <Button onClick={saveDraft} className="bg-green-600 hover:bg-green-700 text-white">Save</Button>}
                </CardContent>
              </Card>
            </TabsContent>

            {/* NOTES & HISTORY */}
            <TabsContent value="notes" className="space-y-4">
              <Card>
                <CardHeader><CardTitle>Add Note</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <Textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} rows={3} />
                  <div className="flex justify-end"><Button onClick={submitNote} disabled={!newNote.trim()}>Add Note</Button></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>History</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {timeline.length === 0 && <div className="text-sm text-muted-foreground">No activity yet.</div>}
                  {timeline.map((t, i) => (
                    <div key={i} className="border-l-2 pl-3 border-primary/50">
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(t.ts), "dd MMM yyyy HH:mm")} · {t.who ?? "—"} · {t.kind === "status" ? "Status" : "Note"}
                      </div>
                      <div className="text-sm">{t.text}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Offer modal */}
        <Dialog open={offerOpen} onOpenChange={setOfferOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Make Settlement Offer</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Offer Amount (£)</Label><Input type="number" step="0.01" value={offerForm.amount} onChange={(e) => setOfferForm((f) => ({ ...f, amount: e.target.value }))} /></div>
              <div><Label>Offer Date</Label><Input type="date" value={offerForm.date} onChange={(e) => setOfferForm((f) => ({ ...f, date: e.target.value }))} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOfferOpen(false)}>Cancel</Button>
              <Button
                onClick={async () => {
                  if (!offerForm.amount) { toast.error("Amount required"); return; }
                  await handleStatus("offer_made", {
                    offer_amount: Number(offerForm.amount),
                    offer_date: offerForm.date,
                    offer_accepted: "pending",
                  });
                  setOfferOpen(false);
                }}
              >Send Offer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default ClaimDetail;
