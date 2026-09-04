import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, FileCheck, ExternalLink, Ship, ArrowRightLeft, Phone } from "lucide-react";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { toPublicFileUrl } from "@/lib/publicFileUrl";
import { CITY_AIR_EXPRESS } from "@/constants/depot";

interface PartnerJob {
  id: string;
  tracking_number: string | null;
  direction: "inbound" | "outbound";
  bike_brand: string | null;
  bike_model: string | null;
  bike_quantity: number | null;
  party: {
    name: string | null;
    phone: string | null;
    address: Record<string, string> | null;
  };
  bfs_number: string | null;
  label_url: string | null;
  label_uploaded_at: string | null;
}

const formatAddress = (address?: Record<string, string> | null) => {
  if (!address) return "—";
  return [address.street, address.city, address.state, address.zipCode, address.country]
    .filter(Boolean)
    .join(", ");
};

const formatPhone = (phone?: string | null) => {
  if (!phone) return null;
  return phone.replace(/^\+44\s*/, "0");
};

const ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];
const MAX_MB = 10;
const MAX_BYTES = MAX_MB * 1024 * 1024;

export default function NiPartnerUpload() {
  const { orderId } = useParams<{ orderId: string }>();
  const [job, setJob] = useState<PartnerJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [bfs, setBfs] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [labelUrl, setLabelUrl] = useState<string | null>(null);
  const [bfsSaved, setBfsSaved] = useState<string | null>(null);
  const [signedLabelUrl, setSignedLabelUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    Promise.resolve(
      supabase.rpc("get_ni_partner_job", { p_order_id: orderId })
    )
      .then(({ data, error }) => {
        if (error || !data) {
          setNotFound(true);
        } else {
          const j = data as unknown as PartnerJob;
          setJob(j);
          setBfs(j.bfs_number || "");
          setBfsSaved(j.bfs_number || null);
          if (j.label_url) {
            setLabelUrl(j.label_url);
          }
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));

  }, [orderId]);

  useEffect(() => {
    if (!labelUrl) {
      setSignedLabelUrl(null);
      return;
    }
    let cancelled = false;
    Promise.resolve(
      supabase.storage
        .from("foam-my-bike-labels")
        .createSignedUrl(labelUrl, 60 * 30)
    ).then(({ data, error }) => {
      if (cancelled) return;
      setSignedLabelUrl(error ? null : toPublicFileUrl(data?.signedUrl || null));
    });

    return () => {
      cancelled = true;
    };
  }, [labelUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    if (!f) return;
    if (!ALLOWED_TYPES.includes(f.type)) {
      toast.error("Please upload a PDF, PNG, JPEG or WebP image");
      setFile(null);
      e.target.value = "";
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.error(`Label must be under ${MAX_MB} MB`);
      setFile(null);
      e.target.value = "";
      return;
    }
    setFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId) return;
    if (!bfs.trim() && !file && !labelUrl) {
      toast.error("Please enter a BFS number or upload a label");
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("orderId", orderId);
      form.append("bfsNumber", bfs.trim());
      if (file) form.append("label", file);

      const { data, error } = await supabase.functions.invoke("ni-partner-label-upload", {
        body: form,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Update failed");

      setBfsSaved(data.bfsNumber || bfs.trim() || null);
      if (data.labelUrl) {
        setLabelUrl(data.labelUrl);
      }
      toast.success("Label and BFS number saved");
    } catch (err: any) {
      console.error("Partner upload failed", err);
      toast.error(err?.message || "Could not save — please try again");
    } finally {
      setSubmitting(false);
    }
  };

  const directionLabel =
    job?.direction === "inbound"
      ? "From Northern Ireland to mainland"
      : "To Northern Ireland";

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-2">
              <Ship className="h-5 w-5 text-primary" />
              <CardTitle>Northern Ireland partner upload</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              For {CITY_AIR_EXPRESS.name} — upload the shipping label and BFS consignment number.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-8">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading job details…
              </div>
            ) : notFound || !job ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">This link is no longer valid or the order is not a Northern Ireland job.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <ArrowRightLeft className="h-3 w-3" />
                    {directionLabel}
                  </Badge>
                  {job.tracking_number && (
                    <Badge variant="outline">Tracking: {job.tracking_number}</Badge>
                  )}
                </div>

                <div className="rounded-lg border bg-card p-4 space-y-2 text-sm">
                  <p>
                    <strong>Item:</strong>{" "}
                    {[job.bike_brand, job.bike_model].filter(Boolean).join(" ") || "Bicycle"}
                  </p>
                  <p>
                    <strong>Quantity:</strong> {job.bike_quantity || 1}
                  </p>
                  <div className="pt-2 border-t">
                    <p className="font-medium mb-1">Customer details</p>
                    <p>{job.party.name || "—"}</p>
                    <p className="text-muted-foreground">{formatAddress(job.party.address)}</p>
                    {job.party.phone && (
                      <p className="flex items-center gap-1 mt-1 text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        {formatPhone(job.party.phone)}
                      </p>
                    )}
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="bfs">BFS consignment number</Label>
                    <Input
                      id="bfs"
                      value={bfs}
                      onChange={(e) => setBfs(e.target.value)}
                      placeholder="e.g. BFS12345678"
                      disabled={submitting}
                    />
                    {bfsSaved && bfsSaved === bfs && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <FileCheck className="h-3 w-3" />
                        Saved: {bfsSaved}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="label">Shipping label</Label>
                    <Input
                      id="label"
                      type="file"
                      accept="application/pdf,image/png,image/jpeg,image/webp"
                      onChange={handleFileChange}
                      disabled={submitting}
                    />
                    <p className="text-xs text-muted-foreground">
                      PDF, PNG, JPEG or WebP, up to {MAX_MB} MB.
                    </p>
                    {file && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <FileCheck className="h-3 w-3" />
                        Selected: {file.name}
                      </p>
                    )}
                    {signedLabelUrl && (
                      <a
                        href={signedLabelUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-primary underline flex items-center gap-1"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        View uploaded label
                      </a>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={
                      submitting ||
                      (!bfs.trim() && !file && !labelUrl)
                    }
                    className="w-full sm:w-auto"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    {submitting ? "Saving…" : "Upload label / save BFS number"}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
