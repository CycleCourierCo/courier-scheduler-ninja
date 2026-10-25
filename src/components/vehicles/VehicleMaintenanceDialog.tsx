import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, Plus, Settings2, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { formatServiceLabel } from "@/constants/vehicleMaintenance";
import {
  computeNextDue,
  currentOdometer,
  deleteLog,
  listVehicleTimeslipMiles,
  listOdometerReadings,
  addOdometerReading,
  deleteOdometerReading,
  type OdometerReadingRow,
  listIntervals,
  listLogs,
  type DueItem,
  type MaintenanceInterval,
  type MaintenanceLog,
} from "@/services/vehicleMaintenanceService";
import MaintenanceStatusBadge from "./MaintenanceStatusBadge";
import LogServiceDialog from "./LogServiceDialog";
import MaintenanceIntervalsDialog from "./MaintenanceIntervalsDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { effectiveOdometer } from "@/lib/odometer";

interface Props {
  vehicleId: string;
  vehicleReg: string;
  baselineMileage: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const VehicleMaintenanceDialog = ({ vehicleId, vehicleReg, baselineMileage, open, onOpenChange }: Props) => {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [intervals, setIntervals] = useState<MaintenanceInterval[]>([]);
  const [timeslipMiles, setTimeslipMiles] = useState(0);
  const [due, setDue] = useState<DueItem[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [intervalsOpen, setIntervalsOpen] = useState(false);

  const [readings, setReadings] = useState<OdometerReadingRow[]>([]);
  const [odoBase, setOdoBase] = useState(baselineMileage);
  const [readingDate, setReadingDate] = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" }));
  const [readingMiles, setReadingMiles] = useState("");
  const [readingNote, setReadingNote] = useState("");
  const [savingReading, setSavingReading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [l, iv, slips, rd] = await Promise.all([
        listLogs(vehicleId),
        listIntervals(vehicleId),
        listVehicleTimeslipMiles(vehicleId),
        listOdometerReadings(vehicleId),
      ]);
      const odo = effectiveOdometer(baselineMileage, slips, rd);
      setLogs(l);
      setIntervals(iv);
      setReadings(rd);
      setOdoBase(odo.base);
      setTimeslipMiles(odo.sinceMiles);
      setDue(computeNextDue(l, iv, { baselineMileage: odo.base, timeslipMileage: odo.sinceMiles }));
    } catch (e) {
      toast.error(`Couldn't load maintenance details — ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, vehicleId]);

  const currentMi = currentOdometer({ baselineMileage: odoBase, timeslipMileage: timeslipMiles });
  const lastReading = readings[0] ?? null;

  const saveReading = async () => {
    const miles = Number(readingMiles);
    if (!readingMiles || !Number.isFinite(miles) || miles < 0) return toast.error("Enter the mileage shown on the dashboard");
    setSavingReading(true);
    try {
      await addOdometerReading({ vehicle_id: vehicleId, reading_date: readingDate, odometer_mi: Math.round(miles), note: readingNote.trim() || null, exception_reason: readingNote.trim() || null });
      toast.success("Mileage saved");
      setReadingMiles(""); setReadingNote("");
      load();
    } catch (e) {
      toast.error(`Couldn't save mileage — ${(e as Error).message}`);
    } finally {
      setSavingReading(false);
    }
  };

  const removeReading = async (id: string) => {
    try { await deleteOdometerReading(id); load(); }
    catch (e) { toast.error(`Couldn't delete reading — ${(e as Error).message}`); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLog(id);
      toast.success("Service deleted");
      load();
    } catch (e) {
      toast.error(`Couldn't delete this service log — ${(e as Error).message}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Maintenance — {vehicleReg}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-sm">
            Current odometer:{" "}
            <span className="font-semibold">{currentMi.toLocaleString("en-GB")} mi</span>
            <span className="text-muted-foreground text-xs ml-2">
              {lastReading
                ? `(${lastReading.odometer_mi.toLocaleString("en-GB")} read on ${new Date(lastReading.reading_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} + ${timeslipMiles.toLocaleString("en-GB")} from timeslips since)`
                : `(${baselineMileage.toLocaleString("en-GB")} baseline + ${timeslipMiles.toLocaleString("en-GB")} from timeslips)`}
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setIntervalsOpen(true)}>
              <Settings2 className="h-4 w-4 mr-2" /> Intervals
            </Button>
            <Button size="sm" onClick={() => setLogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Log service
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground" /></div>
        ) : (
          <Tabs defaultValue="status" className="space-y-3">
            <TabsList>
              <TabsTrigger value="status">Status ({due.filter(d => d.status === "red" || d.status === "amber").length})</TabsTrigger>
              <TabsTrigger value="history">History ({logs.length})</TabsTrigger>
              <TabsTrigger value="mileage">Mileage ({readings.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="status">
              <Card className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead>
                      <TableHead>Last done</TableHead>
                      <TableHead>Next due</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {due.map((d) => (
                      <TableRow key={`${d.serviceType}-${d.position}-${d.customName}`}>
                        <TableCell className="font-medium text-sm">{d.label}</TableCell>
                        <TableCell className="text-xs">
                          {d.lastDate ? (
                            <>
                              {new Date(d.lastDate).toLocaleDateString("en-GB")}
                              {d.lastMiles != null && (
                                <div className="text-muted-foreground">@ {d.lastMiles.toLocaleString("en-GB")} mi</div>
                              )}
                            </>
                          ) : "Never"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {d.dueDate && <div>{new Date(d.dueDate).toLocaleDateString("en-GB")}</div>}
                          {d.dueMiles != null && <div className="text-muted-foreground">@ {d.dueMiles.toLocaleString("en-GB")} mi</div>}
                          {!d.dueDate && d.dueMiles == null && <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <MaintenanceStatusBadge item={d} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="history">
              <Card className="overflow-x-auto">
                {logs.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    No services logged yet.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead className="text-right">Mileage</TableHead>
                        <TableHead>Brand / Model</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {new Date(log.service_date).toLocaleDateString("en-GB")}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatServiceLabel(log.service_type, log.position, log.custom_name)}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {log.odometer_mi != null ? `${log.odometer_mi.toLocaleString("en-GB")} mi` : "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {[log.brand, log.model].filter(Boolean).join(" / ") || "—"}
                            {log.part_number && <div className="text-muted-foreground">{log.part_number}</div>}
                          </TableCell>
                          <TableCell className="text-xs">{log.vendor || "—"}</TableCell>
                          <TableCell className="text-right text-xs">
                            {log.cost != null ? `£${Number(log.cost).toFixed(2)}` : "—"}
                          </TableCell>
                          <TableCell className="text-xs max-w-xs truncate" title={log.notes ?? ""}>
                            {log.notes || "—"}
                          </TableCell>
                          <TableCell>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete this service log?</AlertDialogTitle>
                                  <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(log.id)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="mileage" className="space-y-3">
              <Card className="p-3 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Record the mileage on the dashboard. The newest reading replaces the tracked figure, and only timeslip miles after that date are added on top.
                </p>
                <div className="grid gap-2 sm:grid-cols-[150px_150px_1fr_auto] sm:items-end">
                  <div className="space-y-1">
                    <Label htmlFor="odo-date">Date</Label>
                    <Input id="odo-date" type="date" value={readingDate} onChange={(e) => setReadingDate(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="odo-miles">Mileage</Label>
                    <Input id="odo-miles" type="number" inputMode="numeric" min={0} value={readingMiles} onChange={(e) => setReadingMiles(e.target.value)} placeholder={String(currentMi)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="odo-note">Note (needed if lower than the last reading)</Label>
                    <Input id="odo-note" value={readingNote} onChange={(e) => setReadingNote(e.target.value)} placeholder="e.g. Monthly check" />
                  </div>
                  <Button onClick={saveReading} disabled={savingReading}>
                    {savingReading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save reading
                  </Button>
                </div>
              </Card>
              <Card className="p-0 overflow-x-auto">
                {readings.length === 0 ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">No manual readings yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead>Date</TableHead><TableHead>Mileage</TableHead><TableHead>Note</TableHead><TableHead /></TableRow>
                    </TableHeader>
                    <TableBody>
                      {readings.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>{new Date(r.reading_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</TableCell>
                          <TableCell className="font-medium">{r.odometer_mi.toLocaleString("en-GB")} mi</TableCell>
                          <TableCell className="text-muted-foreground">{r.note ?? "—"}</TableCell>
                          <TableCell className="text-right">
                            <Button size="icon" variant="ghost" onClick={() => removeReading(r.id)} aria-label="Delete reading">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        )}

        <LogServiceDialog
          vehicleId={vehicleId}
          vehicleReg={vehicleReg}
          currentMileage={currentMi}
          open={logOpen}
          onOpenChange={setLogOpen}
          onSaved={load}
        />
        <MaintenanceIntervalsDialog
          vehicleId={vehicleId}
          vehicleReg={vehicleReg}
          open={intervalsOpen}
          onOpenChange={setIntervalsOpen}
          onSaved={load}
        />
      </DialogContent>
    </Dialog>
  );
};

export default VehicleMaintenanceDialog;
