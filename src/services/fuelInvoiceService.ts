import { supabase } from "@/integrations/supabase/client";
import {
  closestReg,
  normaliseReg,
  mpg as calcMpg,
  litresToGallons,
  type WexInvoiceParseResult,
  type WexTransactionRow,
} from "@/lib/wexInvoiceParser";

export interface FuelInvoiceRecord {
  id: string;
  supplier: string;
  account_number: string | null;
  invoice_number: string;
  invoice_date: string | null;
  due_date: string | null;
  currency: string;
  net_total: number;
  vat_total: number;
  gross_total: number;
  file_path: string | null;
  parsed_row_count: number;
  created_at: string;
}

export interface FuelTransactionRecord {
  id: string;
  invoice_id: string;
  trx_reference: string | null;
  trx_date: string;
  trx_time: string | null;
  site_name: string | null;
  raw_vehicle_id: string | null;
  normalised_reg: string | null;
  vehicle_id: string | null;
  odometer: number | null;
  product: string | null;
  quantity_litres: number;
  unit_price: number | null;
  net_amount: number;
  vat_amount: number;
  gross_amount: number;
}

export interface FuelAnalysisSettings {
  id: string;
  expected_mpg_min: number;
  expected_mpg_max: number;
  max_litres_per_fill: number;
  duplicate_fill_window_hours: number;
}

export interface FleetVehicleLite {
  id: string;
  registration: string;
  make: string | null;
  model: string | null;
  normalisedReg: string;
}

export const FUEL_INVOICE_BUCKET = "fuel-invoices";

/* ------------------------------------------------------------------ reads */

