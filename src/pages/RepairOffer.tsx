import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Loader2, Wrench } from "lucide-react";
import { toast } from "sonner";
import {
  fetchPublicRepairOffer,
  submitPublicRepairOffer,
  type PublicRepairOffer,
} from "@/services/inspectionService";

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
      <Layout>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!offer?.found) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-12">
          <Card>
            <CardHeader>
              <CardTitle>Repair offer not found</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              <p>We couldn't find this repair offer. Please check the link in your email or message.</p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const alreadyResponded = submitted || (offered.length === 0 && !!offer.responded_at);

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold break-words">Optional repairs for {bike}</h1>
          {offer.tracking_number && (
            <p className="text-sm text-muted-foreground break-all">Job #{offer.tracking_number}</p>
          )}
        </div>

        {alreadyResponded ? (
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center gap-2 text-emerald-600 font-medium">
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wrench className="h-4 w-4 text-courier-600 shrink-0" />
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
                      className="flex items-start gap-3 rounded-md border p-3 cursor-pointer"
                    >
                      <Checkbox
                        checked={!!selected[i.id]}
                        onCheckedChange={(v) =>
                          setSelected((prev) => ({ ...prev, [i.id]: v === true }))
                        }
                        className="mt-0.5"
                      />
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="block break-words">{i.description}</span>
                        <span className="block text-muted-foreground">
                          {money(Number(i.cost || 0))}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                <p className="mt-3 text-sm">
                  Selected total: <span className="font-semibold">{money(selectedTotal)}</span>
                  {offered.length > 1 && (
                    <span className="text-muted-foreground"> (all repairs: {money(offeredTotal)})</span>
                  )}
                </p>
              </div>

              <p className="text-xs text-muted-foreground">
                Any repairs you approve here are paid by you directly, not by the seller. We'll be in
                touch about payment before your bike is delivered.
              </p>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={() => handleSubmit(false)}
                  disabled={submitting || selectedTotal === 0}
                  className="w-full sm:w-auto"
                >
                  {submitting ? "Sending..." : "Approve selected repairs"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleSubmit(true)}
                  disabled={submitting}
                  className="w-full sm:w-auto"
                >
                  Approve all ({money(offeredTotal)})
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => handleSubmit(false)}
                  disabled={submitting}
                  className="w-full sm:w-auto"
                >
                  No thanks
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
