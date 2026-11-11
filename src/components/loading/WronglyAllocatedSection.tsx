import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Order } from "@/types/order";
import { dismissMisallocated, isWronglyAllocated } from "@/lib/bayOverride";

/** Bikes removed from a bay by an override — the system doesn't know where they physically are. */
export function WronglyAllocatedSection({ orders, onChanged }: { orders: Order[]; onChanged?: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const items = useMemo(() => orders.filter((o) => isWronglyAllocated(o as any)), [orders]);
  if (items.length === 0) return null;

  const dismiss = async (id: string) => {
    setBusy(id);
    try { await dismissMisallocated(id); toast.success("Removed from Wrongly allocated"); onChanged?.(); }
    catch (e: any) { toast.error(e?.message ?? "Could not update"); }
    finally { setBusy(null); }
  };

  return (
    <Card className="border-destructive/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <AlertTriangle className="h-5 w-5 text-destructive" />Wrongly allocated ({items.length})
        </CardTitle>
        <p className="text-xs sm:text-sm text-muted-foreground">
          These bikes were in a bay on the system but not physically there. Find them, then allocate them with Scan to bay or the search below.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((o) => (
          <div key={o.id} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 text-sm">
              <div className="font-medium truncate">{o.sender?.name} · {o.bikeBrand} {o.bikeModel}</div>
              <div className="text-xs text-muted-foreground">
                <span className="font-mono">{o.trackingNumber}</span>
                {" · "}was in <Badge variant="outline" className="text-xs">{o.misallocated_from}</Badge>
                {" · "}overridden by {o.misallocated_by_name || "staff"}
                {o.misallocated_at && ` ${formatDistanceToNow(new Date(o.misallocated_at), { addSuffix: true })}`}
              </div>
            </div>
            <Button size="sm" variant="outline" disabled={busy === o.id} onClick={() => dismiss(o.id)}>Mark found / dismiss</Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
