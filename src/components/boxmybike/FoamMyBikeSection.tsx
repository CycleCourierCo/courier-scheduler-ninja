import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Camera, Image as ImageIcon, Printer, Upload, UserPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { FoamStatus, FOAM_STATUS_LABELS, FOAM_STATUS_ORDER } from "@/types/order";
import { CITY_AIR_EXPRESS } from "@/constants/depot";
import { formatStorageLocations } from "@/utils/storageLocation";
import { isServiceComplete, serviceGateLabel } from "@/utils/servicingGate";
import { useInspectionStages, fetchInspectionStages } from "@/hooks/useInspectionStages";
import ServiceOverrideDialog from "@/components/boxmybike/ServiceOverrideDialog";
import { useAuth } from "@/contexts/AuthContext";
import { hasRole } from "@/lib/roles";
import { uploadToStorage, describeUploadError } from "@/utils/uploadFile";


interface FoamOrder {
  id: string;
  tracking_number: string | null;
  status: string;
  foam_status: FoamStatus | null;
  foam_delivery_photos: string[] | null;
  foam_label_url: string | null;
  foam_tracking_url: string | null;
  sender: any;
  receiver: any;
  bike_brand: string | null;
  bike_model: string | null;
  user_id: string;
  created_at: string;
  storage_locations: any;
  needs_inspection: boolean | null;
}

const BOX_LABEL_BUCKET = "box-my-bike-labels";


// Inline editor for the courier tracking link on a foam order
const FoamTrackingUrlEditor: React.FC<{
  value: string | null;
  canEdit: boolean;
  onSave: (url: string) => void;
  saving: boolean;
}> = ({ value, canEdit, onSave, saving }) => {
  const [draft, setDraft] = React.useState(value || "");
  React.useEffect(() => setDraft(value || ""), [value]);
  const dirty = (draft || "") !== (value || "");

  return (
    <div className="space-y-1">
      <div className="text-sm font-medium">
        Tracking link {canEdit && !value && <span className="text-destructive">*</span>}
      </div>
      {canEdit ? (
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="https://carrier.example/track/123"
            className="h-9"
          />
          <Button size="sm" disabled={!dirty || saving} onClick={() => onSave(draft.trim())}>
            Save
          </Button>
        </div>
      ) : value ? (
        <a href={value} target="_blank" rel="noreferrer" className="text-sm text-primary underline break-all">
          {value}
        </a>
      ) : (
        <div className="text-sm text-muted-foreground">No tracking link added yet</div>
      )}
    </div>
  );
};


function foamTimestampColumn(s: FoamStatus): string | null {
  switch (s) {
    case "pending_collection": return "foam_pending_collection_at";
    case "pending_foaming": return "foam_pending_foaming_at";
    case "foamed_ready": return "foam_foamed_at";
    case "delivered_to_ferry": return "foam_delivered_to_ferry_at";
    case "delivered_ni": return "foam_delivered_ni_at";
    default: return null;
  }
}

function nextFoamStage(s: FoamStatus | null): FoamStatus | null {
  if (!s) return FOAM_STATUS_ORDER[0];
  const i = FOAM_STATUS_ORDER.indexOf(s);
  if (i < 0 || i === FOAM_STATUS_ORDER.length - 1) return null;
  return FOAM_STATUS_ORDER[i + 1];
}
function prevFoamStage(s: FoamStatus | null): FoamStatus | null {
  if (!s) return null;
  const i = FOAM_STATUS_ORDER.indexOf(s);
  if (i <= 0) return null;
  return FOAM_STATUS_ORDER[i - 1];
}

