import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookPayload {
  order_id: string;
  event_type: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { order_id, event_type }: WebhookPayload = await req.json();
    console.log(`Triggering webhooks for order ${order_id}, event: ${event_type}`);

    // Fetch order data
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, profiles!orders_user_id_fkey(id, name, email)')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      console.error('Order not found:', orderError);
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    // Fetch active webhook configs for this user subscribed to this event
    const { data: webhookConfigs, error: webhookError } = await supabase
      .from('webhook_configurations')
      .select('*')
      .eq('user_id', order.user_id)
      .eq('is_active', true)
      .contains('events', [event_type]);

    if (webhookError) {
      console.error('Error fetching webhook configs:', webhookError);
      return new Response(JSON.stringify({ error: 'Failed to fetch webhooks' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    if (!webhookConfigs || webhookConfigs.length === 0) {
      console.log('No active webhooks found for this event');
      return new Response(JSON.stringify({ message: 'No webhooks to trigger' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Build event payload
    const eventPayload = {
      event: event_type,
      timestamp: new Date().toISOString(),
      data: {
        id: order.id,
        tracking_number: order.tracking_number,
        customer_order_number: order.customer_order_number,
        status: order.status,
        sender: order.sender,
        receiver: order.receiver,
        bike_brand: order.bike_brand,
        bike_model: order.bike_model,
        bike_quantity: order.bike_quantity,
        scheduled_pickup_date: order.scheduled_pickup_date,
        scheduled_delivery_date: order.scheduled_delivery_date,
        created_at: order.created_at,
        updated_at: order.updated_at,
      },
    };

    console.log(`Sending webhooks to ${webhookConfigs.length} endpoints`);

    // Send webhooks to all configured endpoints
    const results = await Promise.all(
      webhookConfigs.map(async (config) => {
        const maxRetries = 3;
        let attempt = 0;
        let success = false;
        let responseStatus = 0;
        let responseBody = '';
        let deliveryDuration = 0;

        while (attempt < maxRetries && !success) {
          attempt++;
          const startTime = Date.now();

          try {
            // Generate HMAC signature
            const payloadString = JSON.stringify(eventPayload);
            const encoder = new TextEncoder();
            const keyData = encoder.encode(config.secret_hash);
            const dataToSign = encoder.encode(payloadString);
            
            const cryptoKey = await crypto.subtle.importKey(
              'raw',
              keyData,
              { name: 'HMAC', hash: 'SHA-256' },
              false,
              ['sign']
            );
            
            const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataToSign);
            const signatureHex = Array.from(new Uint8Array(signature))
              .map(b => b.toString(16).padStart(2, '0'))
              .join('');

            // Send webhook
            const webhookResponse = await fetch(config.endpoint_url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Webhook-Signature': signatureHex,
                'User-Agent': 'CycleCourier-Webhook/1.0',
              },
              body: payloadString,
              signal: AbortSignal.timeout(30000), // 30s timeout
            });

            deliveryDuration = Date.now() - startTime;
            responseStatus = webhookResponse.status;
            responseBody = await webhookResponse.text();

            success = webhookResponse.ok; // 2xx status codes

            if (!success && attempt < maxRetries) {
              // Exponential backoff: 1s, 2s, 4s
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
            }
          } catch (error) {
            deliveryDuration = Date.now() - startTime;
            responseBody = error instanceof Error ? error.message : 'Unknown error';
            console.error(`Webhook delivery attempt ${attempt} failed:`, error);
          }
        }

        // Log delivery attempt
        await supabase.from('webhook_delivery_logs').insert({
          webhook_config_id: config.id,
          order_id: order.id,
          event_type,
          payload: eventPayload,
          response_status: responseStatus,
          response_body: responseBody.substring(0, 5000), // Limit to 5000 chars
          delivery_duration_ms: deliveryDuration,
          attempt_number: attempt,
          success,
        });

        // Update webhook config
        await supabase
          .from('webhook_configurations')
          .update({
            last_triggered_at: new Date().toISOString(),
            last_delivery_status: success ? 'success' : 'failed',
            last_error_message: success ? null : responseBody.substring(0, 500),
          })
          .eq('id', config.id);

        return { config_id: config.id, success, attempts: attempt };
      })
    );

    console.log('Webhook delivery results:', results);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Webhook trigger error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
