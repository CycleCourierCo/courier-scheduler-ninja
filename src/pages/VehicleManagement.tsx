import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Check, Loader2, Pencil, RefreshCw, Trash2, Truck } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import AddVehicleDialog from "@/components/vehicles/AddVehicleDialog";
import EditVehicleDialog from "@/components/vehicles/EditVehicleDialog";
import VehicleStatusBadge from "@/components/vehicles/VehicleStatusBadge";
import InsuranceTab from "@/components/vehicles/InsuranceTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  deleteVehicle,
  listVehicles,
  lookupVehicleFromDVLA,
  updateVehicle,
  VEHICLE_STATUS_OPTIONS,
  type Vehicle,
  type VehicleStatus,
} from "@/services/vehicleService";

const isExpired = (date: string | null) => !!date && new Date(date) < new Date();
const isSoon = (date: string | null) => {
  if (!date) return false;
  const d = new Date(date).getTime();
  const now = Date.now();
  return d >= now && d - now <= 30 * 24 * 60 * 60 * 1000;
};

const ExpiryCell = ({ status, date }: { status: string | null; date: string | null }) => {
  const cls = isExpired(date)
    ? "text-destructive font-medium"
    : isSoon(date)
    ? "text-amber-600 dark:text-amber-400 font-medium"
    : "text-foreground";
  return (
    <div className="text-sm">
      <div>{status ?? "—"}</div>
      {date && <div className={cls}>{date}</div>}
    </div>
  );
};

