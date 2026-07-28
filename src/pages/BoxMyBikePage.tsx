import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Upload, Printer, FileText } from "lucide-react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { hasRole } from "@/lib/roles";
import {
  BoxMyBikeStatus,
  BOX_MY_BIKE_STATUS_LABELS,
  BOX_MY_BIKE_STATUS_ORDER,
} from "@/types/order";
import StatusBadge from "@/components/StatusBadge";
import { formatStorageLocations } from "@/utils/storageLocation";
import FoamMyBikeSection from "@/components/boxmybike/FoamMyBikeSection";


const STAFF_STAGES: BoxMyBikeStatus[] = BOX_MY_BIKE_STATUS_ORDER;

interface BoxOrder {
  id: string;
  tracking_number: string | null;
  status: string;
  box_my_bike_status: BoxMyBikeStatus | null;
  box_label_url: string | null;
  box_tracking_url: string | null;
  box_my_bike_invoice_id: string | null;
  box_my_bike_invoice_number: string | null;
  box_my_bike_invoice_url: string | null;
  sender: any;
  receiver: any;
  bike_brand: string | null;
  bike_model: string | null;
  user_id: string;
  created_at: string;
  collection_driver_name: string | null;
  storage_locations: any;
}

function nextStage(s: BoxMyBikeStatus | null): BoxMyBikeStatus | null {
  if (!s) return STAFF_STAGES[0];
  const i = STAFF_STAGES.indexOf(s);
  if (i < 0 || i === STAFF_STAGES.length - 1) return null;
  return STAFF_STAGES[i + 1];
}
function prevStage(s: BoxMyBikeStatus | null): BoxMyBikeStatus | null {
  if (!s) return null;
  const i = STAFF_STAGES.indexOf(s);
  if (i <= 0) return null;
  return STAFF_STAGES[i - 1];
}

function stageTimestampColumn(s: BoxMyBikeStatus): string | null {
  switch (s) {
    case "in_depot_awaiting_boxing": return "box_in_depot_at";
    case "boxed_awaiting_label": return "box_boxed_at";
    case "awaiting_3p_collection": return "box_label_printed_at";
    case "collected_by_3p": return "box_collected_by_3p_at";
    case "delivered_by_3p": return "box_delivered_by_3p_at";
    default: return null;
  }
}

function stageWebhookEvent(s: BoxMyBikeStatus): string | null {
  switch (s) {
    case "in_depot_awaiting_boxing": return "order.box.in_depot";
    case "boxed_awaiting_label": return "order.box.boxed";
    case "awaiting_3p_collection": return "order.box.label_uploaded";
    case "collected_by_3p": return "order.box.collected_by_3p";
    case "delivered_by_3p": return "order.box.delivered_by_3p";
    default: return null;
  }
}


async function fireBoxWebhooks(orderId: string, specificEvent: string | null) {
  try {
    const events = ["order.box.status.updated", ...(specificEvent ? [specificEvent] : [])];
    await Promise.all(
      events.map((event_type) =>
        supabase.functions.invoke("trigger-webhook", {
          body: { order_id: orderId, event_type },
        })
      )
    );
  } catch (e) {
    console.error("Failed to trigger box webhooks", e);
  }
}