const FoamMyBikeSection: React.FC<{ isStaff: boolean; userId?: string }> = ({ isStaff, userId }) => {
  const queryClient = useQueryClient();
  const { userProfile } = useAuth();
  const isAdmin = hasRole(userProfile, "admin");
  const [activeTab, setActiveTab] = React.useState<FoamStatus>("pending_collection");
  const [overrideFor, setOverrideFor] = React.useState<FoamOrder | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["foam-my-bike-orders", userId, isStaff],
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select("id, tracking_number, status, foam_status, foam_delivery_photos, foam_label_url, foam_tracking_url, sender, receiver, bike_brand, bike_model, user_id, created_at, storage_locations, needs_inspection")
        .eq("is_northern_ireland", true)
        // Inbound NI bikes arrive already packed — the foam pipeline is outbound only
        .or("ni_direction.is.null,ni_direction.eq.outbound")
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });
      if (!isStaff && userId) q = q.eq("user_id", userId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as FoamOrder[];
    },
    enabled: !!userId,
  });

  const inspectionOrderIds = React.useMemo(
    () => orders.filter((o) => o.needs_inspection === true).map((o) => o.id),
    [orders]
  );
  const { data: inspectionStages = {} } = useInspectionStages(inspectionOrderIds);

  const updateStage = useMutation({
    mutationFn: async ({
      id,
      newStage,
      overrideReason,
    }: {
      id: string;
      newStage: FoamStatus;
      overrideReason?: string;
    }) => {
      // Re-check the service gate so a stale card can't push an unserviced bike
      // into foaming.
      if (newStage === "foamed_ready") {
        const { data: fresh } = await supabase
          .from("orders")
          .select("needs_inspection")
          .eq("id", id)
          .maybeSingle();
        if ((fresh as any)?.needs_inspection === true) {
          const stages = await fetchInspectionStages([id]);
          if (!isServiceComplete(true, stages[id])) {
            if (!overrideReason) {
              throw new Error(
                `Service outstanding (${serviceGateLabel(stages[id])}) — this bike can't be foamed yet.`
              );
            }
            await supabase.from("order_comments").insert({
              order_id: id,
              admin_id: userProfile?.id,
              admin_name: userProfile?.name || "Admin",
              comment: `Service gate overridden to foam this bike (workshop stage: ${serviceGateLabel(
                stages[id]
              )}). Reason: ${overrideReason}`,
            } as any);
          }
        }
      }
      const patch: any = { foam_status: newStage, updated_at: new Date().toISOString() };
      const col = foamTimestampColumn(newStage);
      if (col) patch[col] = new Date().toISOString();
      // Once handed off at the ferry stage, the public tracking shows that milestone.
      if (newStage === "delivered_to_ferry") patch.status = "delivered_to_ferry";
      if (newStage === "delivered_ni") patch.status = "delivered";
      // Mirror the "load onto van" flow: at the ferry hand-off the bike has left the
      // depot, so free the bay.
      const releasedBay = newStage === "delivered_to_ferry" || newStage === "delivered_ni";
      if (releasedBay) patch.storage_locations = null;
      const { error } = await supabase.from("orders").update(patch).eq("id", id);
      if (error) throw error;
      return { releasedBay };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["foam-my-bike-orders"] });
      toast.success(
        result?.releasedBay
          ? "Foam stage updated — bike removed from storage"
          : "Foam stage updated"
      );
    },

    onError: (e: any) => toast.error(e?.message || "Failed to update stage"),
  });

  const [uploadPct, setUploadPct] = React.useState<number | null>(null);

  const uploadPhoto = useMutation({
    mutationFn: async ({ order, file }: { order: FoamOrder; file: File }) => {
      const path = await uploadToStorage({
        bucket: "foam-delivery-photos",
        prefix: order.id,
        file,
        onProgress: setUploadPct,
      });

      const photos = [...(order.foam_delivery_photos || []), path];
      const { error } = await supabase
        .from("orders")
        .update({ foam_delivery_photos: photos, updated_at: new Date().toISOString() } as any)
        .eq("id", order.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["foam-my-bike-orders"] });
      toast.success("Photo uploaded");
    },
    onError: (e: any) => toast.error(describeUploadError(e) || "Failed to upload photo"),
    onSettled: () => setUploadPct(null),
  });

  const viewPhoto = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("foam-delivery-photos")
      .createSignedUrl(path, 60 * 10);
    if (error || !data?.signedUrl) {
      toast.error("Could not open photo");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const uploadLabel = useMutation({
    mutationFn: async ({ order, file }: { order: FoamOrder; file: File }) => {
      const path = await uploadToStorage({
        bucket: BOX_LABEL_BUCKET,
        prefix: order.id,
        file,
        onProgress: setUploadPct,
      });

      const { error: updErr } = await supabase
        .from("orders")
        .update({
          foam_label_url: path,
          foam_label_uploaded_at: new Date().toISOString(),
          foam_label_uploaded_by: userId,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", order.id);
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["foam-my-bike-orders"] });
      toast.success("Label uploaded");
    },
    onError: (e: any) => toast.error(describeUploadError(e) || "Failed to upload label"),
    onSettled: () => setUploadPct(null),
  });


  const saveTrackingUrl = useMutation({
    mutationFn: async ({ id, url }: { id: string; url: string }) => {
      const { error } = await supabase
        .from("orders")
        .update({ foam_tracking_url: url || null, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["foam-my-bike-orders"] });
      toast.success("Tracking link saved");
    },
    onError: (e: any) => toast.error(e?.message || "Failed to save tracking link"),
  });

  const viewLabel = async (path: string) => {
    // Open the tab synchronously so popup blockers don't kill it
    const tab = window.open("", "_blank");
    const { data, error } = await supabase.storage
      .from(BOX_LABEL_BUCKET)
      .createSignedUrl(path, 60 * 10);
    if (error || !data?.signedUrl) {
      tab?.close();
      toast.error("Could not load label");
      return;
    }
    if (tab) tab.location.href = data.signedUrl;
    else window.open(data.signedUrl, "_blank");
  };



  const grouped = React.useMemo(() => {
    const m = FOAM_STATUS_ORDER.reduce((acc, s) => {
      acc[s] = [] as FoamOrder[];
      return acc;
    }, {} as Record<FoamStatus, FoamOrder[]>);
    for (const o of orders) {
      const s = (o.foam_status || "pending_collection") as FoamStatus;
      if (m[s]) m[s].push(o);
    }
    return m;
  }, [orders]);

  const renderCard = (o: FoamOrder) => {
    const stage = (o.foam_status || "pending_collection") as FoamStatus;
    const prev = prevFoamStage(stage);
    const next = nextFoamStage(stage);
    const addr = o.receiver?.address || {};
    const isOwner = !isStaff && o.user_id === userId;
    const labelStages: FoamStatus[] = ["pending_collection", "pending_foaming", "foamed_ready"];
    const canEditLabel = (isOwner || isStaff) && labelStages.includes(stage);
    const showLabelSection = labelStages.includes(stage) || !!o.foam_label_url || !!o.foam_tracking_url;
    // Can't hand a bike to the ferry courier without a label and tracking link
    const blockedAdvance = stage === "foamed_ready" && (!o.foam_label_url || !o.foam_tracking_url);
    const serviceDone = isServiceComplete(o.needs_inspection, inspectionStages[o.id]);
    const serviceBlocked = next === "foamed_ready" && !serviceDone;
    const serviceStage = serviceGateLabel(inspectionStages[o.id]);

    return (
      <Card key={o.id} className="mb-3">
        <CardContent className="pt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div>
              <div className="font-semibold">{o.tracking_number || o.id.slice(0, 8)}</div>
              <div className="text-sm text-muted-foreground">
                {[o.bike_brand, o.bike_model].filter(Boolean).join(" ") || "Bicycle"}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {formatStorageLocations(o.storage_locations) ? (
                <Badge variant="secondary">📍 {formatStorageLocations(o.storage_locations)}</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">📍 Not allocated</Badge>
              )}
              {!serviceDone && (
                <Badge variant="destructive">Service outstanding — {serviceStage}</Badge>
              )}
              <Badge variant="outline">{FOAM_STATUS_LABELS[stage]}</Badge>
            </div>
          </div>

          <div className="text-sm">
            <div><span className="text-muted-foreground">From:</span> {o.sender?.name}</div>
            <div>
              <span className="text-muted-foreground">To (NI):</span> {o.receiver?.name} —{" "}
              {[addr.street, addr.city, addr.zipCode].filter(Boolean).join(", ")}
            </div>
            <div className="text-muted-foreground text-xs mt-1">
              Ferry hand-off: {CITY_AIR_EXPRESS.formatted}
            </div>
          </div>



          {showLabelSection && (
            <div className="rounded-md border p-3 space-y-3">
              <div className="space-y-1">
                <div className="text-sm font-medium">
                  Shipping label {stage === "foamed_ready" && canEditLabel && !o.foam_label_url && <span className="text-destructive">*</span>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {o.foam_label_url ? (
                    <Button size="sm" variant="outline" onClick={() => viewLabel(o.foam_label_url!)}>
                      <Printer className="h-4 w-4 mr-1" /> View / print
                    </Button>
                  ) : (
                    <span className="text-sm text-muted-foreground">No label uploaded yet</span>
                  )}
                  {canEditLabel && (
                    <label className="inline-flex">
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        className="hidden"
                        disabled={uploadLabel.isPending}
                        onChange={(e) => {
                          const input = e.target as HTMLInputElement;
                          const f = input.files?.[0];
                          input.value = "";
                          if (f) uploadLabel.mutate({ order: o, file: f });
                        }}

                      />
                      <Button size="sm" variant="outline" asChild>
                        <span>
                          <Upload className="h-4 w-4 mr-1" />
                          {uploadLabel.isPending
                            ? `Uploading${uploadPct !== null ? ` ${uploadPct}%` : "…"}`
                            : o.foam_label_url
                              ? "Replace label"
                              : "Upload label"}
                        </span>
                      </Button>
                    </label>
                  )}

                </div>
              </div>

              <FoamTrackingUrlEditor
                value={o.foam_tracking_url}
                canEdit={canEditLabel}
                saving={saveTrackingUrl.isPending}
                onSave={(url) => saveTrackingUrl.mutate({ id: o.id, url })}
              />
            </div>
          )}



          {(o.foam_delivery_photos?.length || 0) > 0 && (
            <div className="flex flex-wrap gap-2">
              {o.foam_delivery_photos!.map((p) => (
                <Button key={p} size="sm" variant="outline" onClick={() => viewPhoto(p)}>
                  <ImageIcon className="h-4 w-4 mr-1" /> Photo
                </Button>
              ))}
            </div>
          )}

          {isStaff && (
            <div className="flex flex-wrap gap-2">
              {prev && (
                <Button size="sm" variant="outline" onClick={() => updateStage.mutate({ id: o.id, newStage: prev })}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> {FOAM_STATUS_LABELS[prev]}
                </Button>
              )}
              {next && (
                <Button
                  size="sm"
                  disabled={blockedAdvance || serviceBlocked}
                  title={
                    serviceBlocked
                      ? `Service outstanding (${serviceStage}) — finish service and cleaning before foaming`
                      : blockedAdvance
                        ? "Upload a label and add a tracking link first"
                        : undefined
                  }
                  onClick={() => updateStage.mutate({ id: o.id, newStage: next })}
                >
                  {FOAM_STATUS_LABELS[next]} <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
              {serviceBlocked && isAdmin && (
                <Button size="sm" variant="outline" onClick={() => setOverrideFor(o)}>
                  Override
                </Button>
              )}
              <label className="inline-flex">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const input = e.target as HTMLInputElement;
                    const f = input.files?.[0];
                    input.value = "";
                    if (f) uploadPhoto.mutate({ order: o, file: f });
                  }}

                />
                <Button size="sm" variant="outline" asChild>
                  <span><Camera className="h-4 w-4 mr-1" /> Add photo</span>
                </Button>
              </label>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  if (!isStaff) {
    return orders.length === 0 ? (
      <div className="text-sm text-muted-foreground py-8 text-center">
        No Northern Ireland deliveries yet.
      </div>
    ) : (
      <>{orders.map(renderCard)}</>
    );
  }

  return (
    <>
    <ServiceOverrideDialog
      open={!!overrideFor}
      onOpenChange={(o) => !o && setOverrideFor(null)}
      stageLabel={serviceGateLabel(overrideFor ? inspectionStages[overrideFor.id] : null)}
      targetLabel={FOAM_STATUS_LABELS.foamed_ready}
      onConfirm={(reason) => {
        if (overrideFor) {
          updateStage.mutate({ id: overrideFor.id, newStage: "foamed_ready", overrideReason: reason });
        }
        setOverrideFor(null);
      }}
    />
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FoamStatus)}>
      <TabsList className="flex flex-wrap h-auto">
        {FOAM_STATUS_ORDER.map((s) => (
          <TabsTrigger key={s} value={s} className="text-xs sm:text-sm">
            {FOAM_STATUS_LABELS[s]}{" "}
            <Badge variant="outline" className="ml-2">{grouped[s].length}</Badge>
          </TabsTrigger>
        ))}
      </TabsList>
      {FOAM_STATUS_ORDER.map((s) => (
        <TabsContent key={s} value={s} className="mt-4">
          {grouped[s].length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              No bikes in this stage.
            </div>
          ) : (
            grouped[s].map(renderCard)
          )}
        </TabsContent>
      ))}
    </Tabs>
    </>
  );
};

export default FoamMyBikeSection;
