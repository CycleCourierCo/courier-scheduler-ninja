import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { identifyCaller } from "../_shared/staffAuth.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const NAME_RE = /^[a-z0-9_]{1,512}$/;
const CATEGORIES = ["UTILITY", "MARKETING", "AUTHENTICATION"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const caller = await identifyCaller(req);
    if (!caller || (caller.kind === "user" && !caller.roles.includes("admin"))) {
      return json({ error: "Admins only" }, 403);
    }
    const KEY = Deno.env.get("SENDZEN_API_KEY");
    const WABA = Deno.env.get("SENDZEN_WABA_ID");
    if (!KEY || !WABA) return json({ error: "WhatsApp service not configured" }, 500);
    const base = `https://api.sendzen.io/v1/${encodeURIComponent(WABA)}/message_templates`;
    const headers = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === "list") {
      const all: any[] = [];
      let after: string | undefined;
      for (let i = 0; i < 10; i++) {
        const u = new URL(base);
        u.searchParams.set("limit", "100");
        if (after) u.searchParams.set("after", after);
        const r = await fetch(u, { headers });
        const text = await r.text();
        if (!r.ok) return json({ error: "SendZen list failed", status: r.status, details: text.slice(0, 500) }, 502);
        const d = JSON.parse(text);
        const rows = Array.isArray(d) ? d : d?.data?.data ?? d?.data ?? d?.message_templates ?? [];
        all.push(...(Array.isArray(rows) ? rows : []));
        after = d?.data?.paging?.cursors?.after ?? d?.paging?.cursors?.after;
        const hasNext = d?.data?.paging?.next ?? d?.paging?.next;
        if (!after || !hasNext) break;
      }
      return json({
        templates: all.map((t) => ({
          id: t.id ?? null, name: t.name, language: t.language, category: t.category,
          status: t.status, components: t.components ?? [],
        })),
      });
    }

    if (action === "create") {
      const { name, language, category, components } = body;
      if (typeof name !== "string" || !NAME_RE.test(name)) return json({ error: "Name must be lowercase letters, numbers and underscores" }, 400);
      if (typeof language !== "string" || !/^[a-z]{2}(_[A-Z]{2})?$/.test(language)) return json({ error: "Invalid language" }, 400);
      if (!CATEGORIES.includes(category)) return json({ error: "Invalid category" }, 400);
      if (!Array.isArray(components) || components.length === 0 || components.length > 10) return json({ error: "Invalid components" }, 400);
      const r = await fetch(base, { method: "POST", headers, body: JSON.stringify({ name, language, category, components }) });
      const text = await r.text();
      if (!r.ok) return json({ error: "SendZen rejected the template", status: r.status, details: text.slice(0, 1000) }, 400);
      return json({ ok: true, result: text.slice(0, 1000) });
    }

    if (action === "delete") {
      const { name, hsm_id } = body;
      if (typeof name !== "string" || !NAME_RE.test(name)) return json({ error: "Invalid name" }, 400);
      const u = new URL(base);
      u.searchParams.set("name", name);
      if (typeof hsm_id === "string" && /^[0-9A-Za-z_-]{1,64}$/.test(hsm_id)) u.searchParams.set("hsm_id", hsm_id);
      const r = await fetch(u, { method: "DELETE", headers });
      const text = await r.text();
      if (!r.ok) return json({ error: "SendZen delete failed", status: r.status, details: text.slice(0, 500) }, 400);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("whatsapp-templates error", e instanceof Error ? e.message : "unknown");
    return json({ error: "Internal server error" }, 500);
  }
});
