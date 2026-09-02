import React, { useEffect, useMemo, useState } from "react";
import * as Sentry from "@sentry/react";
import { toast } from "sonner";
import { notify } from "@/lib/notify";
import { Trash2, FileText, PackageCheck, Layers } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BikeDiagram from "./BikeDiagram";
import PickComponentDialog from "./PickComponentDialog";
import { BUILD_STAGES, BUILD_STAGE_LABELS, type BikeHotspot, type BuildStage } from "@/constants/bikeComponents";
import type { BikeBuild, BikeBuildComponent } from "@/types/bikeBuild";
import type { WarehouseStock } from "@/types/warehouseStock";
import {
  addComponentToBuild,
  saveBuildAsTemplate,
  completeBikeBuild,
  createBuildInvoice,
  getAvailableComponents,
  getBikeBuildComponents,
  removeComponentFromBuild,
  setBikeBuildStage,
  updateBikeBuild,
} from "@/services/bikeBuildService";
import { useStorageBays } from "@/hooks/useStorageBays";
import { useAuth } from "@/contexts/AuthContext";

type Props = {
  build: BikeBuild | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
  /** Staff control labour, stages and invoicing; customers only allocate parts. */
  isStaff?: boolean;
};

const BuildDetailDialog: React.FC<Props> = ({ build, open, onOpenChange, onChanged, isStaff = true }) => {
  const { user } = useAuth();
  const { bays } = useStorageBays(false, build?.site_id ?? null);
  const [components, setComponents] = useState<BikeBuildComponent[]>([]);
  const [stock, setStock] = useState<WarehouseStock[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [hotspot, setHotspot] = useState<BikeHotspot | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [labour, setLabour] = useState("0");
  const [bay, setBay] = useState("");
  const [position, setPosition] = useState(1);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!build) return;
    setLoading(true);
    try {
      const [comps, available] = await Promise.all([
        getBikeBuildComponents(build.id),
        getAvailableComponents(build.user_id, build.site_id),
      ]);
      setComponents(comps);
      setStock(available);
    } catch (err) {
      Sentry.captureException(err);
      toast.error("Couldn't load this build. Refresh and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && build) {
      setLabour(String(build.labour_cost ?? 0));
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, build?.id]);

  const countsBySlot = useMemo(() => {
    const counts: Record<string, number> = {};
    components.forEach((c) => {
      if (c.slot) counts[c.slot] = (counts[c.slot] || 0) + 1;
    });
    return counts;
  }, [components]);

  const partsTotal = useMemo(
    () => components.reduce((sum, c) => sum + Number(c.unit_value || 0) * Number(c.quantity || 1), 0),
    [components]
  );

  if (!build) return null;

  const handleAdd = async (items: WarehouseStock[]) => {
    setAdding(true);
    try {
      for (const item of items) {
        await addComponentToBuild({
          buildId: build.id,
          stock: item,
          slot: hotspot?.slot ?? null,
          addedBy: user?.id || "",
        });
      }
      toast.success(`${items.length} part${items.length === 1 ? "" : "s"} added to the build`);
      setPickOpen(false);
      await load();
      onChanged();
    } catch (err) {
      Sentry.captureException(err);
      toast.error("Couldn't add those parts. Refresh and try again.");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = (component: BikeBuildComponent) => {
    notify.confirm({
      title: "Remove this part from the build?",
      description: "It goes back into the customer's stock as available.",
      confirmLabel: "Remove",
      destructive: true,
      onConfirm: async () => {
        try {
          await removeComponentFromBuild(component.id, build.id, component.stock_id);
          toast.success("Part removed");
          await load();
          onChanged();
        } catch (err) {
          Sentry.captureException(err);
          toast.error("Couldn't remove that part. Try again.");
        }
      },
    });
  };

  const handleStage = async (stage: BuildStage) => {
    try {
      await setBikeBuildStage(build.id, stage);
      toast.success(`Moved to ${BUILD_STAGE_LABELS[stage]}`);
      onChanged();
    } catch (err) {
      Sentry.captureException(err);
      toast.error("Couldn't update the build stage. Try again.");
    }
  };

  const handleLabourSave = async () => {
    try {
      await updateBikeBuild(build.id, { labour_cost: parseFloat(labour) || 0 } as any);
      toast.success("Labour charge saved");
      onChanged();
    } catch (err) {
      Sentry.captureException(err);
      toast.error("Couldn't save the labour charge. Try again.");
    }
  };

  const handleSaveAsTemplate = async () => {
    const name = window.prompt("Name for this stored build", build.name);
    if (!name) return;
    setBusy(true);
    try {
      await saveBuildAsTemplate(build, name, user?.id || "");
      toast.success("Saved as a stored build — create it again in one click from the Stored builds tab");
    } catch (err) {
      Sentry.captureException(err);
      toast.error("Couldn't save this build as a stored build. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleComplete = async () => {
    if (!bay) {
      toast.error("Choose the bay and position where the finished bike will live.");
      return;
    }
    setBusy(true);
    try {
      await completeBikeBuild(build, { bay, position }, user?.id || "");
      toast.success("Build complete — bike added to warehouse stock");
      await load();
      onChanged();
    } catch (err) {
      Sentry.captureException(err);
      toast.error("Couldn't complete the build. Check the bay is free and try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleInvoice = async () => {
    setBusy(true);
    try {
      const result = await createBuildInvoice(build.id);
      toast.success(`Invoice ${result.invoiceNumber || ""} created in QuickBooks`);
      onChanged();
    } catch (err: any) {
      Sentry.captureException(err);
      toast.error(err?.message || "Couldn't create the invoice. Check QuickBooks is connected.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-full max-w-[calc(100vw-2rem)] sm:max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>{build.name}</DialogTitle>
            <DialogDescription>
              {build.customer_name}
              {[build.bike_brand, build.bike_model].filter(Boolean).length > 0 &&
                ` · ${[build.bike_brand, build.bike_model].filter(Boolean).join(" ")}`}
              {build.sku ? ` · SKU ${build.sku}` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="w-full min-w-0 space-y-5">
            <div className="flex flex-wrap items-end gap-3">
              {isStaff ? (
              <div className="min-w-[220px]">
                <Label>Stage</Label>
                <Select value={build.stage} onValueChange={(v) => handleStage(v as BuildStage)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUILD_STAGES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              ) : (
                <Badge variant="outline" className="mb-2">{BUILD_STAGE_LABELS[build.stage]}</Badge>
              )}
              {isStaff && (
                <>
                  <div className="w-[140px]">
                    <Label>Labour (£)</Label>
                    <Input type="number" value={labour} onChange={(e) => setLabour(e.target.value)} onBlur={handleLabourSave} />
                  </div>
                  <div className="text-sm text-muted-foreground pb-2">
                    Parts £{partsTotal.toFixed(2)} · Total £{(partsTotal + (parseFloat(labour) || 0)).toFixed(2)}
                  </div>
                </>
              )}
              <Button variant="outline" size="sm" className="mb-1" onClick={handleSaveAsTemplate} disabled={busy}>
                <Layers className="mr-2 h-4 w-4" /> Save as stored build
              </Button>
            </div>

            <BikeDiagram
              countsBySlot={countsBySlot}
              disabled={loading || build.stage === "invoiced"}
              onSelectSlot={(hs) => {
                setHotspot(hs);
                setPickOpen(true);
              }}
            />

            <div className="min-w-0">

              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm">Components ({components.length})</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setHotspot(null);
                    setPickOpen(true);
                  }}
                  disabled={build.stage === "invoiced"}
                >
                  Add any part
                </Button>
              </div>
              {components.length === 0 ? (
                <p className="text-sm text-muted-foreground border rounded-md p-4 text-center">
                  No parts allocated yet. Click an area on the bike to pick parts from stock.
                </p>
              ) : (
                <div className="min-w-0 space-y-2">
                  {components.map((c) => (
                    <div key={c.id} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-md border p-3">
                      <div className="min-w-0 flex-1 basis-full sm:basis-0">
                        <div className="text-sm font-medium truncate">
                          {[c.stock?.bike_brand, c.stock?.bike_model].filter(Boolean).join(" ") || c.category}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {[c.category, c.stock?.spec, c.slot ? `slot: ${c.slot}` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </div>
                      {c.stock && (
                        <Badge variant="outline" className="hidden sm:inline-flex text-[10px] shrink-0">
                          Bay {c.stock.bay} · Pos {c.stock.position}
                        </Badge>
                      )}
                      <div className="text-sm shrink-0 sm:w-16 sm:text-right">
                        {c.unit_value != null ? `£${Number(c.unit_value).toFixed(2)}` : "—"}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive shrink-0 ml-auto sm:ml-0"
                        onClick={() => handleRemove(c)}
                        disabled={build.stage === "invoiced"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

              )}
            </div>

            {isStaff && !build.linked_stock_id && (
              <div className="rounded-md border p-4 space-y-3">
                <h3 className="font-semibold text-sm">Finish the build</h3>
                <p className="text-xs text-muted-foreground">
                  Marks the build as built, consumes the allocated parts and adds the finished bike to the customer's stock.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Bay</Label>
                    <Select value={bay} onValueChange={(v) => { setBay(v); setPosition(1); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select bay" />
                      </SelectTrigger>
                      <SelectContent>
                        {bays.map((b) => (
                          <SelectItem key={b.id} value={b.label}>Bay {b.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Position</Label>
                    <Select value={String(position)} onValueChange={(v) => setPosition(parseInt(v))} disabled={!bay}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from(
                          { length: bays.find((b) => b.label === bay)?.position_count ?? 0 },
                          (_, i) => i + 1
                        ).map((p) => (
                          <SelectItem key={p} value={String(p)}>Position {p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleComplete} disabled={busy || components.length === 0}>
                  <PackageCheck className="mr-2 h-4 w-4" /> Mark bike built
                </Button>
              </div>
            )}

            {(isStaff || build.invoice_number) && (
            <div className="rounded-md border p-4 space-y-3">
              <h3 className="font-semibold text-sm">Invoice</h3>
              {build.invoice_number ? (
                <p className="text-sm">
                  Invoice {build.invoice_number} raised
                  {build.invoice_url && (
                    <>
                      {" · "}
                      <a href={build.invoice_url} target="_blank" rel="noreferrer" className="underline">
                        Open in QuickBooks
                      </a>
                    </>
                  )}
                </p>
              ) : (
                <Button variant="outline" onClick={handleInvoice} disabled={busy}>
                  <FileText className="mr-2 h-4 w-4" /> Create QuickBooks invoice
                </Button>
              )}
            </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <PickComponentDialog
        open={pickOpen}
        onOpenChange={setPickOpen}
        hotspot={hotspot}
        stock={stock}
        adding={adding}
        onAdd={handleAdd}
      />
    </>
  );
};

export default BuildDetailDialog;
