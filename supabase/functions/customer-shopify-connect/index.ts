import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const body = await req.json();
    const action = (body?.action as string) || "save";

    if (action === "disconnect") {
      const { data: existing } = await admin
        .from("customer_shopify_stores")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (existing) {
        await admin.from("customer_shopify_stores").delete().eq("id", existing.id);
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "test") {
      const shopDomain = (body?.shop_domain as string)?.trim().toLowerCase();
      const accessToken = body?.access_token as string;
      if (!shopDomain || !accessToken) {
        return new Response(JSON.stringify({ error: "shop_domain and access_token required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const res = await fetch(`https://${shopDomain}/admin/api/2024-10/shop.json`, {
        headers: { "X-Shopify-Access-Token": accessToken },
      });
      if (!res.ok) {
        return new Response(JSON.stringify({ success: false, status: res.status, message: await res.text() }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await res.json();
      return new Response(JSON.stringify({ success: true, shop: data.shop?.name }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // save
    const shopDomain = (body?.shop_domain as string)?.trim().toLowerCase();
    const accessToken = body?.access_token as string;
    const webhookSecret = body?.webhook_secret as string;

    if (!shopDomain || !accessToken || !webhookSecret) {
      return new Response(
        JSON.stringify({ error: "shop_domain, access_token, webhook_secret required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify token works
    const verify = await fetch(`https://${shopDomain}/admin/api/2024-10/shop.json`, {
      headers: { "X-Shopify-Access-Token": accessToken },
    });
    if (!verify.ok) {
      return new Response(
        JSON.stringify({ error: "Invalid Shopify credentials", status: verify.status }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Upsert (delete existing first, then insert fresh vault keys)
    const { data: existing } = await admin
      .from("customer_shopify_stores")
      .select("id, access_token_vault_key, webhook_secret_vault_key")
      .eq("user_id", userId)
      .maybeSingle();

    const tokenKey = `shopify_token_${userId}_${Date.now()}`;
    const secretKey = `shopify_whsec_${userId}_${Date.now()}`;

    await admin.rpc("create_webhook_secret", { p_secret: accessToken, p_name: tokenKey });
    await admin.rpc("create_webhook_secret", { p_secret: webhookSecret, p_name: secretKey });

    if (existing) {
      await admin
        .from("customer_shopify_stores")
        .update({
          shop_domain: shopDomain,
          access_token_vault_key: tokenKey,
          webhook_secret_vault_key: secretKey,
          is_active: true,
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await admin.from("customer_shopify_stores").insert({
        user_id: userId,
        shop_domain: shopDomain,
        access_token_vault_key: tokenKey,
        webhook_secret_vault_key: secretKey,
        is_active: true,
        last_synced_at: new Date().toISOString(),
      });
    }

    const webhookUrl = `${SUPABASE_URL}/functions/v1/customer-shopify-webhook`;
    return new Response(JSON.stringify({ success: true, webhook_url: webhookUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("customer-shopify-connect error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