const VehicleManagement = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | "all">("all");
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [soldTarget, setSoldTarget] = useState<Vehicle | null>(null);
  const [soldDate, setSoldDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [soldMileage, setSoldMileage] = useState<string>("");
  const [savingSold, setSavingSold] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setVehicles(await listVehicles());
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    return vehicles.filter((v) => {
      if (statusFilter !== "all" && v.status !== statusFilter) return false;
      if (q && !v.registration.includes(q) && !(v.make ?? "").toUpperCase().includes(q)) return false;
      return true;
    });
  }, [vehicles, search, statusFilter]);

  const handleRowRefresh = async (v: Vehicle) => {
    setRefreshingId(v.id);
    try {
      const res = await lookupVehicleFromDVLA(v.registration);
      await updateVehicle(v.id, {
        make: res.make,
        colour: res.colour,
        fuel_type: res.fuel_type,
        year_of_manufacture: res.year_of_manufacture,
        engine_capacity: res.engine_capacity,
        co2_emissions: res.co2_emissions,
        tax_status: res.tax_status,
        tax_due_date: res.tax_due_date,
        mot_status: res.mot_status,
        mot_expiry_date: res.mot_expiry_date,
        date_of_last_v5c_issued: res.date_of_last_v5c_issued,
        marked_for_export: res.marked_for_export,
        type_approval: res.type_approval,
        wheelplan: res.wheelplan,
        revenue_weight: res.revenue_weight,
        euro_status: res.euro_status,
        real_driving_emissions: res.real_driving_emissions,
        ves_raw: res.ves_raw as never,
        last_refreshed_at: new Date().toISOString(),
      });
      toast.success(`${v.registration} refreshed`);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRefreshingId(null);
    }
  };

  const handleStatusChange = async (v: Vehicle, status: VehicleStatus) => {
    if (v.status === status) return;
    if (status === "sold") {
      setSoldTarget(v);
      setSoldDate(new Date().toISOString().slice(0, 10));
      setSoldMileage("");
      return;
    }
    const prev = vehicles;
    setVehicles((vs) => vs.map((x) => (x.id === v.id ? { ...x, status } : x)));
    try {
      await updateVehicle(v.id, { status });
      const label = VEHICLE_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
      toast.success(`${v.registration} → ${label}`);
    } catch (e) {
      setVehicles(prev);
      toast.error((e as Error).message);
    }
  };

  const handleConfirmSold = async () => {
    if (!soldTarget) return;
    if (!soldDate || !soldMileage) {
      toast.error("Sold date and mileage are required");
      return;
    }
    setSavingSold(true);
    try {
      await updateVehicle(soldTarget.id, {
        status: "sold",
        sold_date: soldDate,
        sold_mileage: Number(soldMileage),
      } as never);
      toast.success(`${soldTarget.registration} marked as sold`);
      setSoldTarget(null);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingSold(false);
    }
  };

  const StatusDropdown = ({ v }: { v: Vehicle }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring rounded-full">
          <VehicleStatusBadge status={v.status} className="hover:opacity-80 transition-opacity" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {VEHICLE_STATUS_OPTIONS.map((o) => (
          <DropdownMenuItem
            key={o.value}
            onClick={() => handleStatusChange(v, o.value)}
            className="flex items-center justify-between"
          >
            <span>{o.label}</span>
            {v.status === o.value && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const handleDelete = async (v: Vehicle) => {
    try {
      await deleteVehicle(v.id);
      toast.success("Vehicle removed");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Truck className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Vehicle Management</h1>
          </div>
          <AddVehicleDialog onCreated={load} />
        </div>

        <Tabs defaultValue="vehicles" className="space-y-4">
          <TabsList>
            <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
            <TabsTrigger value="insurance">Insurance</TabsTrigger>
          </TabsList>

          <TabsContent value="vehicles" className="space-y-4">
            <Card className="p-3 flex flex-wrap gap-2 items-center">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by registration or make"
                className="max-w-xs uppercase"
              />
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as VehicleStatus | "all")}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {VEHICLE_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-sm text-muted-foreground ml-auto">
                {filtered.length} of {vehicles.length} vehicles
              </div>
            </Card>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                No vehicles yet. Click "Add Vehicle" to get started.
              </Card>
            ) : (
              <>
                {/* Desktop */}
                <Card className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Registration</TableHead>
                        <TableHead>Vehicle</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Purchased</TableHead>
                        <TableHead>Tax</TableHead>
                        <TableHead>MOT</TableHead>
                        <TableHead>Auto Pay</TableHead>
                        <TableHead>Last refreshed</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((v) => (
                        <TableRow key={v.id}>
                          <TableCell className="font-mono font-semibold">{v.registration}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{v.make ?? "—"} {v.colour ? `· ${v.colour}` : ""}</div>
                              <div className="text-muted-foreground text-xs">
                                {v.fuel_type ?? ""} {v.year_of_manufacture ?? ""}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell><StatusDropdown v={v} /></TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {v.purchase_date
                              ? new Date(v.purchase_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                              : "—"}
                          </TableCell>
                          <TableCell><ExpiryCell status={v.tax_status} date={v.tax_due_date} /></TableCell>
                          <TableCell><ExpiryCell status={v.mot_status} date={v.mot_expiry_date} /></TableCell>
                          <TableCell>
                            <div className="text-xs space-y-0.5">
                              <div>London: {v.london_auto_pay ? "✓" : "—"}</div>
                              <div>Dartford: {v.dartford_crossing ? "✓" : "—"}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {v.last_refreshed_at ? new Date(v.last_refreshed_at).toLocaleDateString() : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleRowRefresh(v)}
                                disabled={refreshingId === v.id}
                                title="Refresh from DVLA"
                              >
                                {refreshingId === v.id
                                  ? <Loader2 className="h-4 w-4 animate-spin" />
                                  : <RefreshCw className="h-4 w-4" />}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => { setEditing(v); setEditOpen(true); }}
                                title="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="icon" variant="ghost" title="Delete">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete {v.registration}?</AlertDialogTitle>
                                    <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(v)}>Delete</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>

                {/* Mobile */}
                <div className="md:hidden space-y-3">
                  {filtered.map((v) => (
                    <Card key={v.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="font-mono font-semibold">{v.registration}</div>
                        <StatusDropdown v={v} />
                      </div>
                      <div className="text-sm">{v.make ?? "—"} {v.colour ? `· ${v.colour}` : ""}</div>
                      <div className="text-xs text-muted-foreground">
                        Purchased: {v.purchase_date
                          ? new Date(v.purchase_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                          : "—"}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <div className="text-muted-foreground">Tax</div>
                          <ExpiryCell status={v.tax_status} date={v.tax_due_date} />
                        </div>
                        <div>
                          <div className="text-muted-foreground">MOT</div>
                          <ExpiryCell status={v.mot_status} date={v.mot_expiry_date} />
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        London Auto Pay: {v.london_auto_pay ? "✓" : "—"} · Dartford: {v.dartford_crossing ? "✓" : "—"}
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => handleRowRefresh(v)} disabled={refreshingId === v.id}>
                          {refreshingId === v.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => { setEditing(v); setEditOpen(true); }}>
                          <Pencil className="h-3 w-3 mr-1" /> Edit
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline">
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {v.registration}?</AlertDialogTitle>
                              <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(v)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="insurance">
            <InsuranceTab vehicles={vehicles} />
          </TabsContent>
        </Tabs>

        <EditVehicleDialog
          vehicle={editing}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSaved={load}
        />

        <Dialog open={!!soldTarget} onOpenChange={(o) => { if (!o) setSoldTarget(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Mark {soldTarget?.registration} as sold</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="quick-sold-date">Sold date</Label>
                <Input
                  id="quick-sold-date"
                  type="date"
                  value={soldDate}
                  onChange={(e) => setSoldDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quick-sold-mileage">Mileage at sale</Label>
                <Input
                  id="quick-sold-mileage"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={soldMileage}
                  onChange={(e) => setSoldMileage(e.target.value)}
                  placeholder="e.g. 89400"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setSoldTarget(null)}>Cancel</Button>
              <Button onClick={handleConfirmSold} disabled={savingSold || !soldDate || !soldMileage}>
                {savingSold && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Mark as sold
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default VehicleManagement;
