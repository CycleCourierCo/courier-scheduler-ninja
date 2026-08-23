import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { notify } from "@/lib/notify";
import { Bike, Download, Plus, Trash2, Upload, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { pricingData } from "@/constants/bikePricing";

const BIKE_TYPES = pricingData.map((p) => p.type);

type SkuRow = {
  id: string;
  sku: string;
  bike_type: string;
  is_active: boolean;
  created_at: string;
};

type ParsedRow = { sku: string; bike_type: string; error?: string };

interface Props {
  userId: string | undefined;
  storeId: string | null;
  hasStore: boolean;
}

const normaliseType = (raw: string) => {
  const val = raw.trim();
  if (!val) return "";
  const exact = BIKE_TYPES.find((t) => t.toLowerCase() === val.toLowerCase());
  if (exact) return exact;
  const partial = BIKE_TYPES.find(
    (t) => t.toLowerCase().includes(val.toLowerCase()) || val.toLowerCase().includes(t.toLowerCase()),
  );
  return partial || "";
};

const CustomerSkuManager = ({ userId, storeId, hasStore }: Props) => {
  const [rows, setRows] = useState<SkuRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editing, setEditing] = useState<SkuRow | null>(null);
  const [sku, setSku] = useState("");
  const [bikeType, setBikeType] = useState("");
  const [csvText, setCsvText] = useState("");
  const [bulkType, setBulkType] = useState("");
  const [importing, setImporting] = useState(false);
  const [pulling, setPulling] = useState(false);

  const load = async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("customer_shopify_skus")
      .select("id, sku, bike_type, is_active, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Couldn't load your SKUs.");
      return;
    }
    setRows((data as SkuRow[]) || []);
  };

  useEffect(() => {
    load();
  }, [userId]);

  const openAdd = (row?: SkuRow) => {
    setEditing(row ?? null);
    setSku(row?.sku ?? "");
    setBikeType(row?.bike_type ?? "");
    setAddOpen(true);
  };

  const save = async () => {
    if (!userId) return;
    if (!sku.trim() || !bikeType) {
      toast.error("Enter a SKU and choose a bike type.");
      return;
    }
    setLoading(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from("customer_shopify_skus")
          .update({ sku: sku.trim(), bike_type: bikeType })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customer_shopify_skus").upsert(
          { user_id: userId, store_id: storeId, sku: sku.trim(), bike_type: bikeType },
          { onConflict: "user_id,sku" },
        );
        if (error) throw error;
      }
      toast.success("SKU saved");
      setAddOpen(false);
      await load();
    } catch (err: any) {
      toast.error(err.message || "Couldn't save that SKU.");
    } finally {
      setLoading(false);
    }
  };

  const remove = (row: SkuRow) => {
    notify.confirm({
      title: `Remove SKU ${row.sku}?`,
      description: "Sales on this SKU will stop auto-booking a collection.",
      confirmLabel: "Remove",
      destructive: true,
      onConfirm: async () => {
        const { error } = await supabase.from("customer_shopify_skus").delete().eq("id", row.id);
        if (error) {
          toast.error("Couldn't remove that SKU.");
          return;
        }
        toast.success("Removed");
        await load();
      },
    });
  };

  const parsed = useMemo<ParsedRow[]>(() => {
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    return lines
      .filter((l, i) => !(i === 0 && /^sku\s*[,;]/i.test(l)))
      .map((line) => {
        const [rawSku, rawType] = line.split(/[,;\t]/).map((c) => (c || "").trim());
        if (!rawSku) return { sku: "", bike_type: "", error: "Missing SKU" };
        const type = normaliseType(rawType || bulkType);
        if (!type) {
          return { sku: rawSku, bike_type: "", error: "Unknown bike type" };
        }
        return { sku: rawSku, bike_type: type };
      });
  }, [csvText, bulkType]);

  const validRows = parsed.filter((r) => !r.error);
  const invalidRows = parsed.filter((r) => r.error);

  const importRows = async () => {
    if (!userId || validRows.length === 0) return;
    setImporting(true);
    try {
      const seen = new Set<string>();
      const payload = validRows
        .filter((r) => {
          const key = r.sku.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((r) => ({ user_id: userId, store_id: storeId, sku: r.sku, bike_type: r.bike_type }));

      const { error } = await supabase
        .from("customer_shopify_skus")
        .upsert(payload, { onConflict: "user_id,sku" });
      if (error) throw error;
      toast.success(`Imported ${payload.length} SKU${payload.length === 1 ? "" : "s"}`);
      setCsvText("");
      setBulkOpen(false);
      await load();
    } catch (err: any) {
      toast.error(err.message || "Couldn't import those SKUs.");
    } finally {
      setImporting(false);
    }
  };

  const pullFromShopify = async () => {
    setPulling(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-shopify-connect", {
        body: { action: "list_products" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const products = ((data as any)?.products || []) as { sku: string; title: string }[];
      if (products.length === 0) {
        toast.error("No product SKUs found in your Shopify store.");
        return;
      }
      const existing = new Set(rows.map((r) => r.sku.toLowerCase()));
      const fresh = products.filter((p) => !existing.has(p.sku.toLowerCase()));
      setCsvText(
        (fresh.length > 0 ? fresh : products)
          .map((p) => `${p.sku},${bulkType || ""}`)
          .join("\n"),
      );
      toast.success(
        `Pulled ${fresh.length > 0 ? fresh.length : products.length} SKUs — set the bike type below, then import.`,
      );
    } catch (err: any) {
      toast.error(err.message || "Couldn't fetch products from Shopify.");
    } finally {
      setPulling(false);
    }
  };

  const downloadTemplate = () => {
    const csv = "sku,bike_type\nEXAMPLE-001,Non-Electric Bikes\nEXAMPLE-002,Electric Bikes under 25kg\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "sku-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFile = async (file: File) => {
    setCsvText(await file.text());
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bike className="h-5 w-5" /> My SKUs (not stored with us)
            </CardTitle>
            <CardDescription>
              Register the SKUs you sell from your own premises. When one sells, we book a
              collection from you instead of dispatching from our warehouse. Brand, model and
              value come from the Shopify order itself.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}>
              <Upload className="h-4 w-4 mr-1" /> Bulk upload
            </Button>
            <Button size="sm" onClick={() => openAdd()}>
              <Plus className="h-4 w-4 mr-1" /> Add SKU
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No SKUs registered yet.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-3 p-3 rounded border text-sm flex-wrap"
              >
                <code className="text-xs bg-muted px-2 py-1 rounded">{row.sku}</code>
                <Badge variant="secondary">{row.bike_type}</Badge>
                {!row.is_active && <Badge variant="outline">inactive</Badge>}
                <div className="ml-auto flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openAdd(row)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(row)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit SKU" : "Add SKU"}</DialogTitle>
            <DialogDescription>
              The SKU must match the variant SKU in your Shopify store exactly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>SKU</Label>
              <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="e.g. TREK-DOMANE-56" />
            </div>
            <div>
              <Label>Bike type</Label>
              <Select value={bikeType} onValueChange={setBikeType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select bike type" />
                </SelectTrigger>
                <SelectContent>
                  {BIKE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk upload SKUs</DialogTitle>
            <DialogDescription>
              One SKU per line as <code>sku,bike type</code>. Leave the bike type blank to use the
              default below. Existing SKUs are updated, not duplicated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-1" /> Template
              </Button>
              <Button size="sm" variant="outline" asChild>
                <label className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-1" /> Upload CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
                  />
                </label>
              </Button>
              {hasStore && (
                <Button size="sm" variant="outline" onClick={pullFromShopify} disabled={pulling}>
                  <RefreshCw className={`h-4 w-4 mr-1 ${pulling ? "animate-spin" : ""}`} />
                  {pulling ? "Fetching..." : "Import from Shopify"}
                </Button>
              )}
            </div>

            <div>
              <Label>Default bike type (used when a row has none)</Label>
              <Select value={bulkType} onValueChange={setBulkType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select bike type" />
                </SelectTrigger>
                <SelectContent>
                  {BIKE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>SKUs</Label>
              <Textarea
                rows={8}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={"TREK-DOMANE-56,Non-Electric Bikes\nSPEC-TURBO-M,Electric Bikes under 25kg"}
                className="font-mono text-xs"
              />
            </div>

            {parsed.length > 0 && (
              <div className="text-sm space-y-1">
                <p>
                  <span className="text-green-600 font-medium">{validRows.length} ready</span>
                  {invalidRows.length > 0 && (
                    <span className="text-destructive font-medium">
                      {" "}· {invalidRows.length} need attention
                    </span>
                  )}
                </p>
                {invalidRows.slice(0, 6).map((r, i) => (
                  <p key={i} className="text-xs text-destructive">
                    {r.sku || "(blank)"} — {r.error}
                  </p>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button onClick={importRows} disabled={importing || validRows.length === 0}>
              {importing ? "Importing..." : `Import ${validRows.length}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default CustomerSkuManager;
