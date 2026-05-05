import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { CLAIM_STATUSES, type Claim, type ClaimStatus } from "@/services/claimsService";

const EVIDENCE_FIELDS: { key: keyof Claim; label: string }[] = [
  { key: "ev_booking_ref", label: "Booking reference" },
  { key: "ev_pre_collection_photos", label: "Pre-collection photos" },
  { key: "ev_delivery_photos", label: "Damage on delivery photos" },
  { key: "ev_full_bike_photos", label: "Full bike + damage area photos" },
  { key: "ev_proof_ownership", label: "Proof of ownership" },
  { key: "ev_proof_value", label: "Proof of value" },
  { key: "ev_upgrade_details", label: "Upgrade/custom parts details" },
  { key: "ev_repair_estimate", label: "Repair estimate" },
  { key: "ev_delivery_note", label: "Delivery / driver note" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  claim: Claim;
  nextStatus: ClaimStatus;
  onConfirm: (extra: Partial<Claim>, manualNote?: string) => Promise<void>;
}

const today = () => new Date().toISOString().slice(0, 10);

const ClaimAdvanceDialog = ({ open, onOpenChange, claim, nextStatus, onConfirm }: Props) => {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Partial<Claim>>({});
  const [manualNote, setManualNote] = useState("");

  useEffect(() => {
    if (!open) return;
    const seed: Partial<Claim> = {};
    if (nextStatus === "settlement_proposed") {
      seed.offer_amount = claim.offer_amount ?? claim.recommended_settlement ?? null;
      seed.offer_date = claim.offer_date ?? today();
      seed.offer_accepted = "pending";
    }
    if (nextStatus === "settlement_agreed") {
      seed.offer_accepted = "yes";
      seed.payment_reference = claim.payment_reference ?? "";
      seed.offer_amount = claim.offer_amount ?? null;
    }
    if (nextStatus === "assessment") {
      seed.claim_kind = claim.claim_kind ?? "repair";
      seed.repair_quote = claim.repair_quote ?? null;
      seed.market_value = claim.market_value ?? null;
      seed.assessor_appointed = claim.assessor_appointed ?? false;
      seed.assessor_name = claim.assessor_name ?? "";
    }
    if (nextStatus === "negotiation") {
      seed.offer_amount = claim.offer_amount ?? null;
      seed.offer_accepted = "no";
    }
    setForm(seed);
    setManualNote("");
  }, [open, nextStatus, claim]);

  const set = <K extends keyof Claim>(k: K, v: Claim[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const stepLabel =
    CLAIM_STATUSES.find((s) => s.value === nextStatus)?.label ?? nextStatus;

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm(form, manualNote.trim() || undefined);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  const renderBody = () => {
    switch (nextStatus) {
      case "info_requested":
        return (
          <>
            <p className="text-sm text-muted-foreground">
              Tick the items you are requesting from the customer.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EVIDENCE_FIELDS.map((f) => (
                <label key={f.key as string} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={!!(form[f.key] ?? claim[f.key])}
                    onCheckedChange={(v) => set(f.key, !!v as any)}
                  />
                  {f.label}
                </label>
              ))}
            </div>
            <div>
              <Label>Message / internal note (optional)</Label>
              <Textarea
                rows={3}
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                placeholder="e.g. Please send timestamped photos of the damaged area."
              />
            </div>
          </>
        );

      case "info_provided":
        return (
          <>
            <p className="text-sm text-muted-foreground">
              Tick everything the customer has supplied so far.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EVIDENCE_FIELDS.map((f) => (
                <label key={f.key as string} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={!!(form[f.key] ?? claim[f.key])}
                    onCheckedChange={(v) => set(f.key, !!v as any)}
                  />
                  {f.label}
                </label>
              ))}
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                rows={3}
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                placeholder="Anything still missing or noteworthy…"
              />
            </div>
          </>
        );

      case "assessment":
        return (
          <>
            <div className="flex items-center gap-2">
              <Switch
                checked={!!form.assessor_appointed}
                onCheckedChange={(v) => set("assessor_appointed", v)}
              />
              <Label>Assessor appointed</Label>
            </div>
            {form.assessor_appointed && (
              <div>
                <Label>Assessor name</Label>
                <Input
                  value={(form.assessor_name as string) ?? ""}
                  onChange={(e) => set("assessor_name", e.target.value)}
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Repair quote (£)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={(form.repair_quote as number | null) ?? ""}
                  onChange={(e) =>
                    set("repair_quote", e.target.value === "" ? null : Number(e.target.value))
                  }
                />
              </div>
              <div>
                <Label>Market value (£)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={(form.market_value as number | null) ?? ""}
                  onChange={(e) =>
                    set("market_value", e.target.value === "" ? null : Number(e.target.value))
                  }
                />
              </div>
            </div>
            <div>
              <Label>Assessment notes (optional)</Label>
              <Textarea
                rows={3}
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                placeholder="Findings, recommended outcome…"
              />
            </div>
          </>
        );

      case "settlement_proposed":
        return (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Offer amount (£) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={(form.offer_amount as number | null) ?? ""}
                  onChange={(e) =>
                    set("offer_amount", e.target.value === "" ? null : Number(e.target.value))
                  }
                />
              </div>
              <div>
                <Label>Offer date</Label>
                <Input
                  type="date"
                  value={(form.offer_date as string) ?? today()}
                  onChange={(e) => set("offer_date", e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Settlement notes (optional)</Label>
              <Textarea
                rows={3}
                value={(form.settlement_notes as string) ?? ""}
                onChange={(e) => set("settlement_notes", e.target.value)}
                placeholder="Basis of the offer, any conditions…"
              />
            </div>
          </>
        );

      case "negotiation":
        return (
          <>
            <p className="text-sm text-muted-foreground">
              Capture the customer's response and any counter-offer.
            </p>
            <div>
              <Label>Latest amount under discussion (£)</Label>
              <Input
                type="number"
                step="0.01"
                value={(form.offer_amount as number | null) ?? ""}
                onChange={(e) =>
                  set("offer_amount", e.target.value === "" ? null : Number(e.target.value))
                }
              />
            </div>
            <div>
              <Label>Negotiation note *</Label>
              <Textarea
                rows={4}
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                placeholder="e.g. Customer rejected £450, requested £600 citing receipts."
              />
            </div>
          </>
        );

      case "settlement_agreed":
        return (
          <>
            <div>
              <Label>Agreed amount (£)</Label>
              <Input
                type="number"
                step="0.01"
                value={(form.offer_amount as number | null) ?? ""}
                onChange={(e) =>
                  set("offer_amount", e.target.value === "" ? null : Number(e.target.value))
                }
              />
            </div>
            <div>
              <Label>Payment reference (optional)</Label>
              <Input
                value={(form.payment_reference as string) ?? ""}
                onChange={(e) => set("payment_reference", e.target.value)}
                placeholder="Bank ref / transaction ID"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={!!form.title_transferred}
                onCheckedChange={(v) => set("title_transferred", !!v as any)}
              />
              Title transferred to Cycle Courier Co. (if applicable)
            </label>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                rows={3}
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
              />
            </div>
          </>
        );

      case "closed":
        return (
          <>
            <p className="text-sm text-muted-foreground">
              Confirm the case is fully resolved and ready to close.
            </p>
            <div>
              <Label>Closing remarks (optional)</Label>
              <Textarea
                rows={4}
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                placeholder="Final outcome summary…"
              />
            </div>
          </>
        );

      default:
        return (
          <div>
            <Label>Note (optional)</Label>
            <Textarea
              rows={3}
              value={manualNote}
              onChange={(e) => setManualNote(e.target.value)}
            />
          </div>
        );
    }
  };

  const canConfirm = (() => {
    if (nextStatus === "settlement_proposed") {
      const a = form.offer_amount;
      return a != null && !Number.isNaN(Number(a));
    }
    if (nextStatus === "negotiation") {
      return manualNote.trim().length > 0;
    }
    return true;
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Advance to: {stepLabel}</DialogTitle>
          <DialogDescription>
            Fill in the details for this step. A system note will be added automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">{renderBody()}</div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm || busy}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {busy ? "Saving…" : `Confirm: ${stepLabel}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ClaimAdvanceDialog;
