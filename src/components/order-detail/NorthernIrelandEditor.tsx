import React from "react";
import { toast } from "sonner";
import { Ship, Loader2, Mail, Upload, FileCheck, ExternalLink, Copy, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { CITY_AIR_EXPRESS } from "@/constants/depot";
import { isNorthernIrelandAddress } from "@/utils/northernIreland";
import { getNiDirection } from "@/utils/niDelivery";
import { createShipdayOrder } from "@/services/shipdayService";
import { FOAM_STATUS_LABELS, FoamStatus, Order } from "@/types/order";
import { toPublicFileUrl } from "@/lib/publicFileUrl";
import { getPublicAppUrl } from "@/lib/publicAppUrl";


interface Props {
  order: Order & Record<string, any>;
  onUpdate: () => void;
  /** Render without the outer card chrome (used inside the Services panel) */
  bare?: boolean;
}

const BLOCKED_STATUSES = ["delivered", "delivered_by_3p", "cancelled"];

const NorthernIrelandEditor: React.FC<Props> = ({ order, onUpdate, bare = false }) => {
  const [working, setWorking] = React.useState(false);
  const [sendingFerryEmail, setSendingFerryEmail] = React.useState(false);
  const [ferryNotifiedAt, setFerryNotifiedAt] = React.useState<string | null>(
    ((order as any).ferryPartnerNotifiedAt ?? (order as any).ferry_partner_notified_at ?? null) as
      | string
      | null
  );
  const [bfsInput, setBfsInput] = React.useState(
    (order as any).niBfsNumber ?? (order as any).ni_bfs_number ?? ""
  );
  const [savingBfs, setSavingBfs] = React.useState(false);
  const [uploadingLabel, setUploadingLabel] = React.useState(false);
  const [labelPath, setLabelPath] = React.useState<string | null>(
    (order as any).niPartnerLabelUrl ?? (order as any).ni_partner_label_url ?? null
  );
  const [labelUploadedAt, setLabelUploadedAt] = React.useState<string | null>(
    (order as any).niPartnerLabelUploadedAt ?? (order as any).ni_partner_label_uploaded_at ?? null
  );
  const [signedLabelUrl, setSignedLabelUrl] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!labelPath) {
      setSignedLabelUrl(null);
      return;
    }
    let cancelled = false;
    Promise.resolve(
      supabase.storage.from("foam-my-bike-labels").createSignedUrl(labelPath, 60 * 30)
    ).then(({ data, error }) => {
      if (cancelled) return;
      setSignedLabelUrl(error ? null : toPublicFileUrl(data?.signedUrl || null));
    });
    return () => {
      cancelled = true;
    };
  }, [labelPath]);


  const resendFerryEmail = async () => {
    setSendingFerryEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-ferry-partner-notification", {
        body: { orderId: order.id },
      });
      if (error) throw error;
      setFerryNotifiedAt((data as any)?.notifiedAt || new Date().toISOString());
      toast.success(`Booking email sent to ${CITY_AIR_EXPRESS.email}`);
      onUpdate();
    } catch (e: any) {
      console.error("Ferry partner email resend failed", e);
      toast.error(e?.message || "Could not send the ferry partner email");
    } finally {
      setSendingFerryEmail(false);
    }
  };


  const partnerUploadUrl = `${getPublicAppUrl()}/ni-partner/${order.id}`;

  const copyUploadLink = async () => {
    try {
      await navigator.clipboard.writeText(partnerUploadUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy link");
    }
  };

  const saveBfsNumber = async () => {
    setSavingBfs(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("orders")
        .update({ ni_bfs_number: bfsInput.trim() || null, ni_bfs_updated_at: now })
        .eq("id", order.id);
      if (error) throw error;
      toast.success("BFS number saved");
    } catch (e: any) {
      console.error("BFS save failed", e);
      toast.error(e?.message || "Could not save BFS number");
    } finally {
      setSavingBfs(false);
    }
  };

  const ALLOWED_LABEL_TYPES = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
  ];
  const LABEL_MAX_BYTES = 10 * 1024 * 1024;

  const uploadPartnerLabel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ALLOWED_LABEL_TYPES.includes(f.type)) {
      toast.error("Label must be a PDF, PNG, JPEG or WebP image");
      e.target.value = "";
      return;
    }
    if (f.size > LABEL_MAX_BYTES) {
      toast.error("Label must be under 10 MB");
      e.target.value = "";
      return;
    }
    setUploadingLabel(true);
    try {
      const ext = f.type === "application/pdf" ? "pdf" : f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : "jpg";
      const safeName = (f.name || `label.${ext}`).replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^[-.]+|[-.]+$/g, "").slice(0, 80) || `label.${ext}`;
      const path = `partner/${order.id}/${crypto.randomUUID().slice(0, 8)}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("foam-my-bike-labels")
        .upload(path, f, { contentType: f.type, upsert: false });
      if (uploadError) throw uploadError;

      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("orders")
        .update({ ni_partner_label_url: path, ni_partner_label_uploaded_at: now })
        .eq("id", order.id);
      if (updateError) throw updateError;

      setLabelPath(path);
      setLabelUploadedAt(now);
      toast.success("Partner label uploaded");
    } catch (e: any) {
      console.error("Label upload failed", e);
      toast.error(e?.message || "Label upload failed");
    } finally {
      setUploadingLabel(false);
      e.target.value = "";
    }
  };

  const isNI = Boolean((order as any).isNorthernIreland ?? (order as any).is_northern_ireland);

  const foamStatus = ((order as any).foamStatus ?? (order as any).foam_status) as FoamStatus | null;
  const receiverAddress = order.receiver?.address;
  const senderAddress = order.sender?.address;
  // Which end of the journey is in Northern Ireland decides the whole flow:
  // outbound = we hand the bike over at the ferry, inbound = we collect it there.
  const storedDirection = getNiDirection(order);
  const looksOutbound = isNorthernIrelandAddress(receiverAddress as any);
  const looksInbound = !looksOutbound && isNorthernIrelandAddress(senderAddress as any);
  const direction: "outbound" | "inbound" =
    (isNI ? storedDirection : null) ?? (looksInbound ? "inbound" : "outbound");
  const isInbound = direction === "inbound";
  const looksNI = looksOutbound || looksInbound;
  const ferryLeg: "pickup" | "delivery" = isInbound ? "pickup" : "delivery";
  const blocked = BLOCKED_STATUSES.includes(String(order.status));

  const deliveryScheduled = Boolean(
    (order as any).scheduledDeliveryDate || (order as any).scheduled_delivery_date
  );
  const deliveryDriver =
    (order as any).deliveryDriverName || (order as any).delivery_driver_name || null;

  const rerouteFerryLeg = async (markAsNI: boolean) => {
    // Only the leg that touches the ferry is re-created; the other leg is untouched.
    const idColumn = isInbound ? "shipday_pickup_id" : "shipday_delivery_id";
    const { data: row } = await supabase
      .from("orders")
      .select(idColumn)
      .eq("id", order.id)
      .maybeSingle();

    const shipdayId = (row as any)?.[idColumn];
    if (shipdayId) {
      const { error } = await supabase.functions.invoke("delete-shipday-order", {
        body: isInbound ? { shipdayPickupId: shipdayId } : { shipdayDeliveryId: shipdayId },
      });
      if (error) throw new Error(error.message);
      await supabase
        .from("orders")
        .update({ [idColumn]: null } as any)
        .eq("id", order.id);
    }

    await createShipdayOrder(order.id, ferryLeg, markAsNI);
  };

  const applyChange = async (markAsNI: boolean) => {
    setWorking(true);
    let flagged = false;
    try {
      const now = new Date().toISOString();
      const patch: Record<string, any> = markAsNI
        ? {
            is_northern_ireland: true,
            ni_direction: direction,
            destination_region: isInbound ? null : "Northern Ireland",
            // Inbound bikes arrive already packed, so they skip the foam pipeline.
            foam_status: isInbound ? null : "pending_collection",
            foam_pending_collection_at: isInbound ? null : now,
            updated_at: now,
          }
        : {
            is_northern_ireland: false,
            ni_direction: null,
            destination_region: null,
            foam_status: null,
            foam_pending_collection_at: null,
            foam_pending_foaming_at: null,
            foam_foamed_at: null,
            foam_delivered_to_ferry_at: null,
            foam_delivered_ni_at: null,
            updated_at: now,
          };

      const { data: updated, error } = await supabase
        .from("orders")
        .update(patch)
        .eq("id", order.id)
        .select("id, is_northern_ireland, foam_status")
        .maybeSingle();
      if (error) throw error;
      if (!updated) {
        throw new Error(
          "The order could not be updated — you may not have permission to change this order."
        );
      }
      if (Boolean((updated as any).is_northern_ireland) !== markAsNI) {
        throw new Error(
          "The Northern Ireland flag did not save correctly. Shipday was left untouched — please retry."
        );
      }
      flagged = true;

      await rerouteFerryLeg(markAsNI);


      toast.success(
        markAsNI
          ? (isInbound
            ? "Marked as an inbound Northern Ireland order — collection re-routed to the ferry hand-off"
            : "Marked as a Northern Ireland delivery and re-routed to the ferry hand-off")
          : `Northern Ireland flag removed and ${ferryLeg === "pickup" ? "collection" : "delivery"} restored to the customer address`
      );
      onUpdate();
    } catch (e: any) {
      console.error("NI flag update failed", e);
      if (flagged) {
        toast.error(
          `Flag updated, but the Shipday delivery job could not be re-created (${e?.message || "unknown error"}). Please re-create it manually from scheduling.`
        );
        onUpdate();
      } else {
        toast.error(e?.message || "Could not update the Northern Ireland flag");
      }
    } finally {
      setWorking(false);
    }
  };

  const Shell = ({ children }: { children: React.ReactNode }) =>
    bare ? <div>{children}</div> : <Card>{children}</Card>;

  return (
    <Shell>
      {!bare && (
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Ship className="h-4 w-4" /> Northern Ireland {isInbound ? "collection" : "delivery"}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className={bare ? "space-y-3 p-0" : "space-y-3"}>
        {isNI ? (
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-emerald-600 hover:bg-emerald-600">
                {isInbound ? "Northern Ireland collection (inbound)" : "Northern Ireland delivery"}
              </Badge>
              {foamStatus && (
                <Badge variant="outline">{FOAM_STATUS_LABELS[foamStatus] || foamStatus}</Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {isInbound
                ? `The ferry partner collects in Northern Ireland and we collect from the ferry port, ${CITY_AIR_EXPRESS.formatted}. No foaming is needed — the bike arrives packed.`
                : `Delivery is handed over at the ferry port, ${CITY_AIR_EXPRESS.formatted}.`}{" "}
              A £120 per-bike surcharge applies at invoicing.
            </p>
            <div className="space-y-1">
              <Button
                variant="outline"
                size="sm"
                onClick={resendFerryEmail}
                disabled={sendingFerryEmail}
              >
                {sendingFerryEmail ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4 mr-2" />
                )}
                Resend ferry partner email
              </Button>
              <p className="text-xs text-muted-foreground">
                {ferryNotifiedAt
                  ? `Last sent ${new Date(ferryNotifiedAt).toLocaleString("en-GB")} to ${CITY_AIR_EXPRESS.email}`
                  : `Not recorded as sent yet — sends the booking details to ${CITY_AIR_EXPRESS.email}`}
              </p>
            </div>
            <div className="rounded border bg-muted/30 p-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">Partner upload link</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={copyUploadLink}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 mr-1" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
                <div className="space-y-1">
                  <Label htmlFor={`bfs-${order.id}`} className="text-xs">
                    BFS consignment number
                  </Label>
                  <Input
                    id={`bfs-${order.id}`}
                    value={bfsInput}
                    onChange={(e) => setBfsInput(e.target.value)}
                    placeholder="e.g. BFS12345678"
                    disabled={savingBfs}
                    className="h-8"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={saveBfsNumber}
                  disabled={savingBfs}
                >
                  {savingBfs && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save
                </Button>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`label-${order.id}`} className="text-xs">
                  Partner shipping label
                </Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    id={`label-${order.id}`}
                    type="file"
                    accept="application/pdf,image/png,image/jpeg,image/webp"
                    onChange={uploadPartnerLabel}
                    disabled={uploadingLabel}
                    className="h-8 text-sm py-1 flex-1 min-w-[200px]"
                  />
                  {uploadingLabel && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
                <p className="text-xs text-muted-foreground">
                  PDF, PNG, JPEG or WebP, up to 10 MB. Stored in the same label bucket as Foam My Bike.
                </p>
                {labelPath && (
                  <div className="text-xs flex flex-wrap items-center gap-2 pt-1">
                    <span className="flex items-center gap-1 text-emerald-600">
                      <FileCheck className="h-3.5 w-3.5" /> Label uploaded
                      {labelUploadedAt && ` ${new Date(labelUploadedAt).toLocaleString("en-GB")}`}
                    </span>
                    {signedLabelUrl && (
                      <a
                        href={signedLabelUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline flex items-center gap-1"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> View
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>


        ) : (
          <p className="text-sm text-muted-foreground">
            This order is not flagged as a Northern Ireland order.
            {looksNI && (
              <span className="block mt-1 text-amber-600 font-medium">
                The {looksInbound ? "collection" : "delivery"} address looks like Northern Ireland.
              </span>
            )}
          </p>
        )}

        {blocked ? (
          <p className="text-sm text-muted-foreground">
            This order is {String(order.status).replace(/_/g, " ")} — the Northern Ireland flag can no
            longer be changed.
          </p>
        ) : (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant={isNI ? "outline" : "default"} size="sm" disabled={working}>
                {working && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isNI
                  ? "Unmark Northern Ireland order"
                  : `Mark as Northern Ireland ${isInbound ? "collection" : "delivery"}`}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {isNI
                    ? "Remove the Northern Ireland flag?"
                    : `Mark as a Northern Ireland ${isInbound ? "collection" : "delivery"}?`}
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-2 text-sm">
                    {isNI ? (
                      <p>
                        The foam pipeline will be cleared and the Shipday{" "}
                        {ferryLeg === "pickup" ? "collection" : "delivery"} job will be re-created
                        against the real customer address.
                      </p>
                    ) : isInbound ? (
                      <p>
                        The Shipday collection job is re-created against the ferry hand-off point in
                        Manchester (the ferry partner collects in Northern Ireland), and a £120
                        per-bike surcharge applies to future invoicing. No foaming step is added.
                      </p>
                    ) : (
                      <p>
                        The bike enters the Foam My Bike pipeline at “Pending collection”, the Shipday
                        delivery job is re-created to the ferry hand-off point in Manchester, and a £120
                        per-bike surcharge applies to future invoicing.
                      </p>
                    )}
                    {(deliveryScheduled || deliveryDriver) && (
                      <p className="text-amber-600 font-medium">
                        Warning: this delivery is already
                        {deliveryScheduled ? " scheduled" : ""}
                        {deliveryScheduled && deliveryDriver ? " and" : ""}
                        {deliveryDriver ? ` assigned to ${deliveryDriver}` : ""}. Re-creating the job
                        drops the driver assignment and the timeslot — the delivery will need
                        re-scheduling.
                      </p>
                    )}
                    <p>The {isInbound ? "delivery" : "collection"} job is not affected.</p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={working}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={working}
                  onClick={(e) => {
                    e.preventDefault();
                    applyChange(!isNI);
                  }}
                >
                  {isNI ? "Unmark" : "Mark as Northern Ireland"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardContent>
    </Shell>
  );
};

export default NorthernIrelandEditor;
