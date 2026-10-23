// Sends an announcement (email or WhatsApp) to many recipients on the server.
// The browser makes one call; the loop runs in the background so closing the
// page can't stop a send halfway. Admin only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MAX_RECIPIENTS = 5000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const { data: { user } } = await admin.auth.getUser(auth.slice(7));
  if (!user) return json({ error: "Unauthorized" }, 401);
  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (isAdmin !== true) return json({ error: "Forbidden" }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const channel = body?.channel;
  const recipients = Array.isArray(body?.recipients) ? body.recipients : [];
  if (channel !== "email" && channel !== "whatsapp") return json({ error: "channel must be email or whatsapp" }, 400);
  if (recipients.length === 0 || recipients.length > MAX_RECIPIENTS) return json({ error: "Invalid recipients" }, 400);

  let targets: string[];
  let send: (t: string) => Promise<void>;
  let delayMs: number;

  if (channel === "email") {
    const { subject, html, text } = body;
    if (typeof subject !== "string" || !subject.trim() || subject.length > 300) return json({ error: "Subject required" }, 400);
    if (typeof html !== "string" || !html.trim() || html.length > 500_000) return json({ error: "Content required" }, 400);
    targets = [...new Set(recipients.map((r: any) => String(r ?? "").trim().toLowerCase()).filter((e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))] as string[];
    delayMs = 300;
    send = async (to) => {
      const { error } = await admin.functions.invoke("send-email", { body: { to, subject, html, text } });
      if (error) throw error;
    };
  } else {
    const { message, templateName, langCode, parameters } = body;
    if (!templateName && (typeof message !== "string" || !message.trim() || message.length > 4096)) return json({ error: "Message required" }, 400);
    targets = [...new Set(recipients.map((r: any) => String(r ?? "").trim()).filter((p: string) => p.replace(/\D/g, "").length >= 5))] as string[];
    delayMs = 500;
    send = async (phone) => {
      const payload: Record<string, unknown> = { phone };
      if (templateName) Object.assign(payload, { templateName, langCode: langCode || "en", parameters: Array.isArray(parameters) ? parameters : [] });
      else payload.message = message.trim();
      const { error } = await admin.functions.invoke("send-announcement-whatsapp", { body: payload });
      if (error) throw error;
    };
  }

  const run = async () => {
    let ok = 0, failed = 0;
    for (let i = 0; i < targets.length; i++) {
      try { await send(targets[i]); ok++; } catch { failed++; }
      if (i < targets.length - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
    console.log(`[send-announcement-batch] ${channel} done: ${ok} sent, ${failed} failed`);
  };
  // @ts-ignore EdgeRuntime is provided by Supabase
  EdgeRuntime.waitUntil(run());

  return json({ accepted: true, count: targets.length }, 202);
});
