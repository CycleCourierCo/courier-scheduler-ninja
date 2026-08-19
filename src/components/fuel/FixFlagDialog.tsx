import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  resolveAnomaly,
  updateFuelTransaction,
  type FleetVehicleLite,
  type FuelAnomaly,
  type FuelTransactionRecord,
} from "@/services/fuelInvoiceService";

interface FixFlagDialogProps {
  anomaly: FuelAnomaly | null;
  transactions: FuelTransactionRecord[];
  vehicles: FleetVehicleLite[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFixed: (resolvedKey?: string) => void;
}

interface RowDraft {
  vehicleId: string;
  litres: string;
  net: string;
  gross: string;
  date: string;
  time: string;
}

const UNASSIGNED = "__unassigned__";

const toDraft = (row: FuelTransactionRecord): RowDraft => ({
  vehicleId: row.vehicle_id ?? UNASSIGNED,
  litres: String(row.quantity_litres ?? ""),
  net: String(row.net_amount ?? ""),
  gross: String(row.gross_amount ?? ""),
  date: row.trx_date ?? "",
  time: (row.trx_time ?? "").slice(0, 5),
});

const FixFlagDialog: React.FC<FixFlagDialogProps> = ({
  anomaly,
  transactions,
  vehicles,
  open,
  onOpenChange,
  onFixed,
}) => {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [note, setNote] = useState("");

  const rows = useMemo(() => {
    const ids = new Set(anomaly?.transactionIds ?? []);
    return transactions.filter((t) => ids.has(t.id));
  }, [anomaly, transactions]);

  useEffect(() => {
    if (!open) return;
    const next: Record<string, RowDraft> = {};
    rows.forEach((row) => {
      next[row.id] = toDraft(row);
    });
    setDrafts(next);
    setNote("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, anomaly?.key]);

  const setField = (id: string, field: keyof RowDraft, value: string) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const row of rows) {
        const draft = drafts[row.id];
        if (!draft) continue;
        const chosen = vehicles.find((v) => v.id === draft.vehicleId);
        await updateFuelTransaction(row.id, {
          vehicle_id: draft.vehicleId === UNASSIGNED ? null : draft.vehicleId,
          normalised_reg: chosen ? chosen.normalisedReg : row.normalised_reg,
          quantity_litres: Number(draft.litres) || 0,
          net_amount: Number(draft.net) || 0,
          gross_amount: Number(draft.gross) || 0,
          trx_date: draft.date || row.trx_date,
          trx_time: draft.time ? `${draft.time}:00` : null,
          correction_note: note.trim() ? note.trim() : null,
        });
      }
      if (anomaly) {
        await resolveAnomaly(anomaly.key, note.trim() || "fill corrected");
      }
      return anomaly?.key;
    },
    onSuccess: (resolvedKey) => {
      toast.success(rows.length > 1 ? "Fills corrected" : "Fill corrected");
      queryClient.invalidateQueries({ queryKey: ["fuel-transactions"] });
      onFixed(resolvedKey);
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fix this flag</DialogTitle>
          <DialogDescription>{anomaly?.title}</DialogDescription>
        </DialogHeader>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This flag covers the whole vehicle rather than a single fill, so there is nothing to
            correct here — check the vehicle's timeslip mileage instead, or dismiss the flag.
          </p>
        ) : (
          <div className="space-y-4">
            {rows.map((row) => {
              const draft = drafts[row.id];
              if (!draft) return null;
              return (
                <div key={row.id} className="rounded-md border p-3 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    {row.site_name ?? "Unknown site"} · invoice reg{" "}
                    <span className="font-mono">{row.raw_vehicle_id ?? row.normalised_reg ?? "—"}</span>
                  </p>
                  <div className="space-y-1">
                    <Label className="text-xs">Vehicle</Label>
                    <Select
                      value={draft.vehicleId}
                      onValueChange={(value) => setField(row.id, "vehicleId", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select vehicle" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNASSIGNED}>Not matched</SelectItem>
                        {vehicles.map((vehicle) => (
                          <SelectItem key={vehicle.id} value={vehicle.id}>
                            {vehicle.registration}
                            {vehicle.make ? ` — ${vehicle.make}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Litres</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={draft.litres}
                        onChange={(e) => setField(row.id, "litres", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Net (£)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={draft.net}
                        onChange={(e) => setField(row.id, "net", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Gross (£)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={draft.gross}
                        onChange={(e) => setField(row.id, "gross", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Date</Label>
                      <Input
                        type="date"
                        value={draft.date}
                        onChange={(e) => setField(row.id, "date", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Time</Label>
                      <Input
                        type="time"
                        value={draft.time}
                        onChange={(e) => setField(row.id, "time", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="space-y-1">
              <Label className="text-xs">Note (optional)</Label>
              <Textarea
                rows={2}
                placeholder="What was wrong and what you changed"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={rows.length === 0 || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save fix
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FixFlagDialog;