const BoxMyBikePage: React.FC = () => {
  const { user, userProfile } = useAuth();
  const queryClient = useQueryClient();
  const isStaff = hasRole(userProfile, "admin") || hasRole(userProfile, "mechanic") || hasRole(userProfile, "loader");
  const [activeTab, setActiveTab] = React.useState<BoxMyBikeStatus>("awaiting_depot");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["box-my-bike-orders", user?.id, isStaff],
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select("id, tracking_number, status, box_my_bike_status, box_label_url, box_tracking_url, box_my_bike_invoice_id, box_my_bike_invoice_number, box_my_bike_invoice_url, sender, receiver, bike_brand, bike_model, user_id, created_at, collection_driver_name, storage_locations")
        .eq("is_box_my_bike", true)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });
      if (!isStaff && user?.id) {
        q = q.eq("user_id", user.id);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as BoxOrder[];
    },
    enabled: !!user,
  });

  const updateStage = useMutation({
    mutationFn: async ({ id, newStage }: { id: string; newStage: BoxMyBikeStatus }) => {
      const patch: any = { box_my_bike_status: newStage, updated_at: new Date().toISOString() };
      const col = stageTimestampColumn(newStage);
      if (col) patch[col] = new Date().toISOString();
      const { error } = await supabase.from("orders").update(patch).eq("id", id);
      if (error) throw error;
      await fireBoxWebhooks(id, stageWebhookEvent(newStage));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["box-my-bike-orders"] });
      toast.success("Stage updated");
    },
    onError: (e: any) => toast.error(e?.message || "Failed to update stage"),
  });

  const uploadLabel = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const path = await uploadToStorage({
        bucket: "box-my-bike-labels",
        prefix: id,
        file,
      });

      const { error: updErr } = await supabase
        .from("orders")
        .update({
          box_label_url: path,
          box_label_uploaded_at: new Date().toISOString(),
          box_label_uploaded_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (updErr) throw updErr;
      await fireBoxWebhooks(id, "order.box.label_uploaded");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["box-my-bike-orders"] });
      toast.success("Label uploaded");
    },
    onError: (e: any) => toast.error(e?.message || "Failed to upload label"),
  });

  const saveTrackingUrl = useMutation({
    mutationFn: async ({ id, url }: { id: string; url: string }) => {
      const { error } = await supabase
        .from("orders")
        .update({ box_tracking_url: url || null, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      await fireBoxWebhooks(id, "order.box.tracking_url_set");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["box-my-bike-orders"] });
      toast.success("Tracking link saved");
    },
    onError: (e: any) => toast.error(e?.message || "Failed to save tracking link"),
  });




  const viewLabel = async (path: string) => {
    // Open synchronously to preserve the user-gesture; browsers block popups opened after await.
    const win = window.open("", "_blank");
    const { data, error } = await supabase.storage.from("box-my-bike-labels").createSignedUrl(path, 60 * 10);
    if (error || !data?.signedUrl) {
      if (win) win.close();
      toast.error("Could not load label");
      return;
    }
    if (win && !win.closed) {
      win.location.href = data.signedUrl;
    } else {
      window.location.href = data.signedUrl;
    }
  };

  const grouped = React.useMemo(() => {
    const m: Record<BoxMyBikeStatus, BoxOrder[]> = {
      awaiting_depot: [],
      in_depot_awaiting_boxing: [],
      boxed_awaiting_label: [],
      awaiting_3p_collection: [],
      collected_by_3p: [],
      delivered_by_3p: [],
    };
    for (const o of orders) {
      const s = (o.box_my_bike_status || "awaiting_depot") as BoxMyBikeStatus;
      if (m[s]) m[s].push(o);
    }
    return m;
  }, [orders]);

  const renderCard = (o: BoxOrder) => {
    const stage = (o.box_my_bike_status || "awaiting_depot") as BoxMyBikeStatus;
    const prev = prevStage(stage);
    const next = nextStage(stage);
    const isOwner = !isStaff && o.user_id === user?.id;
    const blockedAdvance =
      stage === "boxed_awaiting_label" && (!o.box_label_url || !o.box_tracking_url); // need both label and tracking link
    return (
      <Card key={o.id} className="mb-3">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="font-semibold">{o.tracking_number || o.id.slice(0, 8)}</div>
              <div className="text-sm text-muted-foreground">
                {[o.bike_brand, o.bike_model].filter(Boolean).join(" ") || "Bike"} ·{" "}
                {o.sender?.name}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Order status: <StatusBadge status={o.status as any} />
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {formatStorageLocations(o.storage_locations) ? (
                <Badge variant="secondary">📍 {formatStorageLocations(o.storage_locations)}</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">📍 Not allocated</Badge>
              )}
              <Badge variant="secondary">{BOX_MY_BIKE_STATUS_LABELS[stage]}</Badge>
            </div>
          </div>

          {/* Label section */}
          {(stage === "boxed_awaiting_label" || o.box_label_url) && (
            <div className="rounded-md border p-3 bg-muted/30">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-sm font-medium">Shipping label</div>
                {o.box_label_url ? (
                  <Button size="sm" variant="outline" onClick={() => viewLabel(o.box_label_url!)}>
                    <Printer className="h-4 w-4 mr-1" /> View / print
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">No label uploaded yet</span>
                )}
              </div>
              {(isOwner || isStaff) && stage === "boxed_awaiting_label" && (
                <div className="mt-2">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
                    <Upload className="h-4 w-4" />
                    <span>{o.box_label_url ? "Replace label" : "Upload label"}</span>
                    <input
                      type="file"
                      className="hidden"
                      accept="application/pdf,image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadLabel.mutate({ id: o.id, file: f });
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              )}
            </div>
          )}

          {/* 3rd-party tracking link */}
          {(stage === "boxed_awaiting_label" || stage === "awaiting_3p_collection" || stage === "collected_by_3p" || stage === "delivered_by_3p" || o.box_tracking_url) && (
            <TrackingUrlEditor
              order={o}
              canEdit={(isOwner || isStaff) && stage === "boxed_awaiting_label"}
              onSave={(url) => saveTrackingUrl.mutate({ id: o.id, url })}
              saving={saveTrackingUrl.isPending}
            />
          )}

          {/* Invoice info (admin, read-only) */}
          {hasRole(userProfile, "admin") && o.box_my_bike_invoice_number && (
            <div className="rounded-md border p-3 bg-muted/30 flex items-center justify-between gap-2 flex-wrap">
              <div className="text-sm">
                <span className="font-medium">Boxing service invoiced</span>{" "}
                <span className="text-muted-foreground">#{o.box_my_bike_invoice_number}</span>
              </div>
              {o.box_my_bike_invoice_url && (
                <Button size="sm" variant="outline" asChild>
                  <a href={o.box_my_bike_invoice_url} target="_blank" rel="noreferrer">
                    <FileText className="h-4 w-4 mr-1" /> View invoice
                  </a>
                </Button>
              )}
            </div>
          )}

          {/* Stage controls (staff only) */}
          {isStaff && (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                disabled={!prev || updateStage.isPending}
                onClick={() => prev && updateStage.mutate({ id: o.id, newStage: prev })}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Revert
              </Button>
              <Button
                size="sm"
                disabled={!next || blockedAdvance || updateStage.isPending}
                onClick={() => next && updateStage.mutate({ id: o.id, newStage: next })}
                title={blockedAdvance ? "Customer must upload a label first" : undefined}
              >
                Advance <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const [section, setSection] = React.useState<"box" | "foam">("box");

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <h1 className="text-3xl font-bold mb-2">Box My Bike</h1>
        <p className="text-muted-foreground mb-6">
          {isStaff
            ? "Track Box My Bike orders through every stage from collection to 3rd-party handover."
            : "Your bikes being boxed at our depot for international shipping."}
        </p>

        <Tabs value={section} onValueChange={(v) => setSection(v as "box" | "foam")} className="mb-6">
          <TabsList>
            <TabsTrigger value="box">Box My Bike</TabsTrigger>
            <TabsTrigger value="foam">Foam My Bike (NI)</TabsTrigger>
          </TabsList>
        </Tabs>

        {section === "foam" ? (
          <FoamMyBikeSection isStaff={isStaff} userId={user?.id} />
        ) : isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : isStaff ? (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as BoxMyBikeStatus)}>
            <TabsList className="flex flex-wrap h-auto">
              {STAFF_STAGES.map((s) => (
                <TabsTrigger key={s} value={s} className="text-xs sm:text-sm">
                  {BOX_MY_BIKE_STATUS_LABELS[s]}{" "}
                  <Badge variant="outline" className="ml-2">{grouped[s].length}</Badge>
                </TabsTrigger>
              ))}
            </TabsList>
            {STAFF_STAGES.map((s) => (
              <TabsContent key={s} value={s} className="mt-4">
                {grouped[s].length === 0 ? (
                  <div className="text-sm text-muted-foreground py-8 text-center">
                    No orders in this stage.
                  </div>
                ) : (
                  grouped[s].map(renderCard)
                )}
              </TabsContent>
            ))}
          </Tabs>
        ) : orders.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" /> No Box My Bike orders yet
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              When you create an order with the “Box My Bike” option turned on, it will appear here.
            </CardContent>
          </Card>
        ) : (
          orders.map(renderCard)
        )}
      </div>
    </Layout>
  );
};


