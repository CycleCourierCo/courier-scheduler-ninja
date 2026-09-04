// Public endpoint hit right after the receiver approves repairs on /repair-offer/:id.
// It raises the receiver-billed QuickBooks invoice(s) for the repairs they just approved
// and emails them the pay link + PDF — the same outcome as the staff-side button.
//
// Safe by design: it only ever invoices issues that are already approved, billed to the
// receiver and not yet invoiced, so a hostile caller can trigger nothing extra.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const orderId = (body as { orderId?: string })?.orderId;
    if (!orderId || !UUID_RE.test(orderId)) {
      return json({ error: "A valid orderId is required" }, 400);
    }

    const { data: issues, error: issuesError } = await supabase
      .from("inspection_issues")
      .select("id")
      .eq("order_id", orderId)
      .eq("billing_party", "receiver")
      .is("invoice_number", null)
      .not("receiver_approved_at", "is", null);

    if (issuesError) {
      console.error("Failed to load receiver-approved issues:", issuesError.message);
      return json({ error: "Could not load approved repairs" }, 500);
    }

    const pending = (issues ?? []).map((i: { id: string }) => i.id);
    if (pending.length === 0) {
      return json({ success: true, invoiced: 0 });
    }

    if (!cronSecret) {
      console.error("CRON_SECRET is not configured; cannot raise receiver invoices automatically");
      return json({ success: true, invoiced: 0, warning: "invoicing_unavailable" });
    }

    // Invoice in the background so the receiver's page confirms instantly.
    const work = (async () => {
      for (const issueId of pending) {
        try {
          const res = await fetch(`${supabaseUrl}/functions/v1/create-receiver-inspection-invoice`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Cron-Secret": cronSecret,
              apikey: serviceKey,
            },
            body: JSON.stringify({ issueId }),
          });
          if (!res.ok) {
            const text = await res.text();
            console.error(
              `Receiver invoice failed for issue ${issueId} [${res.status}]: ${text.slice(0, 300)}`
            );
          }
        } catch (err) {
          console.error(
            `Receiver invoice threw for issue ${issueId}:`,
            (err as Error)?.message
          );
        }
      }
    })();

    // deno-lint-ignore no-explicit-any
    const runtime = (globalThis as any).EdgeRuntime;
    if (runtime?.waitUntil) {
      runtime.waitUntil(work);
    } else {
      await work;
    }

    return json({ success: true, invoiced: pending.length });
  } catch (err) {
    console.error("finalise-public-repair-offer error:", (err as Error)?.message);
    return json({ error: "Unexpected error" }, 500);
  }
};

serve(handler);
