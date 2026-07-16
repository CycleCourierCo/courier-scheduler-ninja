import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MoreHorizontal, Plus, Settings2, Loader2 } from "lucide-react";
import {
  LabourTimeRow,
  MultiplierRow,
  deleteLabourTime,
  deleteMultiplier,
  listFilterOptions,
  listLabourTimes,
  listMultipliers,
} from "@/services/labourTimesService";
import LabourTimeDialog from "@/components/labour-times/LabourTimeDialog";
import MultiplierDialog from "@/components/labour-times/MultiplierDialog";
import {
  calculateLabourPrice,
  formatGBP,
  useUpdateWorkshopSettings,
  useWorkshopSettings,
} from "@/lib/labourPricing";
import { useAuth } from "@/contexts/AuthContext";
import { hasRole } from "@/lib/roles";

const PAGE_SIZE = 50;

const ALL_COLUMNS = [
  { key: "repair_id", label: "Repair ID", default: true },
  { key: "bike_type", label: "Bike type", default: true },
  { key: "category", label: "Category", default: true },
  { key: "subcategory", label: "Subcategory", default: false },
  { key: "repair_name", label: "Repair name", default: true },
  { key: "labour_minutes", label: "Minutes", default: true },
  { key: "price", label: "Price", default: true },
  { key: "min_charge_gbp", label: "Min charge (£)", default: false },
  { key: "difficulty_1_5", label: "Difficulty", default: true },
  { key: "skill_level", label: "Skill", default: true },
  { key: "safety_critical", label: "Safety", default: true },
  { key: "warranty_eligible", label: "Warranty", default: false },
  { key: "test_ride_required", label: "Test ride", default: false },
  { key: "torque_check_required", label: "Torque", default: false },
  { key: "software_calibration_required", label: "Calibration", default: false },
  { key: "suspension_setup_required", label: "Suspension", default: false },
  { key: "brake_bed_in_required", label: "Brake bed-in", default: false },
  { key: "combinable", label: "Combinable", default: false },
  { key: "combined_saving_minutes", label: "Combined save", default: false },
  { key: "specialist_tools", label: "Tools", default: false },
  { key: "common_parts", label: "Parts", default: false },
  { key: "notes", label: "Notes", default: false },
] as const;

type ColKey = typeof ALL_COLUMNS[number]["key"];

