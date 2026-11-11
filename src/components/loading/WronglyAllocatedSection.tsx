import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Order } from "@/types/order";
import { dismissMisallocated, isWronglyAllocated } from "@/lib/bayOverride";
import { ChangeStorageLocationDialog, BikeLocationValue } from "@/components/loading/ChangeStorageLocationDialog";

interface Props {
  orders: Order[];
  onChanged?: () => void;
  /** Put the bike(s) back into bays. Resolves true when saved (occupied bays go through the override popup). */
  onAssign?: (orderId: string, locations: BikeLocationValue[]) => Promise<boolean>;
}

/** Bikes removed from a bay by an override — the system doesn't know where they physically are. */
export function WronglyAllocatedSection({ orders, onChanged, onAssign }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<Order | null>(null);
  const [saving, setSaving] = useState(false);
  const items = useMemo(() => orders.filter((o) => isWronglyAllocated(o as any)), [orders]);
  if (items.length === 0 && !assigning) return null;

  const dismiss = async (id: string) => {
    setBusy(id);
    try { await dismissMisallocated(id); toast.success("Removed from Wrongly allocated"); onChanged?.(); }
    catch (e: any) { toast.error(e?.message ?? "Could not update"); }
    finally { setBusy(null); }
  };

  const bikeCount = Math.max(1, assigning?.bikeQuantity || 1);
  const initialLocations: BikeLocationValue[] = Array.from({ length: bikeCount }, () => ({ bay: "", position: 0 }));

  const save = async (locations: BikeLocationValue[]) => {
    if (!assigning || !onAssign) return;
    setSaving(true);
    try {
      const ok = await onAssign(assigning.id, locations);
      if (ok) setAssigning(null);
    } finally { setSaving(false); }
  };

  return (
    <>
      {items.length > 0 && (
        <Card className="border-destructive/40">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <AlertTriangle className="h-5 w-5 text-destructive" />Wrongly allocated ({items.length})
            </CardTitle>
            <p className="text-xs sm:text-sm text-muted-foreground">
              These bikes were in a bay on the system but not physically there. Once found, assign them to a bay — or dismiss if they've left the depot.
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
                <div className="flex gap-2 shrink-0">
                  {onAssign && (
                    <Button size="sm" className="flex-1 sm:flex-none" disabled={busy === o.id} onClick={() => setAssigning(o)}>
                      Assign to bay
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="flex-1 sm:flex-none" disabled={busy === o.id} onClick={() => dismiss(o.id)}>
                    Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <ChangeStorageLocationDialog
        open={!!assigning}
        onOpenChange={(open) => { if (!open && !saving) setAssigning(null); }}
        initialLocations={initialLocations}
        subtitle={assigning ? `${assigning.sender?.name ?? ""} · ${assigning.bikeBrand ?? ""} ${assigning.bikeModel ?? ""} · ${assigning.trackingNumber ?? ""}` : undefined}
        saving={saving}
        onSave={save}
      />
    </>
  );
}
