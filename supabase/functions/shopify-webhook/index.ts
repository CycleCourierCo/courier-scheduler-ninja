import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-shopify-hmac-sha256, x-shopify-topic, x-shopify-shop-domain',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Helper function to verify Shopify webhook signature
async function verifyShopifyWebhook(body: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature) {
    console.log('No signature provided');
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const hash = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const hashArray = Array.from(new Uint8Array(hash));
  const calculatedSignature = btoa(String.fromCharCode(...hashArray));

  const providedSignature = signature.replace('sha256=', '');
  
  console.log('Calculated signature:', calculatedSignature);
  console.log('Provided signature:', providedSignature);
  
  return calculatedSignature === providedSignature;
}

// Helper function to add delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const shopifyWebhookSecret = Deno.env.get('SHOPIFY_WEBHOOK_SECRET')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the request body
    const body = await req.text();
    const signature = req.headers.get('x-shopify-hmac-sha256');
    const topic = req.headers.get('x-shopify-topic');

    console.log('Received Shopify webhook:', { topic, hasSignature: !!signature });

    // Verify webhook signature
    const isValid = await verifyShopifyWebhook(body, signature, shopifyWebhookSecret);
    if (!isValid) {
      console.log('Invalid webhook signature');
      return new Response('Unauthorized', { 
        status: 401, 
        headers: corsHeaders 
      });
    }

    // Only process order paid webhooks
    if (topic !== 'orders/paid') {
      console.log('Ignoring webhook topic:', topic);
      return new Response('OK', { 
        status: 200, 
        headers: corsHeaders 
      });
    }

    const shopifyOrder = JSON.parse(body);
    console.log('Processing Shopify order:', shopifyOrder.id);

    // Extract bike details from line items
    let bikeBrand = '';
    let bikeModel = '';
    
    if (shopifyOrder.line_items && shopifyOrder.line_items.length > 0) {
      const firstItem = shopifyOrder.line_items[0];
      // Extract from product title or variant title
      const productTitle = firstItem.title || firstItem.name || '';
      
      // Try to parse brand and model from title
      // Assuming format like "Brand Model" or just use the full title as model
      const titleParts = productTitle.split(' ');
      if (titleParts.length >= 2) {
        bikeBrand = titleParts[0];
        bikeModel = titleParts.slice(1).join(' ');
      } else {
        bikeModel = productTitle;
        bikeBrand = 'Shopify Order';
      }
    }

    // Map Shopify billing address to sender (collection)
    const billing = shopifyOrder.billing_address;
    const sender = {
      name: billing ? `${billing.first_name || ''} ${billing.last_name || ''}`.trim() : shopifyOrder.customer?.first_name + ' ' + shopifyOrder.customer?.last_name || 'Unknown',
      email: shopifyOrder.email || shopifyOrder.customer?.email || '',
      phone: billing?.phone || shopifyOrder.customer?.phone || '',
      address: {
        street: billing ? `${billing.address1 || ''} ${billing.address2 || ''}`.trim() : '',
        city: billing?.city || '',
        state: billing?.province || '',
        zip: billing?.zip || '',
        country: billing?.country || 'UK'
      }
    };

    // Map Shopify shipping address to receiver (delivery)
    const shipping = shopifyOrder.shipping_address;
    const receiver = {
      name: shipping ? `${shipping.first_name || ''} ${shipping.last_name || ''}`.trim() : sender.name,
      email: shopifyOrder.email || shopifyOrder.customer?.email || '',
      phone: shipping?.phone || billing?.phone || shopifyOrder.customer?.phone || '',
      address: {
        street: shipping ? `${shipping.address1 || ''} ${shipping.address2 || ''}`.trim() : sender.address.street,
        city: shipping?.city || '',
        state: shipping?.province || '',
        zip: shipping?.zip || '',
        country: shipping?.country || 'UK'
      }
    };

    // Create order in the system
    const orderData = {
      user_id: null, // This will be set by admin or system
      bike_brand: bikeBrand,
      bike_model: bikeModel,
      bike_quantity: shopifyOrder.line_items?.reduce((total: number, item: any) => total + (item.quantity || 1), 0) || 1,
      sender,
      receiver,
      status: 'created',
      customer_order_number: shopifyOrder.order_number?.toString() || shopifyOrder.id?.toString(),
      delivery_instructions: shopifyOrder.note || ''
    };

    console.log('Creating order with data:', orderData);

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      return new Response(JSON.stringify({ error: 'Failed to create order' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    console.log('Order created successfully:', order.id);

    // Send emails with delays to avoid rate limiting
    try {
      // 1. Order confirmation email (if we had a user)
      console.log('Sending order confirmation email...');
      await supabase.functions.invoke('send-email', {
        body: {
          to: [shopifyOrder.email],
          subject: 'Order Confirmation - The Cycle Courier Co.',
          html: `
            <h2>Order Confirmation - The Cycle Courier Co.</h2>
            <p>Thank you for your order! We've received your bicycle delivery request.</p>
            <p><strong>Order Details:</strong></p>
            <ul>
              <li>Order Number: ${order.customer_order_number}</li>
              <li>Bike: ${bikeBrand} ${bikeModel}</li>
              <li>Collection: ${sender.name} - ${sender.address.street}, ${sender.address.city}</li>
              <li>Delivery: ${receiver.name} - ${receiver.address.street}, ${receiver.address.city}</li>
            </ul>
            <p>We'll be in touch with both the sender and receiver to arrange collection and delivery dates.</p>
            <p>Best regards,<br>The Cycle Courier Co.</p>
          `
        }
      });

      // Wait 3 seconds to avoid rate limiting
      await delay(3000);

      // 2. Sender availability email
      console.log('Sending sender availability email...');
      await supabase.functions.invoke('send-email', {
        body: {
          to: [sender.email],
          subject: 'Bicycle Collection - Availability Confirmation Required',
          html: `
            <h2>Bicycle Collection - The Cycle Courier Co.</h2>
            <p>Hello ${sender.name},</p>
            <p>We've received a request to collect a bicycle from your address:</p>
            <p><strong>${sender.address.street}, ${sender.address.city}, ${sender.address.zip}</strong></p>
            <p>Please confirm your availability for collection by visiting the link below:</p>
            <p><a href="${supabaseUrl.replace('supabase.co', 'lovable.app')}/sender-availability?id=${order.id}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Confirm Availability</a></p>
            <p>If you have any questions, please don't hesitate to contact us.</p>
            <p>Best regards,<br>The Cycle Courier Co.</p>
          `
        }
      });

      // Wait another 3 seconds
      await delay(3000);

      // 3. Receiver notification email
      console.log('Sending receiver notification email...');
      await supabase.functions.invoke('send-email', {
        body: {
          to: [receiver.email],
          subject: 'Your Bicycle Delivery - The Cycle Courier Co.',
          html: `
            <h2>Your Bicycle Delivery - The Cycle Courier Co.</h2>
            <p>Hello ${receiver.name},</p>
            <p>A bicycle delivery has been arranged for you!</p>
            <p><strong>Delivery Details:</strong></p>
            <ul>
              <li>Bike: ${bikeBrand} ${bikeModel}</li>
              <li>Delivery Address: ${receiver.address.street}, ${receiver.address.city}, ${receiver.address.zip}</li>
              <li>From: ${sender.name}</li>
            </ul>
            <p>We'll contact you soon to arrange a convenient delivery time.</p>
            <p>If you have any questions, please contact us.</p>
            <p>Best regards,<br>The Cycle Courier Co.</p>
          `
        }
      });

      console.log('All emails sent successfully');

    } catch (emailError) {
      console.error('Error sending emails:', emailError);
      // Don't fail the webhook for email errors
    }

    return new Response(JSON.stringify({ 
      success: true, 
      orderId: order.id,
      message: 'Order created successfully' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Error processing Shopify webhook:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
};

serve(handler);