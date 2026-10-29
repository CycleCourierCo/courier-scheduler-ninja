import React from "react";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { hasRole } from "@/lib/roles";
import FoamMyBikeSection from "@/components/boxmybike/FoamMyBikeSection";
import InboundNiSection from "@/components/boxmybike/InboundNiSection";

const FINISHED = ["delivered", "cancelled", "delivered_by_3p", "collected_by_3p", "delivered_to_ferry"];

interface NiOrder {
  id: string;
  tracking_number: string | null;
  status: string;
  order_collected: boolean | null;
  sender_confirmed_at: string | null;
  bikes: any;
  bike_brand: string | null;
  bike_model: string | null;
  sender: any;
  receiver: any;
}

const bikeOf = (o: NiOrder) => {
  const b = Array.isArray(o.bikes) ? o.bikes : [];
  const s = b.map((x: any) => [x?.brand, x?.model].filter(Boolean).join(" ")).filter(Boolean).join(", ");
  return s || [o.bike_brand, o.bike_model].filter(Boolean).join(" ") || "Bike";
};

const loadNiOrders = async (): Promise<NiOrder[]> => {
  const all: NiOrder[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("orders")
      .select("id,tracking_number,status,order_collected,sender_confirmed_at,bikes,bike_brand,bike_model,sender,receiver")
      .eq("is_northern_ireland", true)
      .not("status", "in", `(${FINISHED.join(",")})`)
      .order("created_at", { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    all.push(...((data as any[]) || []));
    if (!data || data.length < 1000) break;
  }
  return all;
};

const OrderList: React.FC<{ title: string; orders: NiOrder[]; side: "sender" | "receiver" }> = ({ title, orders, side }) => (
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="flex items-center justify-between text-base">
        {title} <Badge>{orders.length}</Badge>
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-2">
      {orders.length === 0 && <p className="text-sm text-muted-foreground">None right now.</p>}
      {orders.map((o) => (
        <div key={o.id} className="rounded border p-2 text-sm">
          <div className="font-medium">{o.tracking_number || "—"}</div>
          <div className="text-muted-foreground">
            {bikeOf(o)} · {o[side]?.address?.city || "—"}
          </div>
        </div>
      ))}
    </CardContent>
  </Card>
);

const TrunkRunsSection: React.FC = () => {
  const { data = [], isLoading, error } = useQuery({ queryKey: ["ireland-trunk-counts"], queryFn: loadNiOrders });
  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (error) return <div className="text-sm text-destructive">Couldn't load ferry bikes.</div>;
  const toCollect = data.filter((o) => !o.order_collected && o.sender_confirmed_at);
  const toDeliver = data.filter((o) => o.order_collected);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <OrderList title="Ready to collect" orders={toCollect} side="sender" />
      <OrderList title="Ready for delivery" orders={toDeliver} side="receiver" />
    </div>
  );
};

const IrelandPage: React.FC = () => {
  const { user, userProfile } = useAuth();
  const isStaff = hasRole(userProfile, "admin") || hasRole(userProfile, "mechanic") || hasRole(userProfile, "loader");
  const [section, setSection] = React.useState<"foam" | "inbound-ni" | "trunk">("foam");

  return (
    <Layout>
      <div className="floor-density mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-6 border-b pb-4">
          <h1>Ireland</h1>
          <p className="text-muted-foreground">Foam My Bike, inbound Northern Ireland and Isle of Man bikes and trunk runs.</p>
        </div>
        <Tabs value={section} onValueChange={(v) => setSection(v as typeof section)} className="mb-6">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="foam">Foam My Bike (NI)</TabsTrigger>
            <TabsTrigger value="inbound-ni">Inbound NI</TabsTrigger>
            {isStaff && <TabsTrigger value="trunk">Trunk runs</TabsTrigger>}
          </TabsList>
        </Tabs>
        {section === "foam" && <FoamMyBikeSection isStaff={isStaff} userId={user?.id} />}
        {section === "inbound-ni" && <InboundNiSection isStaff={isStaff} />}
        {section === "trunk" && isStaff && <TrunkRunsSection />}
      </div>
    </Layout>
  );
};

export default IrelandPage;
