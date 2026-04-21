import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function normaliseReg(input: string): string {
  return (input || "").toUpperCase().replace(/\s+/g, "").trim();
}

const UK_REG_RE = /^[A-Z0-9]{2,8}$/;

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = userData.user.id;

    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr || !isAdmin) {
      return json({ error: "Forbidden — admin only" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const registration = normaliseReg(body?.registration ?? "");
    if (!registration || !UK_REG_RE.test(registration)) {
      return json({ error: "Invalid registration" }, 400);
    }

    const apiKey = Deno.env.get("DVLA_VES_API_KEY");
    if (!apiKey) return json({ error: "Server is missing DVLA_VES_API_KEY" }, 500);

    const vesRes = await fetch(
      "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles",
      {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ registrationNumber: registration }),
      },
    );

    if (vesRes.status === 404) {
      return json({ error: "Vehicle not found at DVLA" }, 404);
    }
    if (!vesRes.ok) {
      const text = await vesRes.text().catch(() => "");
      return json({ error: `DVLA error (${vesRes.status})`, details: text.slice(0, 500) }, vesRes.status);
    }

    const ves = (await vesRes.json()) as VesResponse;

    return json({
      registration: ves.registrationNumber ?? registration,
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
      ves_raw: ves,
    });
  } catch (e) {
    console.error("lookup-vehicle error", e);
    return json({ error: (e as Error).message ?? "Unexpected error" }, 500);
  }
});
