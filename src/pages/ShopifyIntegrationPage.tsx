import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, ExternalLink, ShoppingBag, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";

const WEBHOOK_URL = `https://axigtrmaxhetyfzjjdve.supabase.co/functions/v1/customer-shopify-webhook`;

const ShopifyIntegrationPage = () => {
  const { user } = useAuth();
  const [shopDomain, setShopDomain] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [store, setStore] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  const loadStore = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("customer_shopify_stores" as any)
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    setStore(data);
    if (data) setShopDomain((data as any).shop_domain || "");

    const { data: logData } = await supabase
      .from("customer_shopify_order_log" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setLogs((logData as any[]) || []);
  };

  useEffect(() => {
    loadStore();
  }, [user?.id]);

  const handleSave = async () => {
    if (!shopDomain || !accessToken || !webhookSecret) {
      toast.error("All fields required");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-shopify-connect", {
        body: {
          action: "save",
          shop_domain: shopDomain,
          access_token: accessToken,
          webhook_secret: webhookSecret,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Shopify store connected!");
      setAccessToken("");
      setWebhookSecret("");
      await loadStore();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    if (!shopDomain || !accessToken) {
      toast.error("Enter shop domain and access token first");
      return;
    }
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-shopify-connect", {
        body: { action: "test", shop_domain: shopDomain, access_token: accessToken },
      });
      if (error) throw error;
      if ((data as any)?.success) {
        toast.success(`Connected to ${(data as any).shop || shopDomain}`);
      } else {
        toast.error(`Test failed: ${(data as any)?.message || "Unknown error"}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Test failed");
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect your Shopify store? Auto-dispatch will stop.")) return;
    const { error } = await supabase.functions.invoke("customer-shopify-connect", {
      body: { action: "disconnect" },
    });
    if (error) {
      toast.error("Failed to disconnect");
      return;
    }
    toast.success("Disconnected");
    setStore(null);
    setShopDomain("");
    await loadStore();
  };

  const copy = (txt: string) => {
    navigator.clipboard.writeText(txt);
    toast.success("Copied");
  };

  const statusBadge = (s: string) => {
    if (s === "matched" || s === "fulfilled")
      return <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />{s}</Badge>;
    if (s === "unmatched_sku")
      return <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1" />unmatched SKU</Badge>;
    return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />{s}</Badge>;
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <ShoppingBag className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">Shopify Integration</h1>
          {store?.is_active && <Badge className="bg-green-600">Connected</Badge>}
        </div>

        {!store && (
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>How it works</AlertTitle>
            <AlertDescription>
              Connect your Shopify store and we'll automatically book delivery from our warehouse
              when one of your products sells. Match happens on <strong>SKU</strong> — each bike
              stored with us must have the same SKU as your Shopify product variant.
            </AlertDescription>
          </Alert>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Setup steps</CardTitle>
            <CardDescription>One-time setup in your Shopify admin</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="font-medium">1. Create a Custom App</p>
              <p className="text-muted-foreground">
                In Shopify admin → Settings → Apps and sales channels → Develop apps → Create an app.
              </p>
            </div>
            <div>
              <p className="font-medium">2. Configure Admin API scopes</p>
              <p className="text-muted-foreground">
                Enable: <code className="px-1 bg-muted rounded">read_orders</code>,{" "}
                <code className="px-1 bg-muted rounded">write_merchant_managed_fulfillment_orders</code>,{" "}
                <code className="px-1 bg-muted rounded">write_fulfillments</code>,{" "}
                <code className="px-1 bg-muted rounded">read_products</code>.
              </p>
            </div>
            <div>
              <p className="font-medium">3. Install and copy the Admin API access token</p>
              <p className="text-muted-foreground">Starts with <code>shpat_</code>.</p>
            </div>
            <div>
              <p className="font-medium">4. Add an Orders Paid webhook</p>
              <p className="text-muted-foreground">
                Settings → Notifications → Webhooks. Event: <strong>Order payment</strong>. Format: JSON.
                URL:
              </p>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-xs bg-muted px-2 py-1 rounded flex-1 break-all">{WEBHOOK_URL}</code>
                <Button size="sm" variant="ghost" onClick={() => copy(WEBHOOK_URL)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-muted-foreground mt-1">
                Then copy the webhook signing secret shown by Shopify (starts with a long random string).
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{store ? "Connection" : "Connect your store"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Shop domain</Label>
              <Input
                value={shopDomain}
                onChange={(e) => setShopDomain(e.target.value)}
                placeholder="myshop.myshopify.com"
                disabled={!!store}
              />
            </div>
            <div>
              <Label>Admin API access token</Label>
              <Input
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder={store ? "•••• (already saved — paste to update)" : "shpat_..."}
              />
            </div>
            <div>
              <Label>Webhook signing secret</Label>
              <Input
                type="password"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder={store ? "•••• (already saved — paste to update)" : "from Shopify webhooks page"}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={loading}>
                {loading ? "Saving..." : store ? "Update" : "Connect"}
              </Button>
              <Button variant="outline" onClick={handleTest} disabled={testing}>
                {testing ? "Testing..." : "Test connection"}
              </Button>
              {store && (
                <Button variant="destructive" onClick={handleDisconnect} className="ml-auto">
                  Disconnect
                </Button>
              )}
            </div>
            {store?.last_synced_at && (
              <p className="text-xs text-muted-foreground">
                Last activity {formatDistanceToNow(new Date(store.last_synced_at), { addSuffix: true })}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Last 30 webhook events from your Shopify</CardDescription>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-3 rounded border text-sm"
                  >
                    {statusBadge(log.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">#{log.shopify_order_number}</span>
                        {log.line_item_sku && !log.line_item_sku.startsWith("__") && (
                          <code className="text-xs bg-muted px-1 rounded">{log.line_item_sku}</code>
                        )}
                      </div>
                      {log.message && (
                        <p className="text-muted-foreground text-xs mt-1">{log.message}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {log.linked_order_id && (
                      <Button size="sm" variant="ghost" asChild>
                        <a href={`/customer-orders/${log.linked_order_id}`}>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ShopifyIntegrationPage;
