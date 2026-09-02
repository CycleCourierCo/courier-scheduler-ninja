import React, { useEffect, useState } from "react";
import * as Sentry from "@sentry/react";
import { toast } from "sonner";
import { notify } from "@/lib/notify";
import { Bike, Layers, Plus, Trash2 } from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useSites, defaultSite, findSite, DEFAULT_SITE_CODE } from "@/hooks/useSites";
import { getCustomerList } from "@/services/warehouseStockService";
import {
  addComponentToBuild,
  createBikeBuild,
  deleteBikeBuild,
  getAvailableComponents,
  getBikeBuilds,
} from "@/services/bikeBuildService";
import type { BikeBuild, BikeBuildFormData } from "@/types/bikeBuild";
import type { WarehouseStock } from "@/types/warehouseStock";
import { BUILD_STAGES, BUILD_STAGE_COLORS, BUILD_STAGE_LABELS, slotForCategory, type BikeHotspot } from "@/constants/bikeComponents";
import BuildDetailDialog from "@/components/build-my-bike/BuildDetailDialog";
import StoredBuildsTab from "@/components/build-my-bike/StoredBuildsTab";
import StockPickerList from "@/components/build-my-bike/StockPickerList";
import BikeDiagram from "@/components/build-my-bike/BikeDiagram";
import { hasAnyRole } from "@/lib/roles";
import { format } from "date-fns";


const emptyForm: BikeBuildFormData = {
  user_id: "",
  name: "",
  sku: "",
  bike_brand: "",
  bike_model: "",
  bike_type: "",
  spec_notes: "",
  labour_cost: "",
};