function useDebouncedValue<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export default function LabourTimesAdmin() {
  const qc = useQueryClient();
  const { userProfile } = useAuth();
  const isAdmin = hasRole(userProfile, 'admin');
  const { data: settings } = useWorkshopSettings();
  const hourlyRate = settings?.hourly_rate_gbp ?? 75;
  const minCharge = settings?.min_charge_gbp ?? 15;

  // Settings card local state
  const [rateInput, setRateInput] = useState<string>(String(hourlyRate));
  const [minInput, setMinInput] = useState<string>(String(minCharge));
  useEffect(() => { setRateInput(String(hourlyRate)); setMinInput(String(minCharge)); }, [hourlyRate, minCharge]);
  const updateSettings = useUpdateWorkshopSettings();

  // Filters
  const [bikeType, setBikeType] = useState("__all__");
  const [category, setCategory] = useState("__all__");
  const [skillLevel, setSkillLevel] = useState("__all__");
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 300);
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [bikeType, category, skillLevel, search]);

  const filtersQuery = useQuery({
    queryKey: ["labour_times_filters"],
    queryFn: listFilterOptions,
    staleTime: 10 * 60 * 1000,
  });

  const listQuery = useQuery({
    queryKey: ["labour_times", { page, bikeType, category, skillLevel, search }],
    queryFn: () => listLabourTimes({ page, pageSize: PAGE_SIZE, bikeType, category, skillLevel, search }),
  });

  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Column visibility — non-admins never see price/min_charge columns
  const availableColumns = useMemo(
    () => ALL_COLUMNS.filter((c) => isAdmin || (c.key !== "price" && c.key !== "min_charge_gbp")),
    [isAdmin]
  );
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(
    () => new Set(ALL_COLUMNS.filter((c) => c.default).map((c) => c.key))
  );
  useEffect(() => {
    if (!isAdmin) {
      setVisibleCols((prev) => {
        const n = new Set(prev);
        n.delete("price");
        n.delete("min_charge_gbp");
        return n;
      });
    }
  }, [isAdmin]);
  const toggleCol = (k: ColKey) => {
    setVisibleCols((prev) => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  };

  // Dialogs
  const [editRow, setEditRow] = useState<LabourTimeRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<LabourTimeRow | null>(null);

  const openAdd = () => { setEditRow(null); setDialogOpen(true); };
  const openEdit = (row: LabourTimeRow) => { setEditRow(row); setDialogOpen(true); };

  async function handleDelete() {
    if (!pendingDelete) return;
    try {
      await deleteLabourTime(pendingDelete.repair_id);
      toast.success("Deleted");
      setPendingDelete(null);
      qc.invalidateQueries({ queryKey: ["labour_times"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete");
    }
  }

  // Multipliers
  const multipliersQuery = useQuery({
    queryKey: ["labour_time_multipliers"],
    queryFn: listMultipliers,
    staleTime: 60 * 1000,
  });
  const [multiplierRow, setMultiplierRow] = useState<MultiplierRow | null>(null);
  const [multiplierOpen, setMultiplierOpen] = useState(false);
  const [pendingMultiplierDelete, setPendingMultiplierDelete] = useState<MultiplierRow | null>(null);

  async function handleDeleteMultiplier() {
    if (!pendingMultiplierDelete) return;
    try {
      await deleteMultiplier(pendingMultiplierDelete.modifier);
      toast.success("Deleted");
      setPendingMultiplierDelete(null);
      qc.invalidateQueries({ queryKey: ["labour_time_multipliers"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete");
    }
  }

  const previewPrice = useMemo(
    () => calculateLabourPrice(30, Number(rateInput) || 0, Number(minInput) || 0),
    [rateInput, minInput]
  );

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Labour Times</h1>
          <p className="text-muted-foreground">Manage workshop repair book times, multipliers, and pricing.</p>
        </div>

        {/* Settings card — admin only */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5" /> Workshop settings</CardTitle>
              <CardDescription>
                Prices shown across the app are computed live from labour minutes at this rate — data isn't rewritten.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-[1fr_1fr_auto_1fr] items-end">
              <div className="space-y-2">
                <Label>Hourly rate (£)</Label>
                <Input type="number" min={0} step="0.01" value={rateInput} onChange={(e) => setRateInput(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Minimum charge (£)</Label>
                <Input type="number" min={0} step="0.01" value={minInput} onChange={(e) => setMinInput(e.target.value)} />
              </div>
              <Button
                onClick={() =>
                  updateSettings.mutate(
                    { hourly_rate_gbp: Number(rateInput) || 0, min_charge_gbp: Number(minInput) || 0 },
                    {
                      onSuccess: () => toast.success("Workshop settings updated"),
                      onError: (e: any) => toast.error(e?.message ?? "Failed to save"),
                    }
                  )
                }
                disabled={updateSettings.isPending}
              >
                {updateSettings.isPending ? "Saving…" : "Save"}
              </Button>
              <div className="text-sm text-muted-foreground">
                Example: 30 min job → <span className="font-semibold text-foreground">{formatGBP(previewPrice)}</span>
                <div className="text-xs">Formula: max(min, ceil(minutes × rate / 60 / 5) × 5)</div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="times" className="space-y-4">
          <TabsList>
            <TabsTrigger value="times">Labour times</TabsTrigger>
            <TabsTrigger value="multipliers">Multipliers</TabsTrigger>
          </TabsList>

          {/* Labour times tab */}
          <TabsContent value="times" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
                  <div className="space-y-1">
                    <Label className="text-xs">Bike type</Label>
                    <Select value={bikeType} onValueChange={setBikeType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All</SelectItem>
                        {filtersQuery.data?.bikeTypes.map((v) => (
                          <SelectItem key={v} value={v}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All</SelectItem>
                        {filtersQuery.data?.categories.map((v) => (
                          <SelectItem key={v} value={v}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Skill</Label>
                    <Select value={skillLevel} onValueChange={setSkillLevel}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All</SelectItem>
                        {filtersQuery.data?.skillLevels.map((v) => (
                          <SelectItem key={v} value={v}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Search</Label>
                    <Input
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Repair name / subcategory…"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline">Columns</Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 max-h-80 overflow-y-auto">
                      <div className="space-y-2">
                        {availableColumns.map((c) => (
                          <label key={c.key} className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                              checked={visibleCols.has(c.key)}
                              onCheckedChange={() => toggleCol(c.key)}
                            />
                            {c.label}
                          </label>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  {isAdmin && <Button onClick={openAdd}><Plus className="mr-1 h-4 w-4" /> Add repair</Button>}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {availableColumns.filter((c) => visibleCols.has(c.key)).map((c) => (
                          <TableHead key={c.key}>{c.label}</TableHead>
                        ))}
                        {isAdmin && <TableHead className="w-10" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {listQuery.isLoading ? (
                        <TableRow>
                          <TableCell colSpan={visibleCols.size + (isAdmin ? 1 : 0)} className="py-10 text-center text-muted-foreground">
                            <Loader2 className="inline h-4 w-4 animate-spin mr-2" /> Loading…
                          </TableCell>
                        </TableRow>
                      ) : listQuery.data?.rows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={visibleCols.size + (isAdmin ? 1 : 0)} className="py-10 text-center text-muted-foreground">
                            No results
                          </TableCell>
                        </TableRow>
                      ) : (
                        listQuery.data?.rows.map((row) => (
                          <TableRow
                            key={row.repair_id}
                            className={isAdmin ? "cursor-pointer" : ""}
                            onClick={isAdmin ? () => openEdit(row) : undefined}
                          >
                            {availableColumns.filter((c) => visibleCols.has(c.key)).map((c) => (
                              <TableCell key={c.key} className="whitespace-nowrap">
                                {renderCell(row, c.key, hourlyRate, minCharge)}
                              </TableCell>
                            ))}
                            {isAdmin && (
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => openEdit(row)}>Edit</DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => setPendingDelete(row)}
                                    >Delete</DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            )}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-between p-3 border-t">
                  <div className="text-sm text-muted-foreground">
                    Page {page} of {totalPages} · {total.toLocaleString()} rows
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Multipliers tab */}
          <TabsContent value="multipliers">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Multipliers</CardTitle>
                  <CardDescription>Modifiers applied on top of standard times.</CardDescription>
                </div>
                {isAdmin && (
                  <Button onClick={() => { setMultiplierRow(null); setMultiplierOpen(true); }}>
                    <Plus className="mr-1 h-4 w-4" /> Add multiplier
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Modifier</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Applies to</TableHead>
                      <TableHead>Notes</TableHead>
                      {isAdmin && <TableHead className="w-10" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {multipliersQuery.isLoading ? (
                      <TableRow>
                        <TableCell colSpan={isAdmin ? 6 : 5} className="text-center py-6 text-muted-foreground">
                          <Loader2 className="inline h-4 w-4 animate-spin mr-2" /> Loading…
                        </TableCell>
                      </TableRow>
                    ) : (multipliersQuery.data ?? []).map((row) => (
                      <TableRow
                        key={row.modifier}
                        className={isAdmin ? "cursor-pointer" : ""}
                        onClick={isAdmin ? () => { setMultiplierRow(row); setMultiplierOpen(true); } : undefined}
                      >
                        <TableCell className="font-medium">{row.modifier}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{row.adjustment_type}</Badge>
                        </TableCell>
                        <TableCell>
                          {row.adjustment_type === "percent" ? `${row.value}%` : `${row.value} min`}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{row.applies_to ?? ""}</TableCell>
                        <TableCell className="max-w-md truncate">{row.notes ?? ""}</TableCell>
                        {isAdmin && (
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { setMultiplierRow(row); setMultiplierOpen(true); }}>Edit</DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => setPendingMultiplierDelete(row)}
                                >Delete</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <LabourTimeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        row={editRow}
        hourlyRate={hourlyRate}
        minCharge={minCharge}
        onSaved={() => qc.invalidateQueries({ queryKey: ["labour_times"] })}
      />

      <MultiplierDialog
        open={multiplierOpen}
        onOpenChange={setMultiplierOpen}
        row={multiplierRow}
        onSaved={() => qc.invalidateQueries({ queryKey: ["labour_time_multipliers"] })}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete labour time?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.repair_id} — {pendingDelete?.repair_name}. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingMultiplierDelete} onOpenChange={(o) => !o && setPendingMultiplierDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete multiplier?</AlertDialogTitle>
            <AlertDialogDescription>{pendingMultiplierDelete?.modifier}. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMultiplier} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}

function renderCell(row: LabourTimeRow, key: ColKey, rate: number, minCharge: number) {
  if (key === "price") {
    return <span className="font-semibold">{formatGBP(calculateLabourPrice(row.labour_minutes, rate, minCharge))}</span>;
  }
  if (key === "repair_id") {
    const isCustom = row.repair_id.startsWith("CUS-");
    return (
      <span className="flex items-center gap-1 font-mono text-xs">
        {row.repair_id}
        {isCustom && <Badge variant="outline" className="text-[10px]">custom</Badge>}
      </span>
    );
  }
  if (key === "safety_critical") {
    return row.safety_critical === "Yes"
      ? <Badge variant="destructive">Yes</Badge>
      : <span className="text-muted-foreground">No</span>;
  }
  const value = (row as any)[key];
  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">—</span>;
  if (typeof value === "string" && value.length > 60) {
    return <span title={value}>{value.slice(0, 60)}…</span>;
  }
  return String(value);
}
