import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface VesResponse {
  registrationNumber?: string;
  taxStatus?: string;
  taxDueDate?: string;
  motStatus?: string;
  motExpiryDate?: string;
  make?: string;
  yearOfManufacture?: number;
  engineCapacity?: number;
  co2Emissions?: number;
  fuelType?: string;
  markedForExport?: boolean;
  colour?: string;
  typeApproval?: string;
  wheelplan?: string;
  revenueWeight?: number;
  realDrivingEmissions?: string;
  dateOfLastV5CIssued?: string;
  euroStatus?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("DVLA_VES_API_KEY");
  if (!apiKey) return json({ error: "Missing DVLA_VES_API_KEY" }, 500);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Validate cron secret against vault entry 'cron_secret'
  const cronSecret = req.headers.get("X-Cron-Secret");
  const { data: expected, error: secretErr } = await supabase.rpc("get_cron_secret");
  if (secretErr || !expected || cronSecret !== expected) {
    return json({ error: "Unauthorized" }, 401);
  }

  const { data: vehicles, error } = await supabase
    .from("vehicles")
    .select("id, registration");
  if (error) return json({ error: error.message }, 500);

  let success = 0;
  let failed = 0;
  const failures: { registration: string; status: number | string }[] = [];

  for (const v of vehicles ?? []) {
    try {
      const res = await fetch(
        "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles",
        {
          method: "POST",
          headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ registrationNumber: v.registration }),
        },
      );

      if (!res.ok) {
        failed++;
        failures.push({ registration: v.registration, status: res.status });
        console.warn(`DVLA refresh failed`, { reg: v.registration, status: res.status });
        await sleep(400);
        continue;
      }

      const ves = (await res.json()) as VesResponse;
      const { error: upErr } = await supabase
        .from("vehicles")
        .update({
          make: ves.make ?? null,
          colour: ves.colour ?? null,
          fuel_type: ves.fuelType ?? null,
          year_of_manufacture: ves.yearOfManufacture ?? null,
          engine_capacity: ves.engineCapacity ?? null,
          co2_emissions: ves.co2Emissions ?? null,
          tax_status: ves.taxStatus ?? null,
          tax_due_date: ves.taxDueDate ?? null,
          mot_status: ves.motStatus ?? null,
          mot_expiry_date: ves.motExpiryDate ?? null,
          date_of_last_v5c_issued: ves.dateOfLastV5CIssued ?? null,
          marked_for_export: ves.markedForExport ?? null,
          type_approval: ves.typeApproval ?? null,
          wheelplan: ves.wheelplan ?? null,
          revenue_weight: ves.revenueWeight ?? null,
          euro_status: ves.euroStatus ?? null,
          real_driving_emissions: ves.realDrivingEmissions ?? null,
          ves_raw: ves as unknown as Record<string, unknown>,
          last_refreshed_at: new Date().toISOString(),
        })
        .eq("id", v.id);

      if (upErr) {
        failed++;
        failures.push({ registration: v.registration, status: "db-error" });
        console.warn("DB update failed", { reg: v.registration, err: upErr.message });
      } else {
        success++;
      }
    } catch (e) {
      failed++;
      failures.push({ registration: v.registration, status: "exception" });
      console.error("refresh exception", { reg: v.registration, err: (e as Error).message });
    }

    // gentle on DVLA rate limits
    await sleep(400);
  }

  console.log(`refresh-vehicles complete`, { total: vehicles?.length ?? 0, success, failed });
  return json({ total: vehicles?.length ?? 0, success, failed, failures });
});