const BuildMyBikePage: React.FC = () => {
  const { user, userProfile } = useAuth();
  const isStaff = hasAnyRole(userProfile, ["admin", "loader", "mechanic", "cs_agent"]);
  const { data: sites = [] } = useSites();
  // Builds draw on Birmingham warehouse stock only for now.
  const activeSiteId = isStaff
    ? findSite(sites, DEFAULT_SITE_CODE)?.id ?? defaultSite(sites)?.id ?? null
    : null;
  const [tab, setTab] = useState<"builds" | "stored">("builds");

  const [builds, setBuilds] = useState<BikeBuild[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [customerFilter, setCustomerFilter] = useState<string>("all");

  const [newOpen, setNewOpen] = useState(false);
  const [step, setStep] = useState<"details" | "parts">("details");
  const [form, setForm] = useState<BikeBuildFormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState<BikeBuild | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [availableStock, setAvailableStock] = useState<WarehouseStock[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [pickedParts, setPickedParts] = useState<string[]>([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [buildData, customerData] = await Promise.all([
        getBikeBuilds(null),
        isStaff ? getCustomerList() : Promise.resolve([]),
      ]);
      setBuilds(buildData);
      setCustomers(customerData as any[]);
      setSelected((prev) => (prev ? buildData.find((b) => b.id === prev.id) ?? null : null));
    } catch (err) {
      Sentry.captureException(err);
      toast.error("Couldn't load bike builds right now. Refresh the page to try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSiteId]);

  const openNewBuild = () => {
    setForm(emptyForm);
    setPickedParts([]);
    setAvailableStock([]);
    setStep("details");
    setNewOpen(true);
  };

  const targetCustomerId = isStaff ? form.user_id : user?.id || "";

  const goToParts = async () => {
    if (!targetCustomerId) {
      toast.error("Pick which customer this build is for.");
      return;
    }
    if (!form.name.trim()) {
      toast.error("Give the build a name so the workshop can identify it.");
      return;
    }
    setStep("parts");
    setStockLoading(true);
    try {
      const stock = await getAvailableComponents(targetCustomerId, activeSiteId);
      setAvailableStock(stock);
    } catch (err) {
      Sentry.captureException(err);
      toast.error("Couldn't load available parts. You can still create the build and add parts after.");
      setAvailableStock([]);
    } finally {
      setStockLoading(false);
    }
  };

  const togglePart = (id: string) => {
    setPickedParts((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  const pickedTotal = availableStock
    .filter((s) => pickedParts.includes(s.id))
    .reduce((sum, s) => sum + Number(s.bike_value || 0), 0);

  const handleCreate = async () => {
    const targetUserId = targetCustomerId;
    if (!targetUserId) {
      toast.error("Pick which customer this build is for.");
      return;
    }
    if (!form.name.trim()) {
      toast.error("Give the build a name so the workshop can identify it.");
      return;
    }
    setSubmitting(true);
    try {
      const build = await createBikeBuild(
        {
          ...form,
          user_id: targetUserId,
          labour_cost: isStaff ? form.labour_cost : "",
          site_id: activeSiteId,
        },
        user?.id || ""
      );

      const parts = availableStock.filter((s) => pickedParts.includes(s.id));
      const failed: string[] = [];
      for (const stock of parts) {
        try {
          await addComponentToBuild({
            buildId: build.id,
            stock,
            slot: slotForCategory(stock.component_category),
            addedBy: user?.id || "",
          });
        } catch (err) {
          Sentry.captureException(err);
          failed.push(
            [stock.bike_brand, stock.bike_model].filter(Boolean).join(" ") ||
              stock.component_category ||
              "part"
          );
        }
      }

      if (failed.length > 0) {
        toast.warning(`Build created, but these parts couldn't be allocated: ${failed.join(", ")}`);
      } else {
        toast.success(
          parts.length > 0 ? `Build created with ${parts.length} part${parts.length === 1 ? "" : "s"}` : "Build created"
        );
      }
      setNewOpen(false);
      setForm(emptyForm);
      setPickedParts([]);
      setAvailableStock([]);
      setStep("details");
      fetchData();
    } catch (err) {
      Sentry.captureException(err);
      toast.error("Couldn't create the build. Check the details and try again.");
    } finally {
      setSubmitting(false);
    }
  };


  const handleDelete = (build: BikeBuild) => {
    notify.confirm({
      title: `Delete "${build.name}"?`,
      description: "Allocated parts go back into stock as available.",
      confirmLabel: "Delete",
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteBikeBuild(build.id);
          toast.success("Build deleted");
          fetchData();
        } catch (err) {
          Sentry.captureException(err);
          toast.error("Couldn't delete that build. Try again.");
        }
      },
    });
  };

  const filtered = builds.filter(
    (b) =>
      (stageFilter === "all" || b.stage === stageFilter) &&
      (customerFilter === "all" || b.user_id === customerFilter)
  );


  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bike className="h-6 w-6" />
              Build My Bike
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Assemble customer bikes from components held in warehouse stock
            </p>

          </div>
          {tab === "builds" && (
            <Button onClick={openNewBuild}>
              <Plus className="mr-2 h-4 w-4" /> New build
            </Button>
          )}
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "builds" | "stored")} className="mb-6">
          <TabsList>
            <TabsTrigger value="builds">
              <Bike className="mr-2 h-4 w-4" /> Builds
            </TabsTrigger>
            <TabsTrigger value="stored">
              <Layers className="mr-2 h-4 w-4" /> Stored builds
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === "stored" ? (
          <StoredBuildsTab
            isStaff={isStaff}
            customers={customers}
            currentUserId={user?.id || ""}
            restrictToUserId={isStaff ? null : user?.id || null}
            siteId={activeSiteId}
            onBuildCreated={() => { setTab("builds"); fetchData(); }}
          />
        ) : (
        <>
        {/* Stage summary */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {BUILD_STAGES.map((stage) => {
            const count = builds.filter((b) => b.stage === stage.value).length;
            return (
              <Card
                key={stage.value}
                className="cursor-pointer hover:border-primary transition"
                onClick={() => setStageFilter(stageFilter === stage.value ? "all" : stage.value)}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-xs text-muted-foreground leading-tight">{stage.label}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mb-4 flex flex-col sm:flex-row gap-2">
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-full sm:w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {BUILD_STAGES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isStaff && (
            <Select value={customerFilter} onValueChange={setCustomerFilter}>
              <SelectTrigger className="w-full sm:w-[260px]">
                <SelectValue placeholder="All customers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All customers</SelectItem>
                {customers.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.company_name || c.name || c.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>


        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Bike className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No bike builds yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((build) => (
              <Card
                key={build.id}
                className="cursor-pointer hover:border-primary transition"
                onClick={() => { setSelected(build); setDetailOpen(true); }}
              >
                <CardContent className="pt-4 pb-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{build.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{build.customer_name}</div>
                    </div>
                    {isStaff && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive shrink-0"
                        onClick={(e) => { e.stopPropagation(); handleDelete(build); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}

                  </div>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${BUILD_STAGE_COLORS[build.stage]}`}>
                    {BUILD_STAGE_LABELS[build.stage]}
                  </span>
                  <div className="flex flex-wrap gap-1 text-xs">
                    <Badge variant="outline">{build.component_count ?? 0} parts</Badge>
                    {build.sku && <Badge variant="secondary">SKU {build.sku}</Badge>}
                    {(isStaff || build.invoice_number) && (
                      <Badge variant="outline">
                        £{(Number(build.parts_total || 0) + Number(build.labour_cost || 0)).toFixed(2)}
                      </Badge>
                    )}
                    {build.invoice_number && <Badge variant="secondary">Inv {build.invoice_number}</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Created {format(new Date(build.created_at), "dd MMM yyyy")}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        </>
        )}
      </div>

      {/* New build dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="w-full max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>New bike build</DialogTitle>
            <DialogDescription>
              {step === "details" ? "Step 1 of 2 — build details" : "Step 2 of 2 — pick parts from stock (optional)"}
            </DialogDescription>
          </DialogHeader>
          <div className={`min-w-0 space-y-4 ${step === "parts" ? "hidden" : ""}`}>

            {isStaff && (
              <div>
                <Label>Customer *</Label>
                <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.company_name || c.name || c.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Build name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Ribble winter build"
                />
              </div>
              <div>
                <Label>SKU</Label>
                <Input
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="Your product code"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Brand</Label>
                <Input value={form.bike_brand} onChange={(e) => setForm({ ...form, bike_brand: e.target.value })} />
              </div>
              <div>
                <Label>Model</Label>
                <Input value={form.bike_model} onChange={(e) => setForm({ ...form, bike_model: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Bike type</Label>
                <Select value={form.bike_type} onValueChange={(v) => setForm({ ...form, bike_type: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Road">Road</SelectItem>
                    <SelectItem value="Mountain">Mountain</SelectItem>
                    <SelectItem value="Hybrid">Hybrid</SelectItem>
                    <SelectItem value="Electric">Electric</SelectItem>
                    <SelectItem value="Gravel">Gravel</SelectItem>
                    <SelectItem value="BMX">BMX</SelectItem>
                    <SelectItem value="Folding">Folding</SelectItem>
                    <SelectItem value="Kids">Kids</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isStaff && (
                <div>
                  <Label>Labour charge (£)</Label>
                  <Input
                    type="number"
                    value={form.labour_cost}
                    onChange={(e) => setForm({ ...form, labour_cost: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              )}
            </div>
            <div>
              <Label>Spec notes</Label>
              <Textarea
                value={form.spec_notes}
                onChange={(e) => setForm({ ...form, spec_notes: e.target.value })}
                placeholder="Anything the mechanic needs to know"
              />
            </div>
          </div>

          {step === "parts" && (
            <div className="min-w-0 space-y-3">
              {stockLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary" />
                </div>
              ) : (
                <>
                  <StockPickerList
                    stock={availableStock}
                    selected={pickedParts}
                    onToggle={togglePart}
                    emptyLabel="No parts in stock for this customer yet."
                  />
                  <div className="text-sm text-muted-foreground">
                    {pickedParts.length} part{pickedParts.length === 1 ? "" : "s"} · £{pickedTotal.toFixed(2)} parts total
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter className="flex-wrap gap-2">
            {step === "details" ? (
              <>
                <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
                <Button variant="outline" onClick={handleCreate} disabled={submitting}>
                  {submitting ? "Creating…" : "Create without parts"}
                </Button>
                <Button onClick={goToParts} disabled={submitting}>Next: pick parts</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setStep("details")} disabled={submitting}>Back</Button>
                <Button onClick={handleCreate} disabled={submitting}>
                  {submitting ? "Creating…" : "Create build"}
                </Button>
              </>
            )}
          </DialogFooter>

        </DialogContent>
      </Dialog>

      <BuildDetailDialog
        build={selected}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onChanged={fetchData}
        isStaff={isStaff}
      />
    </Layout>
  );
};

export default BuildMyBikePage;
