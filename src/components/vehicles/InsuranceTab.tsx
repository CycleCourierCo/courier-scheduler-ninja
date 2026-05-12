import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Loader2, Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deletePolicy, getUninsuredVehicles, listPolicies, type InsurancePolicy,
} from "@/services/insuranceService";
import type { Vehicle } from "@/services/vehicleService";
import PolicyDialog from "./PolicyDialog";
import InsuranceTimeline from "./InsuranceTimeline";

interface Props {
  vehicles: Vehicle[];
}

const todayStr = () => new Date().toISOString().slice(0, 10);
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);

export default function InsuranceTab({ vehicles }: Props) {
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editPolicy, setEditPolicy] = useState<InsurancePolicy | null>(null);
  const [defaultVehicleId, setDefaultVehicleId] = useState<string | null>(null);
  const [filterVehicle, setFilterVehicle] = useState<string>("all");
  const [windowStart, setWindowStart] = useState<Date>(() => addMonths(startOfMonth(new Date()), -1));
  const monthsCount = 12;

  const load = async () => {
    setLoading(true);
    try {
      setPolicies(await listPolicies());
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const uninsured = useMemo(() => getUninsuredVehicles(vehicles, policies), [vehicles, policies]);

  const sortedPolicies = useMemo(() => {
    const filtered = filterVehicle === "all"
      ? policies
      : policies.filter((p) => p.vehicle_id === filterVehicle);
    return [...filtered].sort((a, b) => b.end_date.localeCompare(a.end_date));
  }, [policies, filterVehicle]);

  const vehicleById = useMemo(() => {
    const m = new Map<string, Vehicle>();
    vehicles.forEach((v) => m.set(v.id, v));
    return m;
  }, [vehicles]);

  const openAdd = (vehicleId?: string) => {
    setEditPolicy(null);
    setDefaultVehicleId(vehicleId ?? null);
    setDialogOpen(true);
  };

  const openEdit = (p: InsurancePolicy) => {
    setEditPolicy(p);
    setDefaultVehicleId(null);
    setDialogOpen(true);
  };

  const handleDelete = async (p: InsurancePolicy) => {
    try {
      await deletePolicy(p.id);
      toast.success("Policy deleted");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const today = todayStr();
  const in30 = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  })();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Vehicle Insurance</h2>
        <Button onClick={() => openAdd()}>
          <Plus className="h-4 w-4 mr-2" /> Add policy
        </Button>
      </div>

      {/* Uninsured */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert className="h-5 w-5 text-destructive" />
          <h3 className="font-medium">Uninsured vehicles</h3>
          <Badge variant={uninsured.length ? "destructive" : "secondary"}>{uninsured.length}</Badge>
        </div>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : uninsured.length === 0 ? (
          <div className="text-sm text-muted-foreground">All active vehicles are currently insured.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {uninsured.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-2 border rounded-md px-3 py-2">
                <div className="text-sm">
                  <div className="font-mono font-semibold">{v.registration}</div>
                  <div className="text-xs text-muted-foreground">{v.make ?? "—"}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => openAdd(v.id)}>Add policy</Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Timeline */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-medium">Coverage timeline</h3>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setWindowStart((d) => addMonths(d, -3))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setWindowStart(addMonths(startOfMonth(new Date()), -1))}>
              Today
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setWindowStart((d) => addMonths(d, 3))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <InsuranceTimeline
          vehicles={vehicles}
          policies={policies}
          monthsCount={monthsCount}
          startMonth={windowStart}
          onPolicyClick={openEdit}
        />
      </Card>

      {/* Policies table */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-medium">Policies</h3>
          <Select value={filterVehicle} onValueChange={setFilterVehicle}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All vehicles</SelectItem>
              {vehicles.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.registration}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle</TableHead>
                <TableHead>Insurer</TableHead>
                <TableHead>Policy #</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Premium</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPolicies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                    No policies yet
                  </TableCell>
                </TableRow>
              ) : (
                sortedPolicies.map((p) => {
                  const v = vehicleById.get(p.vehicle_id);
                  const expired = p.end_date < today;
                  const expiringSoon = !expired && p.end_date <= in30;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono">{v?.registration ?? "—"}</TableCell>
                      <TableCell>{p.insurer}</TableCell>
                      <TableCell className="text-sm">{p.policy_number ?? "—"}</TableCell>
                      <TableCell className="text-sm">{p.start_date}</TableCell>
                      <TableCell className="text-sm">
                        <span className={
                          expired ? "text-destructive font-medium"
                          : expiringSoon ? "text-amber-600 dark:text-amber-400 font-medium"
                          : ""
                        }>{p.end_date}</span>
                      </TableCell>
                      <TableCell className="text-sm">{p.premium != null ? `£${Number(p.premium).toFixed(2)}` : "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete policy?</AlertDialogTitle>
                                <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(p)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <PolicyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        vehicles={vehicles}
        policy={editPolicy}
        defaultVehicleId={defaultVehicleId}
        onSaved={load}
      />
    </div>
  );
}
