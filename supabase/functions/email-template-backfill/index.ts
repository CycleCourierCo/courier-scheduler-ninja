// Admin-only: fills Email Centre previews from emails already sent through Resend.
// mode "subjects": returns distinct recent subjects (no bodies) so rules can be built.
// mode "apply": { rules: { [templateKey]: regexSource } } saves the newest matching email
// per template as its sample. Templates that already have a sample are left alone.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAdminOrCronAuth, createAuthErrorResponse } from "../_shared/auth.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function resend(path: string) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(`https://api.resend.com${path}`, { headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}` } });
    if (r.status === 429) { await sleep(1200 * (i + 1)); continue; }
    if (!r.ok) throw new Error(`resend ${r.status}`);
    return await r.json();
  }
  throw new Error("resend rate limited");
}

async function listEmails(pages: number) {
  const out: any[] = [];
  let after: string | null = null;
  for (let p = 0; p < pages; p++) {
    const res: any = await resend(`/emails?limit=100${after ? `&after=${after}` : ""}`);
    const rows = res?.data || [];
    out.push(...rows);
    if (!res?.has_more || !rows.length) break;
    after = rows[rows.length - 1].id;
    await sleep(600);
  }
  return out; // newest first
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireAdminOrCronAuth(req);
  if (!auth.success) return createAuthErrorResponse(auth.error || "Unauthorized", auth.status || 401);
  try {
    const body = await req.json().catch(() => ({}));
    const pages = Math.min(Math.max(Number(body?.pages) || 10, 1), 50);
    const emails = await listEmails(pages);
    const shape = (s: string) => String(s || "").replace(/CCC\w+/g, "#").replace(/\d+/g, "0").slice(0, 120);

    if (body?.mode === "subjects") {
      const counts: Record<string, number> = {};
      for (const e of emails) counts[shape(e.subject)] = (counts[shape(e.subject)] || 0) + 1;
      return json({ scanned: emails.length, subjects: counts });
    }

    const rules: Record<string, string> = body?.rules && typeof body.rules === "object" ? body.rules : {};
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: tpls } = await admin.from("email_templates").select("key, sample_html");
    const result: Record<string, string> = {};
    for (const t of tpls || []) {
      if (t.sample_html && !body?.overwrite) { result[t.key] = "already had preview"; continue; }
      const src = rules[t.key];
      if (!src) { result[t.key] = "no rule"; continue; }
      const re = new RegExp(src, "i");
      const hit = emails.find((e) => re.test(e.subject || "") && !/^\[TEST\]/.test(e.subject || ""));
      if (!hit) { result[t.key] = "not found in recent emails"; continue; }
      const full: any = await resend(`/emails/${hit.id}`);
      await sleep(600);
      if (!full?.html) { result[t.key] = "no body stored"; continue; }
      await admin.from("email_templates").update({
        sample_subject: String(full.subject || "").slice(0, 300),
        sample_html: String(full.html).slice(0, 400_000),
        sample_at: full.created_at || new Date().toISOString(),
      }).eq("key", t.key);
      result[t.key] = "filled";
    }
    return json({ scanned: emails.length, result });
  } catch (_e) {
    console.error("email-template-backfill failed");
    return json({ error: "Backfill failed" }, 500);
  }
});
