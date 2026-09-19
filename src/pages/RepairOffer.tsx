import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, FileText, Loader2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { toPublicFileUrl } from "@/lib/publicFileUrl";
import {
  fetchPublicRepairOffer,
  submitPublicRepairOffer,
  type PublicRepairOffer,
} from "@/services/inspectionService";
import DoorstepShell from "@/components/design/DoorstepShell";

const money = (n: number) => `£${Number(n || 0).toFixed(2)}`;

export default function RepairOffer() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [offer, setOffer] = useState<PublicRepairOffer | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    fetchPublicRepairOffer(id)
      .then((data) => setOffer(data))
      .catch((err) => {
        console.error("Error loading repair offer:", err);
        toast.error("We couldn't load this repair offer");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const offered = offer?.offered ?? [];
  const approved = offer?.approved ?? [];
  const receiverApproved = offer?.receiver_approved ?? [];

  const selectedTotal = useMemo(
    () => offered.filter((i) => selected[i.id]).reduce((s, i) => s + Number(i.cost || 0), 0),
    [offered, selected]
  );
  const offeredTotal = useMemo(
    () => offered.reduce((s, i) => s + Number(i.cost || 0), 0),
    [offered]
  );

  const bike = [offer?.bike_brand, offer?.bike_model].filter(Boolean).join(" ") || "your bike";

  const handleSubmit = async (approveAll: boolean) => {
    if (!id) return;
    const ids = approveAll ? offered.map((i) => i.id) : offered.filter((i) => selected[i.id]).map((i) => i.id);
    setSubmitting(true);
    try {
      const result = await submitPublicRepairOffer(id, ids);
      if (!result?.success) throw new Error(result?.error || "submit failed");
      setSubmitted(true);
      toast.success(
        ids.length > 0
          ? "Thanks — we'll get those repairs booked in"
          : "Thanks — we won't carry out any extra repairs"
      );
    } catch (err) {
      console.error("Error submitting repair offer:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="doorstep-page flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!offer?.found) {
    return (
      <DoorstepShell title="Repair offer not found">
        <p className="text-muted-foreground">We couldn't find this repair offer. Check the link in your email or message, or contact us.</p>
      </DoorstepShell>
    );
  }

  const alreadyResponded = submitted || (offered.length === 0 && !!offer.responded_at);

  const reportUrl = toPublicFileUrl(offer.report_url ?? null);

  return (
    <DoorstepShell title="Repairs for your bike" reference={offer.tracking_number ?? undefined}>
        <p className="doorstep-data break-words">{bike}</p>
        <p className="text-muted-foreground">Our mechanic found the following. Approve what you'd like us to do.</p>

        {reportUrl && (
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => window.open(reportUrl, "_blank", "noopener")}
          >
            <FileText className="h-4 w-4 mr-2" />
            View inspection report (PDF)
          </Button>
        )}


        {alreadyResponded ? (
          <Card className="border-status-done">
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center gap-2 font-medium text-status-done">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                Thanks — your choice has been recorded
              </div>
              {receiverApproved.length > 0 ? (
                <div className="text-sm">
                  <p className="font-medium mb-1">We'll carry out:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    {receiverApproved.map((i) => (
                      <li key={i.id} className="break-words">
                        {i.description} — {money(Number(i.cost || 0))}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-muted-foreground">
                    We'll be in touch about payment before your bike is delivered.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No extra repairs will be carried out. Your bike will be delivered as it is.
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wrench className="h-4 w-4 shrink-0 text-primary" />
                Our workshop found work this bike needs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                {approved.length > 0 ? (
                  <>
                    <p className="text-sm font-medium mb-2">
                      The customer has approved the following repairs:
                    </p>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      {approved.map((i) => (
                        <li key={i.id} className="break-words">{i.description}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-sm font-medium">
                    The customer hasn't approved any of the recommended repairs.
                  </p>
                )}
              </div>

              <Separator />

              <div>
                <p className="text-sm font-medium mb-1">…but has not approved the following:</p>
                <p className="text-sm text-muted-foreground mb-3">
                  Would you like us to do those repairs while we still have the bike?
                </p>
                <div className="space-y-2">
                  {offered.map((i) => (
                    <label
                      key={i.id}
                      className="flex min-h-14 cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-accent"
                    >
                      <Checkbox
                        checked={!!selected[i.id]}
                        onCheckedChange={(v) =>
                          setSelected((prev) => ({ ...prev, [i.id]: v === true }))
                        }
                        className="mt-0.5"
                      />
                      <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                        <span className="block break-words">{i.description}</span>
                        <span className="data-text block shrink-0">
                          {money(Number(i.cost || 0))}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                <p className="mt-4 flex items-baseline justify-between border-t pt-4">
                  <span>Selected total</span> <span className="doorstep-data">{money(selectedTotal)}</span>
                  {offered.length > 1 && (
                    <span className="text-muted-foreground"> (all repairs: {money(offeredTotal)})</span>
                  )}
                </p>
              </div>

              <p className="text-xs text-muted-foreground">
                Any repairs you approve here are paid by you directly, not by the seller. We'll be in
                touch about payment before your bike is delivered.
              </p>

              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => handleSubmit(false)}
                  disabled={submitting || selectedTotal === 0}
                  variant="doorstep"
                >
                  {submitting ? "Sending..." : "Approve selected repairs"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleSubmit(true)}
                  disabled={submitting}
                  className="h-14 w-full"
                >
                  Approve all ({money(offeredTotal)})
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => handleSubmit(false)}
                  disabled={submitting}
                  className="h-14 w-full"
                >
                  No thanks
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
    </DoorstepShell>
  );
}
