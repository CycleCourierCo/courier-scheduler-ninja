import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Camera, Image as ImageIcon, Printer, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { FoamStatus, FOAM_STATUS_LABELS, FOAM_STATUS_ORDER } from "@/types/order";
import { CITY_AIR_EXPRESS } from "@/constants/depot";
import { formatStorageLocations } from "@/utils/storageLocation";
import { uploadToStorage } from "@/utils/uploadFile";


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
}

const FOAM_LABEL_BUCKET = "foam-my-bike-labels";


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
  const [activeTab, setActiveTab] = React.useState<FoamStatus>("pending_collection");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["foam-my-bike-orders", userId, isStaff],
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select("id, tracking_number, status, foam_status, foam_delivery_photos, foam_label_url, foam_tracking_url, sender, receiver, bike_brand, bike_model, user_id, created_at, storage_locations")
        .eq("is_northern_ireland", true)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });
      if (!isStaff && userId) q = q.eq("user_id", userId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as FoamOrder[];
    },
    enabled: !!userId,
  });

  const updateStage = useMutation({
    mutationFn: async ({ id, newStage }: { id: string; newStage: FoamStatus }) => {
      const patch: any = { foam_status: newStage, updated_at: new Date().toISOString() };
      const col = foamTimestampColumn(newStage);
      if (col) patch[col] = new Date().toISOString();
      // Once handed to City Air Express the public tracking shows the ferry stage
      if (newStage === "delivered_to_ferry") patch.status = "delivered_to_ferry";
      if (newStage === "delivered_ni") patch.status = "delivered";
      const { error } = await supabase.from("orders").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["foam-my-bike-orders"] });
      toast.success("Foam stage updated");
    },
    onError: (e: any) => toast.error(e?.message || "Failed to update stage"),
  });

  const uploadPhoto = useMutation({
    mutationFn: async ({ order, file }: { order: FoamOrder; file: File }) => {
      const path = await uploadToStorage({
        bucket: "foam-delivery-photos",
        prefix: order.id,
        file,
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
    onError: (e: any) => toast.error(e?.message || "Failed to upload photo"),
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
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const path = await uploadToStorage({
        bucket: FOAM_LABEL_BUCKET,
        prefix: id,
        file,
      });

      const { error } = await supabase
        .from("orders")
        .update({
          foam_label_url: path,
          foam_label_uploaded_at: new Date().toISOString(),
          foam_label_uploaded_by: userId || null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["foam-my-bike-orders"] });
      toast.success("Label uploaded");
    },
    onError: (e: any) => toast.error(e?.message || "Failed to upload label"),
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
      .from(FOAM_LABEL_BUCKET)
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
    const canEditLabel = isStaff && stage === "foamed_ready";
    const showLabelSection = stage === "foamed_ready" || !!o.foam_label_url || !!o.foam_tracking_url;
    // Can't hand a bike to the ferry courier without a label and tracking link
    const blockedAdvance = stage === "foamed_ready" && (!o.foam_label_url || !o.foam_tracking_url);

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
                  Shipping label {canEditLabel && !o.foam_label_url && <span className="text-destructive">*</span>}
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
                        onChange={(e) => {
                          const input = e.target as HTMLInputElement;
                          const f = input.files?.[0];
                          input.value = "";
                          if (f) uploadLabel.mutate({ id: o.id, file: f });
                        }}

                      />
                      <Button size="sm" variant="outline" asChild>
                        <span>
                          <Upload className="h-4 w-4 mr-1" />
                          {o.foam_label_url ? "Replace label" : "Upload label"}
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
                  disabled={blockedAdvance}
                  title={blockedAdvance ? "Upload a label and add a tracking link first" : undefined}
                  onClick={() => updateStage.mutate({ id: o.id, newStage: next })}
                >
                  {FOAM_STATUS_LABELS[next]} <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
              <label className="inline-flex">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadPhoto.mutate({ order: o, file: f });
                    e.currentTarget.value = "";
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
  );
};

export default FoamMyBikeSection;
