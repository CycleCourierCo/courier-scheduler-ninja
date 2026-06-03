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

const STAFF_STAGES: BoxMyBikeStatus[] = BOX_MY_BIKE_STATUS_ORDER;

interface BoxOrder {
  id: string;
  tracking_number: string | null;
  status: string;
  box_my_bike_status: BoxMyBikeStatus | null;
  box_label_url: string | null;
  sender: any;
  receiver: any;
  bike_brand: string | null;
  bike_model: string | null;
  user_id: string;
  created_at: string;
  collection_driver_name: string | null;
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
    default: return null;
  }
}

const BoxMyBikePage: React.FC = () => {
  const { user, userProfile } = useAuth();
  const queryClient = useQueryClient();
  const isStaff = hasRole(userProfile, "admin") || hasRole(userProfile, "mechanic");
  const [activeTab, setActiveTab] = React.useState<BoxMyBikeStatus>("awaiting_depot");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["box-my-bike-orders", user?.id, isStaff],
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select("id, tracking_number, status, box_my_bike_status, box_label_url, sender, receiver, bike_brand, bike_model, user_id, created_at, collection_driver_name")
        .eq("is_box_my_bike", true)
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["box-my-bike-orders"] });
      toast.success("Stage updated");
    },
    onError: (e: any) => toast.error(e?.message || "Failed to update stage"),
  });

  const uploadLabel = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const path = `${id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("box-my-bike-labels").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["box-my-bike-orders"] });
      toast.success("Label uploaded");
    },
    onError: (e: any) => toast.error(e?.message || "Failed to upload label"),
  });

  const viewLabel = async (path: string) => {
    const { data, error } = await supabase.storage.from("box-my-bike-labels").createSignedUrl(path, 60 * 10);
    if (error || !data?.signedUrl) {
      toast.error("Could not load label");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const grouped = React.useMemo(() => {
    const m: Record<BoxMyBikeStatus, BoxOrder[]> = {
      awaiting_depot: [],
      in_depot_awaiting_boxing: [],
      boxed_awaiting_label: [],
      awaiting_3p_collection: [],
      collected_by_3p: [],
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
      stage === "boxed_awaiting_label" && !o.box_label_url; // can't move to awaiting 3p collection without label
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
            <Badge variant="secondary">{BOX_MY_BIKE_STATUS_LABELS[stage]}</Badge>
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

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <h1 className="text-3xl font-bold mb-2">Box My Bike</h1>
        <p className="text-muted-foreground mb-6">
          {isStaff
            ? "Track Box My Bike orders through every stage from collection to 3rd-party handover."
            : "Your bikes being boxed at our depot for international shipping."}
        </p>

        {isLoading ? (
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

export default BoxMyBikePage;
