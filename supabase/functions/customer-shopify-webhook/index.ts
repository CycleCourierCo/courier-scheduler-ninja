import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-shopify-hmac-sha256, x-shopify-topic, x-shopify-shop-domain",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function verifyHmac(body: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const hash = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  const computed = btoa(String.fromCharCode(...new Uint8Array(hash)));
  return computed === signature.replace("sha256=", "");
}

function formatPhone(phone?: string): string {
  if (!phone) return "";
  const c = phone.replace(/[\s\-()]/g, "");
  if (c.startsWith("07")) return "+44" + c.substring(1);
  if (c.startsWith("447")) return "+" + c;
  return phone;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-shopify-hmac-sha256");
    const topic = req.headers.get("x-shopify-topic");
    const shopDomain = req.headers.get("x-shopify-shop-domain")?.toLowerCase();

    if (!shopDomain) {
      return new Response(JSON.stringify({ error: "Missing shop domain" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up customer store
    const { data: store } = await admin
      .from("customer_shopify_stores")
      .select("*")
      .eq("shop_domain", shopDomain)
      .maybeSingle();

    if (!store) {
      console.warn("No customer store registered for", shopDomain);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }
    if (!store.is_active) {
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // Retrieve secret from vault
    const { data: secretVal } = await admin.rpc("get_vault_secret", {
      secret_name: store.webhook_secret_vault_key,
    });

    if (!secretVal || !(await verifyHmac(rawBody, signature, secretVal as string))) {
      console.warn("Invalid HMAC for shop", shopDomain);
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    if (topic !== "orders/paid") {
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    const order = JSON.parse(rawBody);
    const shopifyOrderId = String(order.id);
    const orderNumber = String(order.order_number ?? order.id);

    // Background processing — respond fast
    const processOrder = async () => {
      // Retrieve admin access token
      const { data: tokenVal } = await admin.rpc("get_vault_secret", {
        secret_name: store.access_token_vault_key,
      });
      const accessToken = tokenVal as string | null;

      // Build receiver from Shopify shipping address
      const ship = order.shipping_address || order.billing_address || {};
      const receiverDetails = {
        name: [ship.first_name, ship.last_name].filter(Boolean).join(" ").trim() || order.email || "Customer",
        email: order.email || "",
        phone: formatPhone(ship.phone || order.phone),
        street: [ship.address1, ship.address2].filter(Boolean).join(", "),
        city: ship.city || "",
        state: ship.province || "",
        zipCode: ship.zip || "",
        country: ship.country || "United Kingdom",
      };

      for (const item of order.line_items ?? []) {
        const sku = (item.sku || "").trim();
        if (!sku) {
          await admin.from("customer_shopify_order_log").insert({
            store_id: store.id,
            user_id: store.user_id,
            shop_domain: shopDomain,
            shopify_order_id: shopifyOrderId,
            shopify_order_number: orderNumber,
            line_item_sku: `__nosku_${item.id}`,
            status: "unmatched_sku",
            message: `Line item "${item.title}" has no SKU`,
            raw_payload: item,
          });
          continue;
        }

        // Dedupe
        const { data: existingLog } = await admin
          .from("customer_shopify_order_log")
          .select("id")
          .eq("shop_domain", shopDomain)
          .eq("shopify_order_id", shopifyOrderId)
          .eq("line_item_sku", sku)
          .maybeSingle();
        if (existingLog) continue;

        // Find stock by SKU (FIFO)
        const { data: stockMatch } = await admin
          .from("warehouse_stock")
          .select("*")
          .eq("user_id", store.user_id)
          .eq("sku", sku)
          .eq("status", "stored")
          .order("deposited_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!stockMatch) {
          await admin.from("customer_shopify_order_log").insert({
            store_id: store.id,
            user_id: store.user_id,
            shop_domain: shopDomain,
            shopify_order_id: shopifyOrderId,
            shopify_order_number: orderNumber,
            line_item_sku: sku,
            status: "unmatched_sku",
            message: `No stored bike found for SKU "${sku}"`,
            raw_payload: item,
          });
          continue;
        }

        // Get customer profile
        const { data: profile } = await admin
          .from("profiles")
          .select("name, email, phone, address_line_1, city, postal_code")
          .eq("id", store.user_id)
          .single();

        // Create the order
        const ts = new Date().toISOString();
        const { data: newOrder, error: orderErr } = await admin
          .from("orders")
          .insert({
            user_id: store.user_id,
            sender: {
              name: profile?.name || "Warehouse",
              email: profile?.email || "",
              phone: profile?.phone || "",
              address: {
                street: profile?.address_line_1 || "Depot",
                city: profile?.city || "",
                state: "",
                zipCode: profile?.postal_code || "",
                country: "United Kingdom",
              },
            },
            receiver: {
              name: receiverDetails.name,
              email: receiverDetails.email,
              phone: receiverDetails.phone,
              address: {
                street: receiverDetails.street,
                city: receiverDetails.city,
                state: receiverDetails.state,
                zipCode: receiverDetails.zipCode,
                country: receiverDetails.country,
              },
            },
            bike_brand: stockMatch.bike_brand,
            bike_model: stockMatch.bike_model,
            bike_type: stockMatch.bike_type,
            bike_value: stockMatch.bike_value,
            bike_quantity: 1,
            status: "created",
            customer_order_number: `SH-${orderNumber}-${sku}`,
            created_at: ts,
            updated_at: ts,
          })
          .select()
          .single();

        if (orderErr || !newOrder) {
          await admin.from("customer_shopify_order_log").insert({
            store_id: store.id,
            user_id: store.user_id,
            shop_domain: shopDomain,
            shopify_order_id: shopifyOrderId,
            shopify_order_number: orderNumber,
            line_item_sku: sku,
            status: "error",
            message: `Failed to create order: ${orderErr?.message}`,
            warehouse_stock_id: stockMatch.id,
          });
          continue;
        }

        // Reserve stock
        await admin
          .from("warehouse_stock")
          .update({ status: "reserved", linked_order_id: newOrder.id })
          .eq("id", stockMatch.id);

        // Log success
        await admin.from("customer_shopify_order_log").insert({
          store_id: store.id,
          user_id: store.user_id,
          shop_domain: shopDomain,
          shopify_order_id: shopifyOrderId,
          shopify_order_number: orderNumber,
          line_item_sku: sku,
          status: "matched",
          message: `Created order for ${stockMatch.bike_brand || ""} ${stockMatch.bike_model || ""}`.trim(),
          warehouse_stock_id: stockMatch.id,
          linked_order_id: newOrder.id,
        });

        // Generate tracking + push fulfilment to Shopify (best effort)
        try {
          const trackingRes = await fetch(`${SUPABASE_URL}/functions/v1/generate-tracking-number`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SERVICE_ROLE}`,
            },
            body: JSON.stringify({
              senderName: profile?.name || "Warehouse",
              receiverZip: receiverDetails.zipCode,
              orderId: newOrder.id,
            }),
          });
          let trackingNumber: string | null = null;
          if (trackingRes.ok) {
            const t = await trackingRes.json();
            trackingNumber = t.trackingNumber || t.tracking_number || null;
            if (trackingNumber) {
              await admin
                .from("orders")
                .update({ tracking_number: trackingNumber })
                .eq("id", newOrder.id);
            }
          }

          // Push fulfilment to customer's Shopify
          if (accessToken && trackingNumber && item.id) {
            // Get fulfillment orders for this Shopify order
            const foRes = await fetch(
              `https://${shopDomain}/admin/api/2024-10/orders/${shopifyOrderId}/fulfillment_orders.json`,
              { headers: { "X-Shopify-Access-Token": accessToken } },
            );
            if (foRes.ok) {
              const foData = await foRes.json();
              const fos = foData.fulfillment_orders || [];
              const lineItemsByFo: Record<string, any[]> = {};
              for (const fo of fos) {
                if (fo.status !== "open") continue;
                for (const li of fo.line_items || []) {
                  if (li.line_item_id === item.id) {
                    (lineItemsByFo[fo.id] ||= []).push({
                      id: li.id,
                      quantity: li.quantity,
                    });
                  }
                }
              }
              const lineItemsByFulfillmentOrder = Object.entries(lineItemsByFo).map(
                ([fulfillment_order_id, fulfillment_order_line_items]) => ({
                  fulfillment_order_id: Number(fulfillment_order_id),
                  fulfillment_order_line_items,
                }),
              );
              if (lineItemsByFulfillmentOrder.length > 0) {
                const fulfRes = await fetch(
                  `https://${shopDomain}/admin/api/2024-10/fulfillments.json`,
                  {
                    method: "POST",
                    headers: {
                      "X-Shopify-Access-Token": accessToken,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      fulfillment: {
                        notify_customer: true,
                        tracking_info: {
                          number: trackingNumber,
                          company: "Cycle Courier Co",
                          url: `https://booking.cyclecourierco.com/tracking/${trackingNumber}`,
                        },
                        line_items_by_fulfillment_order: lineItemsByFulfillmentOrder,
                      },
                    }),
                  },
                );
                if (fulfRes.ok) {
                  await admin.from("customer_shopify_order_log").insert({
                    store_id: store.id,
                    user_id: store.user_id,
                    shop_domain: shopDomain,
                    shopify_order_id: shopifyOrderId,
                    shopify_order_number: orderNumber,
                    line_item_sku: `${sku}__fulfilled`,
                    status: "fulfilled",
                    message: `Pushed fulfilment to Shopify with tracking ${trackingNumber}`,
                    linked_order_id: newOrder.id,
                  });
                } else {
                  const errTxt = await fulfRes.text();
                  await admin.from("customer_shopify_order_log").insert({
                    store_id: store.id,
                    user_id: store.user_id,
                    shop_domain: shopDomain,
                    shopify_order_id: shopifyOrderId,
                    shopify_order_number: orderNumber,
                    line_item_sku: `${sku}__fulfill_error`,
                    status: "error",
                    message: `Shopify fulfilment failed: ${fulfRes.status} ${errTxt.slice(0, 300)}`,
                    linked_order_id: newOrder.id,
                  });
                }
              }
            }
          }
        } catch (e) {
          console.error("Tracking/fulfilment push failed:", e);
        }
      }
    };

    // @ts-ignore - EdgeRuntime is provided by Supabase
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(processOrder());
    } else {
      processOrder().catch((e) => console.error(e));
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("customer-shopify-webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
