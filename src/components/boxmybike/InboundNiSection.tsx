import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Ship, ExternalLink, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  NiInboundStatus,
  NI_INBOUND_STATUS_LABELS,
  NI_INBOUND_STATUS_ORDER,
} from "@/types/order";
import { CITY_AIR_EXPRESS } from "@/constants/depot";
import OrderSearchBar from "@/components/boxmybike/OrderSearchBar";
import { filterOrdersBySearch } from "@/utils/orderSearch";
import { toPublicFileUrl } from "@/lib/publicFileUrl";
import { useAuth } from "@/contexts/AuthContext";
import StageDateTimeDialog, { formatStageDate } from "@/components/boxmybike/StageDateTimeDialog";

interface InboundOrder {
  id: string;
  tracking_number: string | null;
  status: string;
  ni_inbound_status: NiInboundStatus | null;
  sender: any;
  receiver: any;
  bike_brand: string | null;
  bike_model: string | null;
  bike_quantity: number | null;
  user_id: string;
  created_at: string;
  ni_partner_label_url: string | null;
  ni_partner_label_uploaded_at: string | null;
  ni_bfs_number: string | null;
  ni_inbound_collected_at: string | null;
  ni_inbound_ferry_crossed_at: string | null;
  ni_inbound_received_at: string | null;
}

function inboundTimestampColumn(s: NiInboundStatus): string | null {
  switch (s) {
    case "awaiting_ni_collection":
      return null;
    case "collected_in_ni":
      return "ni_inbound_collected_at";
    case "crossed_ferry":
      return "ni_inbound_ferry_crossed_at";
    case "collected_from_partner":
      return "ni_inbound_received_at";
    default:
      return null;
  }
}

function nextInboundStage(s: NiInboundStatus | null): NiInboundStatus | null {
  if (!s) return NI_INBOUND_STATUS_ORDER[0];
  const i = NI_INBOUND_STATUS_ORDER.indexOf(s);
  if (i < 0 || i === NI_INBOUND_STATUS_ORDER.length - 1) return null;
  return NI_INBOUND_STATUS_ORDER[i + 1];
}
function prevInboundStage(s: NiInboundStatus | null): NiInboundStatus | null {
  if (!s) return null;
  const i = NI_INBOUND_STATUS_ORDER.indexOf(s);
  if (i <= 0) return null;
  return NI_INBOUND_STATUS_ORDER[i - 1];
}

