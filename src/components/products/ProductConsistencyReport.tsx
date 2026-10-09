import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { pricingData, bikeTypePriceMap, BIKE_TYPE_BY_ID } from "@/constants/bikePricing";
import { BIKE_TYPES as BOOKING_TYPES } from "@/components/create-order/OrderDetails";
import { BIKE_TYPES as BOOKING_OPTION_TYPES } from "@/components/create-order/OrderOptions";

type QbItem = { id: string; name: string; price: number; active: boolean };
type ShopifyProduct = { id: string; title: string; variants: { id: string; title: string; price: number }[] };

// Reduce the many spellings of a product to one comparison key.
const ALIASES: Record<string, string> = {
  "wheels/frame boxed or unboxed": "wheelset/frameset",
  "small trike": "trike",
  "double seat/platform/cargo trikes": "cargo trike",
  "electric bike over 50kg": "electric bike over 25kg",
};
export function productKey(raw: string): string {
  let s = raw.toLowerCase().replace(/collection and delivery within england and wales/g, "")
    .replace(/[–—-]/g, " ").replace(/\s+/g, " ").trim();
  s = s.replace(/^electric bikes/, "electric bike");
  s = s.replace(/^non electric (bikes)?/, "non electric ").trim();
  if (s === "non electric") s = "non electric bike";
  s = s.replace(/ bike$/, "").replace(/s$/, "");
  s = s.replace(/^non electric hybrid( bike)?$/, "non electric hybrid");
  return ALIASES[s] ?? ALIASES[raw.toLowerCase()] ?? s;
}

async function call(action: string) {
  const { data, error } = await supabase.functions.invoke("quickbooks-products", { body: { action } });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

type Row = {
  key: string; label: string;
  appPrice?: number; pricingPage?: number; booking: boolean; bookingAlt: boolean; api: boolean;
  qb?: QbItem; shopify?: number; shopifyNi?: number;
};

const money = (n?: number) => (n == null ? "—" : `£${n.toFixed(2)}`);

export default function ProductConsistencyReport({ qbItems }: { qbItems: QbItem[] | undefined }) {
  const shopify = useQuery({
    queryKey: ["shopify-retail-products"],
    queryFn: async () => (await call("shopify_list")).products as ShopifyProduct[],
    staleTime: 600000,
  });

  const rows = useMemo(() => {
    const map = new Map<string, Row>();
    const get = (name: string) => {
      const k = productKey(name);
      if (!map.has(k)) map.set(k, { key: k, label: name, booking: false, bookingAlt: false, api: false });
      return map.get(k)!;
    };
    for (const [name, price] of Object.entries(bikeTypePriceMap)) { const r = get(name); r.appPrice ??= price; }
    for (const p of pricingData) get(p.type).pricingPage = p.price;
    for (const t of BOOKING_TYPES) get(t).booking = true;
    for (const t of BOOKING_OPTION_TYPES) get(t).bookingAlt = true;
    for (const t of Object.values(BIKE_TYPE_BY_ID)) { const r = get(t); r.api = true; r.label = t; }
    for (const p of shopify.data || []) {
      const ew = /^within england and wales$/i.test(p.title.trim());
      const ni = /northern ireland/i.test(p.title);
      if (!ew && !ni) continue;
      for (const v of p.variants) { const r = get(v.title); if (ew) r.shopify = v.price; else r.shopifyNi = v.price; }
    }
    const keys = [...map.keys()];
    for (const i of qbItems || []) {
      if (!/collection and delivery within england and wales/i.test(i.name)) continue;
      const k = productKey(i.name);
      const r = map.get(k) ?? (keys.includes(k) ? undefined : get(i.name));
      if (r && (!r.qb || (i.active && !r.qb.active))) r.qb = i;
    }
    return [...map.values()].sort((a, b) => (a.appPrice ?? 999) - (b.appPrice ?? 999) || a.label.localeCompare(b.label));
  }, [qbItems, shopify.data]);

  const issues = (r: Row) => {
    const out: string[] = [];
    if (r.appPrice == null) out.push("Not priced in app");
    if (r.pricingPage != null && r.appPrice != null && r.pricingPage !== r.appPrice) out.push("Pricing page differs");
    if (r.pricingPage == null) out.push("Not on pricing page");
    if (!r.booking) out.push("Not in booking dropdown");
    if (r.booking !== r.bookingAlt) out.push("Booking lists disagree");
    if (!r.qb) out.push("No QuickBooks item");
    else if (r.appPrice != null && Math.abs(r.qb.price - r.appPrice) > 0.005) out.push("QuickBooks price differs");
    if (r.qb && !r.qb.active) out.push("QuickBooks item inactive");
    if (r.shopify == null) out.push("Not on Shopify");
    return out;
  };
  const withIssues = rows.filter((r) => issues(r).length).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Product consistency ({withIssues} of {rows.length} need attention)</CardTitle>
        <p className="text-sm text-muted-foreground">
          Read-only comparison. App, pricing page and QuickBooks prices are ex VAT. Shopify prices are retail, as shown on the website (incl. VAT).
          The Shopify column shows the England &amp; Wales product; NI is shown separately.
        </p>
        {shopify.isError && <p className="text-sm text-destructive">Couldn't read Shopify: {(shopify.error as Error).message}</p>}
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {(shopify.isLoading || !qbItems) ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div> : (
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 pr-2">Product</th><th className="pr-2">App price</th><th className="pr-2">Pricing page</th>
                <th className="pr-2">Booking</th><th className="pr-2">API</th><th className="pr-2">QuickBooks</th>
                <th className="pr-2">Shopify E&amp;W</th><th className="pr-2">Shopify NI</th><th>Issues</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const iss = issues(r);
                return (
                  <tr key={r.key} className={`border-b align-top ${iss.length ? "bg-destructive/5" : ""}`}>
                    <td className="py-2 pr-2 font-medium">{r.label}</td>
                    <td className="pr-2">{money(r.appPrice)}</td>
                    <td className="pr-2">{money(r.pricingPage)}</td>
                    <td className="pr-2">{r.booking ? "Yes" : "—"}</td>
                    <td className="pr-2">{r.api ? "Yes" : "—"}</td>
                    <td className="pr-2">{r.qb ? <span>{money(r.qb.price)}<br /><span className="text-xs text-muted-foreground">{r.qb.name}</span></span> : "—"}</td>
                    <td className="pr-2">{money(r.shopify)}</td>
                    <td className="pr-2">{money(r.shopifyNi)}</td>
                    <td className="space-x-1 space-y-1">
                      {iss.length ? iss.map((i) => <Badge key={i} variant="outline" className="border-destructive/40 text-destructive">{i}</Badge>)
                        : <Badge variant="secondary">Matches</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