const TrackingUrlEditor: React.FC<{
  order: BoxOrder;
  canEdit: boolean;
  onSave: (url: string) => void;
  saving: boolean;
}> = ({ order, canEdit, onSave, saving }) => {
  const [value, setValue] = React.useState(order.box_tracking_url || "");
  React.useEffect(() => {
    setValue(order.box_tracking_url || "");
  }, [order.box_tracking_url]);
  const dirty = (value || "") !== (order.box_tracking_url || "");

  return (
    <div className="rounded-md border p-3 bg-muted/30 space-y-2">
      <div className="text-sm font-medium">
        3rd-party tracking link
        {canEdit && !order.box_tracking_url && <span className="text-destructive"> *</span>}
      </div>
      {canEdit && !order.box_tracking_url && (
        <div className="text-xs text-destructive">
          Please paste the courier tracking link here — this must be added along with the label so your recipient can track the parcel.
        </div>
      )}
      {canEdit ? (
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="url"
            inputMode="url"
            placeholder="https://tracking.example.com/..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={`flex-1 min-w-[220px] rounded-md border bg-background px-3 py-2 text-sm ${
              !order.box_tracking_url ? "border-destructive" : ""
            }`}
          />
          <Button size="sm" onClick={() => onSave(value.trim())} disabled={saving || !dirty}>
            Save
          </Button>
        </div>
      ) : order.box_tracking_url ? (
        <a
          href={order.box_tracking_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary underline break-all"
        >
          {order.box_tracking_url}
        </a>
      ) : (
        <div className="text-xs text-muted-foreground">No tracking link added yet</div>
      )}
    </div>
  );
};

export default BoxMyBikePage;