export async function fetchFuelInvoices(): Promise<FuelInvoiceRecord[]> {
  const { data, error } = await supabase
    .from("fuel_invoices")
    .select("*")
    .order("invoice_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FuelInvoiceRecord[];
}

/** Fetches transactions, paging past the 1,000-row API limit. */
export async function fetchFuelTransactions(range?: {
  from?: string;
  to?: string;
}): Promise<FuelTransactionRecord[]> {
  const pageSize = 1000;
  const rows: FuelTransactionRecord[] = [];
  for (let page = 0; ; page++) {
    let query = supabase
      .from("fuel_transactions")
      .select("*")
      .order("trx_date", { ascending: true })
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (range?.from) query = query.gte("trx_date", range.from);
    if (range?.to) query = query.lte("trx_date", range.to);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...((data ?? []) as FuelTransactionRecord[]));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

export async function fetchFleetVehicles(): Promise<FleetVehicleLite[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("id, registration, make")
    .order("registration");
  if (error) throw error;
  return (data ?? []).map((v) => ({
    id: v.id,
    registration: v.registration,
    make: v.make ?? null,
    model: null,
    normalisedReg: normaliseReg(v.registration),
  }));
}

export async function fetchFuelAnalysisSettings(): Promise<FuelAnalysisSettings | null> {
  const { data, error } = await supabase
    .from("fuel_analysis_settings")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as FuelAnalysisSettings) ?? null;
}

export async function saveFuelAnalysisSettings(
  id: string,
  updates: Partial<Omit<FuelAnalysisSettings, "id">>
): Promise<void> {
  const { error } = await supabase
    .from("fuel_analysis_settings")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export interface RegAliasRecord {
  id: string;
  normalised_alias: string;
  vehicle_id: string | null;
  ignored: boolean;
}

export async function fetchRegAliases(): Promise<RegAliasRecord[]> {
  const { data, error } = await supabase.from("fuel_vehicle_aliases").select("*");
  if (error) throw error;
  return (data ?? []) as RegAliasRecord[];
}

export async function saveRegAlias(
  alias: string,
  vehicleId: string | null,
  ignored = false
): Promise<void> {
  const { error } = await supabase
    .from("fuel_vehicle_aliases")
    .upsert(
      { normalised_alias: normaliseReg(alias), vehicle_id: vehicleId, ignored },
      { onConflict: "normalised_alias" }
    );
  if (error) throw error;
  await applyAliasToTransactions(normaliseReg(alias), vehicleId);
}

async function applyAliasToTransactions(alias: string, vehicleId: string | null) {
  const { error } = await supabase
    .from("fuel_transactions")
    .update({ vehicle_id: vehicleId })
    .eq("normalised_reg", alias);
  if (error) throw error;
}

/* ----------------------------------------------------------------- upload */

/** Resolves each parsed row to a fleet vehicle using exact regs then saved aliases. */
export function resolveVehicleId(
  reg: string,
  vehicles: FleetVehicleLite[],
  aliases: RegAliasRecord[]
): string | null {
  const exact = vehicles.find((v) => v.normalisedReg === reg);
  if (exact) return exact.id;
  const alias = aliases.find((a) => a.normalised_alias === reg);
  return alias?.vehicle_id ?? null;
}

export interface UploadInvoiceResult {
  invoiceId: string;
  rowCount: number;
  duplicate: boolean;
}

export async function uploadFuelInvoice(
  file: File,
  parsed: WexInvoiceParseResult
): Promise<UploadInvoiceResult> {
  if (!parsed.invoiceNumber) throw new Error("This PDF has no readable invoice number.");
  if (!parsed.transactions.length) throw new Error("No fuel transactions were found in this PDF.");

  const { data: existing } = await supabase
    .from("fuel_invoices")
    .select("id")
    .eq("invoice_number", parsed.invoiceNumber)
    .maybeSingle();
  if (existing) return { invoiceId: existing.id, rowCount: 0, duplicate: true };

  const { data: auth } = await supabase.auth.getUser();
  const filePath = `${parsed.invoiceNumber}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
  const { error: uploadError } = await supabase.storage
    .from(FUEL_INVOICE_BUCKET)
    .upload(filePath, file, { contentType: "application/pdf", upsert: true });
  if (uploadError) throw new Error(`Could not store the PDF: ${uploadError.message}`);

  const { data: invoice, error: invoiceError } = await supabase
    .from("fuel_invoices")
    .insert({
      supplier: parsed.supplier,
      account_number: parsed.accountNumber,
      invoice_number: parsed.invoiceNumber,
      invoice_date: parsed.invoiceDate,
      due_date: parsed.dueDate,
      currency: parsed.currency,
      net_total: parsed.netTotal ?? 0,
      vat_total: parsed.vatTotal ?? 0,
      gross_total: parsed.grossTotal ?? 0,
      file_path: filePath,
      parsed_row_count: parsed.transactions.length,
      uploaded_by: auth.user?.id ?? null,
    })
    .select("id")
    .single();
  if (invoiceError) throw invoiceError;

  const [vehicles, aliases] = await Promise.all([fetchFleetVehicles(), fetchRegAliases()]);
  const rows = parsed.transactions.map((t: WexTransactionRow) => ({
    invoice_id: invoice.id,
    trx_reference: t.trxReference,
    trx_date: t.trxDate,
    trx_time: t.trxTime,
    site_name: t.siteName,
    raw_vehicle_id: t.rawVehicleId,
    normalised_reg: t.normalisedReg,
    vehicle_id: resolveVehicleId(t.normalisedReg, vehicles, aliases),
    card_label:
      parsed.cardTotals.find((c) => c.normalisedCardReg === t.normalisedReg)?.cardMask ?? null,
    odometer: t.odometer,
    product: t.product,
    quantity_litres: t.quantityLitres,
    unit_price: t.unitPrice,
    net_amount: t.netAmount,
    vat_rate: t.vatRate,
    vat_amount: t.vatAmount,
    gross_amount: t.grossAmount,
  }));

  const { error: rowsError } = await supabase.from("fuel_transactions").insert(rows);
  if (rowsError) {
    await supabase.from("fuel_invoices").delete().eq("id", invoice.id);
    throw rowsError;
  }

  return { invoiceId: invoice.id, rowCount: rows.length, duplicate: false };
}

export async function deleteFuelInvoice(invoice: FuelInvoiceRecord): Promise<void> {
  if (invoice.file_path) {
    await supabase.storage.from(FUEL_INVOICE_BUCKET).remove([invoice.file_path]);
  }
  const { error } = await supabase.from("fuel_invoices").delete().eq("id", invoice.id);
  if (error) throw error;
}

export async function getInvoiceDownloadUrl(filePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(FUEL_INVOICE_BUCKET)
    .createSignedUrl(filePath, 60 * 10);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/* --------------------------------------------------------------- analysis */

export interface MileageRow {
  vehicle_id: string | null;
  date: string;
  mileage: number;
  driver_id: string | null;
}

export async function fetchMileage(range?: {
  from?: string;
  to?: string;
}): Promise<MileageRow[]> {
  const pageSize = 1000;
  const rows: MileageRow[] = [];
  for (let page = 0; ; page++) {
    let query = supabase
      .from("timeslips")
      .select("vehicle_id, date, mileage, driver_id")
      .not("mileage", "is", null)
      .order("date", { ascending: true })
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (range?.from) query = query.gte("date", range.from);
    if (range?.to) query = query.lte("date", range.to);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(
      ...((data ?? []) as MileageRow[]).map((r) => ({ ...r, mileage: Number(r.mileage) || 0 }))
    );
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

export type FuelAnomalyType =
  | "unmatched_reg"
  | "low_mpg"
  | "high_mpg"
  | "duplicate_fill"
  | "large_fill"
  | "no_mileage_recorded"
  | "fill_without_timeslip";

export interface FuelAnomaly {
  key: string;
  type: FuelAnomalyType;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  registration: string | null;
  date: string | null;
  amount: number | null;
}

export interface VehicleFuelStats {
  vehicleId: string | null;
  registration: string;
  matched: boolean;
  fills: number;
  litres: number;
  netSpend: number;
  grossSpend: number;
  miles: number;
  mpg: number | null;
  costPerMile: number | null;
  pencePerLitre: number | null;
  litresPerFill: number;
}

export interface FuelAnalysis {
  totals: {
    fills: number;
    litres: number;
    netSpend: number;
    grossSpend: number;
    miles: number;
    mpg: number | null;
    costPerMile: number | null;
    avgPencePerLitre: number | null;
    unmatchedLitres: number;
    unmatchedSpend: number;
  };
  perVehicle: VehicleFuelStats[];
  weekly: Array<{
    weekStart: string;
    litres: number;
    netSpend: number;
    miles: number;
    mpg: number | null;
    costPerMile: number | null;
  }>;
  anomalies: FuelAnomaly[];
  unmatchedRegs: Array<{
    reg: string;
    fills: number;
    litres: number;
    netSpend: number;
    suggestion: { reg: string; vehicleId: string; distance: number } | null;
  }>;
}

const startOfWeek = (isoDate: string): string => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
};

const round = (value: number, dp = 2) => Number(value.toFixed(dp));

export function analyseFuel(
  transactions: FuelTransactionRecord[],
  mileage: MileageRow[],
  vehicles: FleetVehicleLite[],
  aliases: RegAliasRecord[],
  settings: FuelAnalysisSettings,
  dismissedKeys: Set<string> = new Set()
): FuelAnalysis {
  const vehicleById = new Map(vehicles.map((v) => [v.id, v]));
  const ignoredAliases = new Set(
    aliases.filter((a) => a.ignored).map((a) => a.normalised_alias)
  );

  const milesByVehicle = new Map<string, number>();
  const timeslipDays = new Set<string>();
  for (const row of mileage) {
    if (!row.vehicle_id) continue;
    milesByVehicle.set(row.vehicle_id, (milesByVehicle.get(row.vehicle_id) ?? 0) + row.mileage);
    timeslipDays.add(`${row.vehicle_id}|${row.date}`);
  }

  const groups = new Map<string, FuelTransactionRecord[]>();
  for (const t of transactions) {
    const key = t.vehicle_id ?? `unmatched:${t.normalised_reg ?? "unknown"}`;
    const list = groups.get(key);
    if (list) list.push(t);
    else groups.set(key, [t]);
  }

  const anomalies: FuelAnomaly[] = [];
  const perVehicle: VehicleFuelStats[] = [];
  const unmatchedRegs: FuelAnalysis["unmatchedRegs"] = [];

  for (const [key, rows] of groups) {
    const matched = !key.startsWith("unmatched:");
    const vehicle = matched ? vehicleById.get(key) : undefined;
    const reg = matched
      ? vehicle?.registration ?? "Unknown vehicle"
      : rows[0].raw_vehicle_id || rows[0].normalised_reg || "Unknown";
    const litres = rows.reduce((sum, r) => sum + Number(r.quantity_litres), 0);
    const netSpend = rows.reduce((sum, r) => sum + Number(r.net_amount), 0);
    const grossSpend = rows.reduce((sum, r) => sum + Number(r.gross_amount), 0);
    const miles = matched ? milesByVehicle.get(key) ?? 0 : 0;
    const vehicleMpg = calcMpg(miles, litres);

    perVehicle.push({
      vehicleId: matched ? key : null,
      registration: reg,
      matched,
      fills: rows.length,
      litres: round(litres),
      netSpend: round(netSpend),
      grossSpend: round(grossSpend),
      miles: round(miles),
      mpg: vehicleMpg == null ? null : round(vehicleMpg, 1),
      costPerMile: miles > 0 ? round(netSpend / miles, 3) : null,
      pencePerLitre: litres > 0 ? round((netSpend / litres) * 100, 2) : null,
      litresPerFill: round(litres / rows.length),
    });

    if (!matched) {
      const normalised = rows[0].normalised_reg ?? "";
      if (!ignoredAliases.has(normalised)) {
        const suggestionMatch = closestReg(
          normalised,
          vehicles.map((v) => v.normalisedReg)
        );
        const suggestedVehicle = suggestionMatch
          ? vehicles.find((v) => v.normalisedReg === suggestionMatch.reg)
          : undefined;
        unmatchedRegs.push({
          reg: rows[0].raw_vehicle_id || normalised,
          fills: rows.length,
          litres: round(litres),
          netSpend: round(netSpend),
          suggestion:
            suggestionMatch && suggestedVehicle
              ? {
                  reg: suggestedVehicle.registration,
                  vehicleId: suggestedVehicle.id,
                  distance: suggestionMatch.distance,
                }
              : null,
        });
        const anomalyKey = `unmatched_reg:${normalised}`;
        if (!dismissedKeys.has(anomalyKey)) {
          anomalies.push({
            key: anomalyKey,
            type: "unmatched_reg",
            severity: "high",
            title: `Unknown registration "${rows[0].raw_vehicle_id || normalised}"`,
            detail: `${rows.length} fill(s), ${round(litres)} L, £${round(netSpend)} net could not be matched to a fleet vehicle.${
              suggestionMatch && suggestedVehicle
                ? ` Closest fleet match: ${suggestedVehicle.registration}.`
                : ""
            }`,
            registration: rows[0].raw_vehicle_id ?? normalised,
            date: rows[0].trx_date,
            amount: round(netSpend),
          });
        }
      }
      continue;
    }

    // MPG outliers (only meaningful with recorded mileage and a few fills)
    if (miles > 0 && vehicleMpg != null && rows.length >= 2) {
      if (vehicleMpg < settings.expected_mpg_min) {
        const anomalyKey = `low_mpg:${key}`;
        if (!dismissedKeys.has(anomalyKey))
          anomalies.push({
            key: anomalyKey,
            type: "low_mpg",
            severity: "high",
            title: `${reg} is only doing ${round(vehicleMpg, 1)} mpg`,
            detail: `${round(miles)} miles on ${round(litres)} L. Below the expected ${settings.expected_mpg_min} mpg — check for fuel being taken for another vehicle or a mechanical fault.`,
            registration: reg,
            date: null,
            amount: round(netSpend),
          });
      } else if (vehicleMpg > settings.expected_mpg_max) {
        const anomalyKey = `high_mpg:${key}`;
        if (!dismissedKeys.has(anomalyKey))
          anomalies.push({
            key: anomalyKey,
            type: "high_mpg",
            severity: "low",
            title: `${reg} shows an unrealistic ${round(vehicleMpg, 1)} mpg`,
            detail: `${round(miles)} miles on ${round(litres)} L. Fuel may be missing from this invoice or mileage over-reported.`,
            registration: reg,
            date: null,
            amount: round(netSpend),
          });
      }
    } else if (litres > 0 && miles === 0) {
      const anomalyKey = `no_mileage_recorded:${key}`;
      if (!dismissedKeys.has(anomalyKey))
        anomalies.push({
          key: anomalyKey,
          type: "no_mileage_recorded",
          severity: "medium",
          title: `${reg} has fuel but no recorded mileage`,
          detail: `${round(litres)} L (£${round(netSpend)} net) with no timeslip mileage for this period, so mpg and cost per mile cannot be checked.`,
          registration: reg,
          date: null,
          amount: round(netSpend),
        });
    }

    // Per-fill checks
    const sorted = [...rows].sort((a, b) =>
      `${a.trx_date}${a.trx_time ?? ""}`.localeCompare(`${b.trx_date}${b.trx_time ?? ""}`)
    );
    sorted.forEach((row, index) => {
      const litresThisFill = Number(row.quantity_litres);
      if (litresThisFill > settings.max_litres_per_fill) {
        const anomalyKey = `large_fill:${row.id}`;
        if (!dismissedKeys.has(anomalyKey))
          anomalies.push({
            key: anomalyKey,
            type: "large_fill",
            severity: "high",
            title: `${reg} took ${round(litresThisFill)} L in one fill`,
            detail: `On ${row.trx_date} at ${row.site_name ?? "unknown site"} — more than the ${settings.max_litres_per_fill} L tank limit, so fuel may have gone into another vehicle or a can.`,
            registration: reg,
            date: row.trx_date,
            amount: round(Number(row.net_amount)),
          });
      }

      const previous = sorted[index - 1];
      if (previous) {
        const hours =
          (new Date(`${row.trx_date}T${row.trx_time ?? "00:00"}:00Z`).getTime() -
            new Date(`${previous.trx_date}T${previous.trx_time ?? "00:00"}:00Z`).getTime()) /
          3_600_000;
        if (hours >= 0 && hours <= settings.duplicate_fill_window_hours) {
          const anomalyKey = `duplicate_fill:${previous.id}:${row.id}`;
          if (!dismissedKeys.has(anomalyKey))
            anomalies.push({
              key: anomalyKey,
              type: "duplicate_fill",
              severity: "medium",
              title: `${reg} filled twice within ${round(hours, 1)} hours`,
              detail: `${round(Number(previous.quantity_litres))} L at ${previous.site_name ?? "unknown"} then ${round(litresThisFill)} L at ${row.site_name ?? "unknown"} on ${row.trx_date}.`,
              registration: reg,
              date: row.trx_date,
              amount: round(Number(row.net_amount) + Number(previous.net_amount)),
            });
        }
      }

      if (timeslipDays.size && !timeslipDays.has(`${key}|${row.trx_date}`)) {
        const anomalyKey = `fill_without_timeslip:${row.id}`;
        if (!dismissedKeys.has(anomalyKey))
          anomalies.push({
            key: anomalyKey,
            type: "fill_without_timeslip",
            severity: "medium",
            title: `${reg} fuelled on a day with no timeslip`,
            detail: `${round(litresThisFill)} L (£${round(Number(row.net_amount))} net) on ${row.trx_date} at ${row.site_name ?? "unknown site"} but no driver timeslip records this van working.`,
            registration: reg,
            date: row.trx_date,
            amount: round(Number(row.net_amount)),
          });
      }
    });
  }

  const litresTotal = transactions.reduce((sum, t) => sum + Number(t.quantity_litres), 0);
  const netTotal = transactions.reduce((sum, t) => sum + Number(t.net_amount), 0);
  const grossTotal = transactions.reduce((sum, t) => sum + Number(t.gross_amount), 0);
  const matchedVehicleIds = new Set(
    transactions.filter((t) => t.vehicle_id).map((t) => t.vehicle_id as string)
  );
  const milesTotal = [...matchedVehicleIds].reduce(
    (sum, id) => sum + (milesByVehicle.get(id) ?? 0),
    0
  );
  const unmatched = transactions.filter((t) => !t.vehicle_id);

  // Weekly trend
  const weeklyMap = new Map<string, { litres: number; netSpend: number }>();
  for (const t of transactions) {
    const week = startOfWeek(t.trx_date);
    const entry = weeklyMap.get(week) ?? { litres: 0, netSpend: 0 };
    entry.litres += Number(t.quantity_litres);
    entry.netSpend += Number(t.net_amount);
    weeklyMap.set(week, entry);
  }
  const weeklyMiles = new Map<string, number>();
  for (const row of mileage) {
    const week = startOfWeek(row.date);
    weeklyMiles.set(week, (weeklyMiles.get(week) ?? 0) + row.mileage);
  }
  const weekly = [...weeklyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, entry]) => {
      const miles = weeklyMiles.get(weekStart) ?? 0;
      const weekMpg = calcMpg(miles, entry.litres);
      return {
        weekStart,
        litres: round(entry.litres),
        netSpend: round(entry.netSpend),
        miles: round(miles),
        mpg: weekMpg == null ? null : round(weekMpg, 1),
        costPerMile: miles > 0 ? round(entry.netSpend / miles, 3) : null,
      };
    });

  const severityRank = { high: 0, medium: 1, low: 2 } as const;

  return {
    totals: {
      fills: transactions.length,
      litres: round(litresTotal),
      netSpend: round(netTotal),
      grossSpend: round(grossTotal),
      miles: round(milesTotal),
      mpg: milesTotal > 0 && litresTotal > 0 ? round(milesTotal / litresToGallons(litresTotal), 1) : null,
      costPerMile: milesTotal > 0 ? round(netTotal / milesTotal, 3) : null,
      avgPencePerLitre: litresTotal > 0 ? round((netTotal / litresTotal) * 100, 2) : null,
      unmatchedLitres: round(unmatched.reduce((sum, t) => sum + Number(t.quantity_litres), 0)),
      unmatchedSpend: round(unmatched.reduce((sum, t) => sum + Number(t.net_amount), 0)),
    },
    perVehicle: perVehicle.sort((a, b) => b.netSpend - a.netSpend),
    weekly,
    anomalies: anomalies.sort(
      (a, b) =>
        severityRank[a.severity] - severityRank[b.severity] ||
        (b.date ?? "").localeCompare(a.date ?? "")
    ),
    unmatchedRegs: unmatchedRegs.sort((a, b) => b.netSpend - a.netSpend),
  };
}

/* ------------------------------------------------------- anomaly dismissal */

export async function fetchDismissedAnomalies(): Promise<Set<string>> {
  const { data, error } = await supabase.from("fuel_anomaly_dismissals").select("scope_key");
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.scope_key));
}

export async function dismissAnomaly(key: string, note?: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("fuel_anomaly_dismissals")
    .upsert(
      { scope_key: key, note: note ?? null, dismissed_by: auth.user?.id ?? null },
      { onConflict: "scope_key" }
    );
  if (error) throw error;
}

export async function restoreAnomaly(key: string): Promise<void> {
  const { error } = await supabase
    .from("fuel_anomaly_dismissals")
    .delete()
    .eq("scope_key", key);
  if (error) throw error;
}
