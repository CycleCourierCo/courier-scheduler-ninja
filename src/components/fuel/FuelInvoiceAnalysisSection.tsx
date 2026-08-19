import React, { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, subDays } from "date-fns";
import { toast } from "sonner";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  FileText,
  Gauge,
  Link2,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { extractPdfText } from "@/lib/pdfText";
import { parseWexInvoiceText } from "@/lib/wexInvoiceParser";
import FixFlagDialog from "@/components/fuel/FixFlagDialog";
import {
  analyseFuel,
  deleteFuelInvoice,
  dismissAnomaly,
  fetchDismissedAnomalies,
  fetchFleetVehicles,
  fetchFuelAnalysisSettings,
  fetchFuelInvoices,
  fetchFuelTransactions,
  fetchMileage,
  fetchRegAliases,
  getInvoiceDownloadUrl,
  restoreAnomaly,
  saveFuelAnalysisSettings,
  saveRegAlias,
  uploadFuelInvoice,
  type FuelAnomaly,
  type FuelInvoiceRecord,
} from "@/services/fuelInvoiceService";

const money = (value: number | null | undefined, dp = 2) =>
  value == null ? "—" : `£${Number(value).toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;

const numberFmt = (value: number | null | undefined, dp = 0) =>
  value == null ? "—" : Number(value).toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });

const RANGE_OPTIONS = [
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 12 months" },
  { value: "all", label: "All time" },
];

const severityVariant = (severity: "high" | "medium" | "low") =>
  severity === "high" ? "destructive" : severity === "medium" ? "default" : "secondary";

const FuelInvoiceAnalysisSection: React.FC = () => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rangeDays, setRangeDays] = useState<string>("90");
  const [uploading, setUploading] = useState(false);
  const [uploadLog, setUploadLog] = useState<string[]>([]);
  const [fixAnomaly, setFixAnomaly] = useState<FuelAnomaly | null>(null);

  const range = useMemo(() => {
    if (rangeDays === "all") return {};
    return { from: format(subDays(new Date(), Number(rangeDays)), "yyyy-MM-dd") };
  }, [rangeDays]);

  const invoicesQuery = useQuery({ queryKey: ["fuel-invoices"], queryFn: fetchFuelInvoices });
  const transactionsQuery = useQuery({
    queryKey: ["fuel-transactions", range],
    queryFn: () => fetchFuelTransactions(range),
  });
  const mileageQuery = useQuery({
    queryKey: ["fuel-mileage", range],
    queryFn: () => fetchMileage(range),
  });
  const vehiclesQuery = useQuery({ queryKey: ["fuel-fleet-vehicles"], queryFn: fetchFleetVehicles });
  const aliasesQuery = useQuery({ queryKey: ["fuel-reg-aliases"], queryFn: fetchRegAliases });
  const settingsQuery = useQuery({
    queryKey: ["fuel-analysis-settings"],
    queryFn: fetchFuelAnalysisSettings,
  });
  const dismissedQuery = useQuery({
    queryKey: ["fuel-anomaly-dismissals"],
    queryFn: fetchDismissedAnomalies,
  });

  const analysis = useMemo(() => {
    if (!settingsQuery.data) return null;
    return analyseFuel(
      transactionsQuery.data ?? [],
      mileageQuery.data ?? [],
      vehiclesQuery.data ?? [],
      aliasesQuery.data ?? [],
      settingsQuery.data,
      dismissedQuery.data ?? new Set()
    );
  }, [
    transactionsQuery.data,
    mileageQuery.data,
    vehiclesQuery.data,
    aliasesQuery.data,
    settingsQuery.data,
    dismissedQuery.data,
  ]);

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["fuel-invoices"] });
    queryClient.invalidateQueries({ queryKey: ["fuel-transactions"] });
    queryClient.invalidateQueries({ queryKey: ["fuel-reg-aliases"] });
    queryClient.invalidateQueries({ queryKey: ["fuel-anomaly-dismissals"] });
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    const log: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const text = await extractPdfText(file);
        const parsed = parseWexInvoiceText(text);
        if (parsed.warnings.length) {
          parsed.warnings.forEach((warning) => log.push(`${file.name}: ${warning}`));
        }
        const result = await uploadFuelInvoice(file, parsed);
        log.push(
          result.duplicate
            ? `${file.name}: already uploaded (invoice ${parsed.invoiceNumber}) — skipped.`
            : `${file.name}: imported invoice ${parsed.invoiceNumber} with ${result.rowCount} transactions.`
        );
      } catch (error) {
        log.push(`${file.name}: ${(error as Error).message}`);
      }
    }
    setUploadLog(log);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    refreshAll();
    toast.success("Finished processing fuel invoices");
  };

  const aliasMutation = useMutation({
    mutationFn: ({ reg, vehicleId, ignored }: { reg: string; vehicleId: string | null; ignored?: boolean }) =>
      saveRegAlias(reg, vehicleId, ignored ?? false),
    onSuccess: () => {
      toast.success("Registration mapping saved");
      refreshAll();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const dismissMutation = useMutation({
    mutationFn: (key: string) => dismissAnomaly(key),
    onSuccess: () => {
      toast.success("Flag dismissed");
      queryClient.invalidateQueries({ queryKey: ["fuel-anomaly-dismissals"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const clearDismissalsMutation = useMutation({
    mutationFn: async () => {
      const keys = [...(dismissedQuery.data ?? new Set<string>())];
      await Promise.all(keys.map((key) => restoreAnomaly(key)));
    },
    onSuccess: () => {
      toast.success("Dismissed flags restored");
      queryClient.invalidateQueries({ queryKey: ["fuel-anomaly-dismissals"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (invoice: FuelInvoiceRecord) => deleteFuelInvoice(invoice),
    onSuccess: () => {
      toast.success("Invoice removed");
      refreshAll();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const settingsMutation = useMutation({
    mutationFn: (updates: Record<string, number>) =>
      saveFuelAnalysisSettings(settingsQuery.data!.id, updates),
    onSuccess: () => {
      toast.success("Thresholds updated");
      queryClient.invalidateQueries({ queryKey: ["fuel-analysis-settings"] });
    },
  });

  const openInvoice = async (invoice: FuelInvoiceRecord) => {
    if (!invoice.file_path) return;
    const url = await getInvoiceDownloadUrl(invoice.file_path);
    if (url) window.open(url, "_blank", "noopener");
    else toast.error("Could not open that PDF");
  };

  const loading =
    transactionsQuery.isLoading || mileageQuery.isLoading || settingsQuery.isLoading;

  return (
    <Card className="mb-6 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Fuel invoices &amp; fraud checks
            </CardTitle>
            <CardDescription>
              Upload weekly fuel invoices to check MPG, cost per mile and spot suspicious fills
            </CardDescription>
          </div>
          <Select value={rangeDays} onValueChange={setRangeDays}>
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            multiple
            className="hidden"
            onChange={(event) => handleFiles(event.target.files)}
          />
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Upload fuel invoice PDFs
          </Button>
          <span className="text-xs text-muted-foreground">
            WEX / Esso invoices are read automatically — you can select several at once
          </span>
        </div>

        {uploadLog.length > 0 && (
          <div className="rounded-md border bg-muted/40 p-3 space-y-1">
            {uploadLog.map((line, index) => (
              <p key={index} className="text-xs text-muted-foreground break-words">
                {line}
              </p>
            ))}
          </div>
        )}

        {loading ? (
          <div className="py-8 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Crunching fuel data…
          </div>
        ) : (
          <Tabs defaultValue="overview">
            <TabsList className="flex w-full flex-wrap h-auto">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="vehicles">Per vehicle</TabsTrigger>
              <TabsTrigger value="flags" className="gap-1">
                Flags
                {analysis?.anomalies.length ? (
                  <Badge variant="destructive" className="ml-1">
                    {analysis.anomalies.length}
                  </Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="invoices">Invoices</TabsTrigger>
              <TabsTrigger value="settings">Thresholds</TabsTrigger>
            </TabsList>

            {/* Overview -------------------------------------------------- */}
            <TabsContent value="overview" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatTile label="Fuel spend (net)" value={money(analysis?.totals.netSpend)} />
                <StatTile label="Litres" value={numberFmt(analysis?.totals.litres, 1)} />
                <StatTile
                  label="Fleet MPG"
                  value={analysis?.totals.mpg == null ? "—" : `${analysis.totals.mpg} mpg`}
                  icon={<Gauge className="h-4 w-4" />}
                />
                <StatTile
                  label="Cost per mile"
                  value={analysis?.totals.costPerMile == null ? "—" : money(analysis.totals.costPerMile, 3)}
                />
                <StatTile label="Miles (timeslips)" value={numberFmt(analysis?.totals.miles)} />
                <StatTile
                  label="Avg price per litre"
                  value={
                    analysis?.totals.avgPencePerLitre == null
                      ? "—"
                      : `${analysis.totals.avgPencePerLitre}p`
                  }
                />
                <StatTile label="Fills" value={numberFmt(analysis?.totals.fills)} />
                <StatTile
                  label="Unmatched spend"
                  value={money(analysis?.totals.unmatchedSpend)}
                  tone={analysis?.totals.unmatchedSpend ? "warning" : "default"}
                />
              </div>

              {analysis?.unmatchedRegs.length ? (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Link2 className="h-4 w-4" /> Registrations that need matching
                  </h4>
                  <div className="space-y-2">
                    {analysis.unmatchedRegs.map((item) => (
                      <div
                        key={item.reg}
                        className="rounded-md border p-3 flex flex-wrap items-center gap-2 justify-between"
                      >
                        <div className="min-w-0">
                          <p className="font-mono text-sm font-semibold">{item.reg}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.fills} fill(s) · {numberFmt(item.litres, 1)} L ·{" "}
                            {money(item.netSpend)}
                            {item.suggestion ? ` · looks like ${item.suggestion.reg}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select
                            onValueChange={(vehicleId) =>
                              aliasMutation.mutate({ reg: item.reg, vehicleId })
                            }
                          >
                            <SelectTrigger className="w-[190px]">
                              <SelectValue
                                placeholder={
                                  item.suggestion ? `Match to ${item.suggestion.reg}` : "Match to vehicle"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {(vehiclesQuery.data ?? []).map((vehicle) => (
                                <SelectItem key={vehicle.id} value={vehicle.id}>
                                  {vehicle.registration}
                                  {vehicle.make ? ` — ${vehicle.make}` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              aliasMutation.mutate({ reg: item.reg, vehicleId: null, ignored: true })
                            }
                          >
                            Ignore
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" /> Every registration on these
                  invoices matches a fleet vehicle.
                </p>
              )}

              {analysis?.weekly.length ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Week commencing</TableHead>
                        <TableHead className="text-right">Litres</TableHead>
                        <TableHead className="text-right">Spend (net)</TableHead>
                        <TableHead className="text-right">Miles</TableHead>
                        <TableHead className="text-right">MPG</TableHead>
                        <TableHead className="text-right">Cost / mile</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...analysis.weekly].reverse().map((week) => (
                        <TableRow key={week.weekStart}>
                          <TableCell>{format(parseISO(week.weekStart), "d MMM yyyy")}</TableCell>
                          <TableCell className="text-right">{numberFmt(week.litres, 1)}</TableCell>
                          <TableCell className="text-right">{money(week.netSpend)}</TableCell>
                          <TableCell className="text-right">{numberFmt(week.miles)}</TableCell>
                          <TableCell className="text-right">{week.mpg ?? "—"}</TableCell>
                          <TableCell className="text-right">
                            {week.costPerMile == null ? "—" : money(week.costPerMile, 3)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
            </TabsContent>

            {/* Per vehicle ---------------------------------------------- */}
            <TabsContent value="vehicles" className="pt-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vehicle</TableHead>
                      <TableHead className="text-right">Fills</TableHead>
                      <TableHead className="text-right">Litres</TableHead>
                      <TableHead className="text-right">Spend (net)</TableHead>
                      <TableHead className="text-right">Miles</TableHead>
                      <TableHead className="text-right">MPG</TableHead>
                      <TableHead className="text-right">Cost / mile</TableHead>
                      <TableHead className="text-right">Avg litres / fill</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(analysis?.perVehicle ?? []).map((vehicle) => (
                      <TableRow key={`${vehicle.vehicleId ?? vehicle.registration}`}>
                        <TableCell className="font-mono">
                          {vehicle.registration}
                          {!vehicle.matched && (
                            <Badge variant="destructive" className="ml-2">
                              Unmatched
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{vehicle.fills}</TableCell>
                        <TableCell className="text-right">{numberFmt(vehicle.litres, 1)}</TableCell>
                        <TableCell className="text-right">{money(vehicle.netSpend)}</TableCell>
                        <TableCell className="text-right">{numberFmt(vehicle.miles)}</TableCell>
                        <TableCell className="text-right">{vehicle.mpg ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          {vehicle.costPerMile == null ? "—" : money(vehicle.costPerMile, 3)}
                        </TableCell>
                        <TableCell className="text-right">
                          {numberFmt(vehicle.litresPerFill, 1)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!analysis?.perVehicle.length && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                          No fuel transactions in this period yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Flags ---------------------------------------------------- */}
            <TabsContent value="flags" className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {analysis?.anomalies.length
                    ? `${analysis.anomalies.length} item(s) worth checking`
                    : "Nothing suspicious in this period."}
                </p>
                {(dismissedQuery.data?.size ?? 0) > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => clearDismissalsMutation.mutate()}
                  >
                    Restore {dismissedQuery.data?.size} dismissed
                  </Button>
                )}
              </div>
              {(analysis?.anomalies ?? []).map((anomaly) => (
                <div key={anomaly.key} className="rounded-md border p-3 flex gap-3">
                  <AlertTriangle
                    className={`h-4 w-4 mt-0.5 shrink-0 ${
                      anomaly.severity === "high" ? "text-destructive" : "text-amber-500"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{anomaly.title}</p>
                      <Badge variant={severityVariant(anomaly.severity)}>{anomaly.severity}</Badge>
                      {anomaly.date && (
                        <span className="text-xs text-muted-foreground">
                          {format(parseISO(anomaly.date), "d MMM yyyy")}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{anomaly.detail}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => dismissMutation.mutate(anomaly.key)}
                  >
                    Dismiss
                  </Button>
                </div>
              ))}
            </TabsContent>

            {/* Invoices ------------------------------------------------- */}
            <TabsContent value="invoices" className="pt-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Rows</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(invoicesQuery.data ?? []).map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-mono text-xs">{invoice.invoice_number}</TableCell>
                        <TableCell>
                          {invoice.invoice_date
                            ? format(parseISO(invoice.invoice_date), "d MMM yyyy")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">{money(invoice.net_total)}</TableCell>
                        <TableCell className="text-right">{money(invoice.gross_total)}</TableCell>
                        <TableCell className="text-right">{invoice.parsed_row_count}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button variant="ghost" size="sm" onClick={() => openInvoice(invoice)}>
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMutation.mutate(invoice)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!invoicesQuery.data?.length && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                          No fuel invoices uploaded yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Thresholds ---------------------------------------------- */}
            <TabsContent value="settings" className="pt-4">
              {settingsQuery.data && (
                <form
                  className="grid gap-4 sm:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    settingsMutation.mutate({
                      expected_mpg_min: Number(form.get("expected_mpg_min")),
                      expected_mpg_max: Number(form.get("expected_mpg_max")),
                      max_litres_per_fill: Number(form.get("max_litres_per_fill")),
                      duplicate_fill_window_hours: Number(form.get("duplicate_fill_window_hours")),
                    });
                  }}
                >
                  <div className="space-y-1">
                    <Label htmlFor="expected_mpg_min">Minimum expected MPG</Label>
                    <Input
                      id="expected_mpg_min"
                      name="expected_mpg_min"
                      type="number"
                      step="0.1"
                      defaultValue={settingsQuery.data.expected_mpg_min}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="expected_mpg_max">Maximum believable MPG</Label>
                    <Input
                      id="expected_mpg_max"
                      name="expected_mpg_max"
                      type="number"
                      step="0.1"
                      defaultValue={settingsQuery.data.expected_mpg_max}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="max_litres_per_fill">Tank size (litres per fill)</Label>
                    <Input
                      id="max_litres_per_fill"
                      name="max_litres_per_fill"
                      type="number"
                      step="1"
                      defaultValue={settingsQuery.data.max_litres_per_fill}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="duplicate_fill_window_hours">
                      Duplicate fill window (hours)
                    </Label>
                    <Input
                      id="duplicate_fill_window_hours"
                      name="duplicate_fill_window_hours"
                      type="number"
                      step="1"
                      defaultValue={settingsQuery.data.duplicate_fill_window_hours}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Button type="submit" disabled={settingsMutation.isPending}>
                      Save thresholds
                    </Button>
                  </div>
                </form>
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};

const StatTile: React.FC<{
  label: string;
  value: string;
  icon?: React.ReactNode;
  tone?: "default" | "warning";
}> = ({ label, value, icon, tone = "default" }) => (
  <div
    className={`rounded-md border p-3 ${
      tone === "warning" ? "border-amber-500/50 bg-amber-500/5" : "bg-muted/30"
    }`}
  >
    <p className="text-xs text-muted-foreground flex items-center gap-1">
      {icon}
      {label}
    </p>
    <p className="text-lg font-semibold">{value}</p>
  </div>
);

export default FuelInvoiceAnalysisSection;