const InboundNiSection: React.FC<{ isStaff: boolean }> = ({ isStaff }) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = React.useState<NiInboundStatus>("awaiting_ni_collection");
  const [search, setSearch] = React.useState("");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["inbound-ni-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, tracking_number, status, ni_inbound_status, sender, receiver, bike_brand, bike_model, bike_quantity, user_id, created_at, ni_partner_label_url, ni_partner_label_uploaded_at, ni_bfs_number, ni_inbound_collected_at, ni_inbound_ferry_crossed_at, ni_inbound_received_at"
        )
        .eq("is_northern_ireland", true)
        .eq("ni_direction", "inbound")
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as InboundOrder[];
    },
    enabled: isStaff,
  });

  const updateStage = useMutation({
    mutationFn: async ({
      id,
      newStage,
      occurredAt,
    }: {
      id: string;
      newStage: NiInboundStatus;
      occurredAt?: string;
    }) => {
      const patch: any = {
        ni_inbound_status: newStage,
        updated_at: new Date().toISOString(),
      };
      const col = inboundTimestampColumn(newStage);
      if (col) patch[col] = occurredAt || new Date().toISOString();
      // When the ferry partner has handed it to us, the bike is back in our
      // network and can follow the normal mainland lifecycle.
      if (newStage === "collected_from_partner") {
        patch.status = "awaiting_depot";
      }
      const { error } = await supabase.from("orders").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbound-ni-orders"] });
      toast.success("Inbound NI stage updated");
    },
    onError: (e: any) => toast.error(e?.message || "Failed to update stage"),
  });

  const updateStageTime = useMutation({
    mutationFn: async ({
      id,
      column,
      occurredAt,
    }: {
      id: string;
      column: string;
      occurredAt: string;
    }) => {
      const { error } = await supabase
        .from("orders")
        .update({ [column]: occurredAt, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbound-ni-orders"] });
      toast.success("Date and time updated");
    },
    onError: (e: any) => toast.error(e?.message || "Failed to update date and time"),
  });

  const filtered = React.useMemo(
    () => filterOrdersBySearch(orders, search),
    [orders, search]
  );

  const grouped = React.useMemo(() => {
    const map: Record<NiInboundStatus, InboundOrder[]> = {
      awaiting_ni_collection: [],
      collected_in_ni: [],
      crossed_ferry: [],
      collected_from_partner: [],
    };
    for (const o of filtered) {
      const stage = o.ni_inbound_status || "awaiting_ni_collection";
      map[stage as NiInboundStatus].push(o);
    }
    return map;
  }, [filtered]);

  if (!isStaff) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        Inbound Northern Ireland tracking is only available to staff.
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-4">
      <OrderSearchBar value={search} onChange={setSearch} />
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as NiInboundStatus)}
      >
        <TabsList className="flex flex-wrap h-auto">
          {NI_INBOUND_STATUS_ORDER.map((s) => (
            <TabsTrigger key={s} value={s} className="text-xs sm:text-sm">
              {NI_INBOUND_STATUS_LABELS[s]}{" "}
              <Badge variant="outline" className="ml-2">
                {grouped[s].length}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
        {NI_INBOUND_STATUS_ORDER.map((s) => (
          <TabsContent key={s} value={s} className="mt-4">
            {grouped[s].length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                {search.trim()
                  ? "No orders match your search."
                  : "No inbound NI orders in this stage."}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {grouped[s].map((order) => (
                  <InboundCard
                    key={order.id}
                    order={order}
                    onAdvance={() => {
                      const next = nextInboundStage(order.ni_inbound_status);
                      if (next) setPendingStage({ order, stage: next });
                    }}
                    onBack={() =>
                      updateStage.mutate({
                        id: order.id,
                        newStage: prevInboundStage(order.ni_inbound_status) as NiInboundStatus,
                      })
                    }
                    onEditTime={(column, current, label) =>
                      setEditing({ order, column, current, label })
                    }
                    disabled={updateStage.isPending}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <StageDateTimeDialog
        open={!!pendingStage}
        onOpenChange={(o) => !o && setPendingStage(null)}
        title={
          pendingStage
            ? `Mark as “${NI_INBOUND_STATUS_LABELS[pendingStage.stage]}”`
            : ""
        }
        description="When did this step actually happen? This is what the customer sees on tracking."
        confirmLabel="Update stage"
        saving={updateStage.isPending}
        onConfirm={(iso) => {
          if (!pendingStage) return;
          updateStage.mutate(
            { id: pendingStage.order.id, newStage: pendingStage.stage, occurredAt: iso },
            { onSuccess: () => setPendingStage(null) }
          );
        }}
      />

      <StageDateTimeDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing ? `Edit “${editing.label}” date` : ""}
        initial={editing?.current || null}
        confirmLabel="Save date"
        saving={updateStageTime.isPending}
        onConfirm={(iso) => {
          if (!editing) return;
          updateStageTime.mutate(
            { id: editing.order.id, column: editing.column, occurredAt: iso },
            { onSuccess: () => setEditing(null) }
          );
        }}
      />
    </div>
  );
};

const InboundCard: React.FC<{
  order: InboundOrder;
  onAdvance: () => void;
  onBack: () => void;
  disabled: boolean;
}> = ({ order, onAdvance, onBack, disabled }) => {
  const [signedLabel, setSignedLabel] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!order.ni_partner_label_url) {
      setSignedLabel(null);
      return;
    }
    let cancelled = false;
    Promise.resolve(
      supabase.storage
        .from("foam-my-bike-labels")
        .createSignedUrl(order.ni_partner_label_url, 60 * 30)
    ).then(({ data, error }) => {
      if (cancelled) return;
      setSignedLabel(error ? null : toPublicFileUrl(data?.signedUrl || null));
    });
    return () => {
      cancelled = true;
    };
  }, [order.ni_partner_label_url]);

  const niParty = order.sender;
  const address = [niParty?.address?.street, niParty?.address?.city, niParty?.address?.zipCode]
    .filter(Boolean)
    .join(", ");

  const canAdvance = Boolean(nextInboundStage(order.ni_inbound_status));
  const canBack = Boolean(prevInboundStage(order.ni_inbound_status));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">
            {order.tracking_number || "No tracking number"}
          </CardTitle>
          <Badge variant="outline" className="shrink-0">
            {NI_INBOUND_STATUS_LABELS[order.ni_inbound_status || "awaiting_ni_collection"]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <p className="font-medium">{order.bike_brand || ""} {order.bike_model || "Bike"}</p>
          <p className="text-muted-foreground">Quantity: {order.bike_quantity || 1}</p>
        </div>
        <div className="rounded border bg-muted/30 p-3 space-y-1">
          <p className="font-medium flex items-center gap-1">
            <Ship className="h-3.5 w-3.5" /> NI collection point
          </p>
          <p>{niParty?.name || "—"}</p>
          <p className="text-muted-foreground">{address || "—"}</p>
        </div>
        {order.ni_bfs_number && (
          <p className="text-muted-foreground">
            <strong>BFS number:</strong> {order.ni_bfs_number}
          </p>
        )}
        {order.ni_partner_label_url && (
          <div className="text-xs flex items-center gap-2">
            <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-muted-foreground">
              Label uploaded{" "}
              {order.ni_partner_label_uploaded_at
                ? new Date(order.ni_partner_label_uploaded_at).toLocaleString("en-GB")
                : ""}
            </span>
            {signedLabel && (
              <a
                href={signedLabel}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline inline-flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" /> View
              </a>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={disabled || !canBack}
            onClick={onBack}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <Button
            size="sm"
            disabled={disabled || !canAdvance}
            onClick={onAdvance}
          >
            {order.ni_inbound_status === "crossed_ferry"
              ? "Collected from partner"
              : "Advance"}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Handover at {CITY_AIR_EXPRESS.name} — {CITY_AIR_EXPRESS.formatted}
        </p>
      </CardContent>
    </Card>
  );
};

export default InboundNiSection;
