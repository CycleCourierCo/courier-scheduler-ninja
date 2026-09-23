import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, FileText, Loader2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { toPublicFileUrl } from "@/lib/publicFileUrl";
import {
  fetchPublicInspectionApproval,
  submitPublicInspectionApproval,
} from "@/services/inspectionService";
import DoorstepShell from "@/components/design/DoorstepShell";

const money = (n: number) => `£${Number(n || 0).toFixed(2)}`;

interface ApprovalIssue {
  id: string;
  issue_description: string;
  estimated_cost: number | null;
  status: string;
  customer_response: string | null;
  offered_to_receiver_at?: string | null;
  receiver_approved_at?: string | null;
  receiver_declined_at?: string | null;
}

interface ApprovalData {
  error?: string;
  inspection_id?: string;
  order_id?: string | null;
  status?: string;
  awaiting_receiver_count?: number;
  customer_name?: string | null;
  bike?: string | null;
  frame_size?: string | null;
  reference?: string | null;
  report_url?: string | null;
  issues?: ApprovalIssue[];
}

export default function InspectionApproval() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<ApprovalData | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [approvedNow, setApprovedNow] = useState<ApprovalIssue[]>([]);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    fetchPublicInspectionApproval(id)
      .then((res) => setData(res as ApprovalData))
      .catch((err) => {
        console.error("Error loading inspection approval:", err);
        toast.error("We couldn't load this approval request");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const issues = data?.issues ?? [];
  const pending = useMemo(() => issues.filter((i) => (i.status || "pending") === "pending"), [issues]);
  const alreadyApproved = useMemo(
    () => issues.filter((i) => ["approved", "repaired", "resolved"].includes(i.status)),
    [issues]
  );

  const selectedTotal = useMemo(
    () => pending.filter((i) => selected[i.id]).reduce((s, i) => s + Number(i.estimated_cost || 0), 0),
    [pending, selected]
  );
  const pendingTotal = useMemo(
    () => pending.reduce((s, i) => s + Number(i.estimated_cost || 0), 0),
    [pending]
  );

  const bike = data?.bike || "your bike";
  const reportUrl = toPublicFileUrl(data?.report_url ?? null);

  const handleSubmit = async (approveAll: boolean) => {
    if (!id) return;
    const chosen = approveAll ? pending : pending.filter((i) => selected[i.id]);
    setSubmitting(true);
    try {
      const result = await submitPublicInspectionApproval(id, chosen.map((i) => i.id));
      if (!result?.success) throw new Error(result?.error || "submit failed");
      setApprovedNow(chosen);
      setSubmitted(true);
      toast.success(
        chosen.length > 0
          ? "Thanks — we'll get those repairs booked in"
          : "Thanks — we won't carry out any repairs"
      );
    } catch (err) {
      console.error("Error submitting inspection approval:", err);
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

  if (!data || data.error) {
    return (
      <DoorstepShell title="Approval request not found">
        <p className="text-muted-foreground">We couldn't find this approval request. Check the link in your email, or contact us.</p>
      </DoorstepShell>
    );
  }

  const done = submitted || pending.length === 0;

  return (
    <DoorstepShell title="Repairs for your bike" reference={data.reference ?? undefined}>
        <p className="doorstep-data break-words">{bike}{data.frame_size ? ` · ${data.frame_size}` : ""}</p>
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

        {done ? (
          <Card className="border-status-done">
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center gap-2 font-medium text-status-done">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                Thanks — your choice has been recorded
              </div>
              {(approvedNow.length > 0 ? approvedNow : alreadyApproved).length > 0 ? (
                <div className="text-sm">
                  <p className="font-medium mb-1">We'll carry out:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    {(approvedNow.length > 0 ? approvedNow : alreadyApproved).map((i) => (
                      <li key={i.id} className="break-words">
                        {i.issue_description} — {money(Number(i.estimated_cost || 0))}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-muted-foreground">
                    We'll send you an invoice for the work and be in touch when the bike is ready.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No repairs will be carried out. We'll be in touch about collecting the bike.
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
              <p className="text-sm text-muted-foreground">
                Tick the repairs you'd like us to carry out. Anything you don't tick won't be done.
              </p>

              <div className="space-y-2">
                {pending.map((i) => (
                  <label
                    key={i.id}
                    className="flex min-h-14 cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-accent"
                  >
                    <Checkbox
                      checked={!!selected[i.id]}
                      onCheckedChange={(v) => setSelected((prev) => ({ ...prev, [i.id]: v === true }))}
                      className="mt-0.5"
                    />
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                      <span className="block break-words">{i.issue_description}</span>
                      <span className="data-text block shrink-0">
                        {money(Number(i.estimated_cost || 0))}
                      </span>
                    </span>
                  </label>
                ))}
              </div>

              <p className="flex items-baseline justify-between border-t pt-4">
                <span>Selected total</span> <span className="doorstep-data">{money(selectedTotal)}</span>
                {pending.length > 1 && (
                  <span className="text-muted-foreground"> (all repairs: {money(pendingTotal)})</span>
                )}
              </p>

              <p className="text-xs text-muted-foreground">
                Prices include VAT. We'll send an invoice for anything you approve.
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
                  Approve all ({money(pendingTotal)})
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
