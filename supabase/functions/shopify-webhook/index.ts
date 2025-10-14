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

// Helper function to get property value from line item properties
function getPropertyValue(properties: any[], name: string): string {
  const prop = properties?.find((p: any) => p.name === name);
  return prop?.value || '';
}

// Helper function to parse address string (e.g., "339 haunch Lane, Birmingham, b130pl")
function parseAddress(addressStr: string): { street: string; city: string; zipCode: string } {
  const parts = addressStr.split(',').map(p => p.trim());
  
  if (parts.length >= 3) {
    return {
      street: parts[0],
      city: parts[1],
      zipCode: parts[2]
    };
  } else if (parts.length === 2) {
    return {
      street: parts[0],
      city: parts[1],
      zipCode: ''
    };
  } else {
    return {
      street: addressStr,
      city: '',
      zipCode: ''
    };
  }
}

// Helper function to format UK phone numbers to +44 format
function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  
  // Remove all spaces and special characters
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  
  // If it starts with 07, convert to +447
  if (cleaned.startsWith('07')) {
    return '+44' + cleaned.substring(1);
  }
  
  // If it starts with 447, add +
  if (cleaned.startsWith('447')) {
    return '+' + cleaned;
  }
  
  // If it already starts with +44, return as is
  if (cleaned.startsWith('+44')) {
    return cleaned;
  }
  
  // Otherwise return as is
  return phone;
}

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

    // Extract properties from line items (added by Easify app)
    let bikeBrand = '';
    let bikeModel = '';
    let sender: any;
    let receiver: any;
    let bikeQuantity = 1;
    
    if (shopifyOrder.line_items && shopifyOrder.line_items.length > 0) {
      const firstItem = shopifyOrder.line_items[0];
      const properties = firstItem.properties || [];
      
      console.log('Extracting data from line item properties...');
      
      // Extract bike brand and model from "Bike Brand and Model" property
      const bikeBrandAndModel = getPropertyValue(properties, 'Bike Brand and Model');
      if (bikeBrandAndModel) {
        // Split on space - first part is brand, rest is model
        const parts = bikeBrandAndModel.split(' ');
        bikeBrand = parts[0] || '';
        bikeModel = parts.slice(1).join(' ') || '';
        console.log('Parsed bike:', { bikeBrand, bikeModel });
      } else {
        // Fallback to product title
        bikeBrand = firstItem.title || 'Collection';
        bikeModel = firstItem.variant_title || 'and Delivery within England and Wales';
      }
      
      // Get bike quantity
      bikeQuantity = firstItem.quantity || 1;
      
      // Extract collection (sender) details from properties
      const collectionName = getPropertyValue(properties, 'Collection Name');
      const collectionEmail = getPropertyValue(properties, 'Collection Email');
      const collectionPhone = getPropertyValue(properties, 'Collection Mobile Number');
      const collectionAddressStr = getPropertyValue(properties, 'Collection Address');
      
      // Parse collection address
      const collectionAddress = parseAddress(collectionAddressStr);
      
      sender = {
        name: collectionName || shopifyOrder.billing_address?.name || 'Unknown',
        email: collectionEmail || shopifyOrder.email || '',
        phone: formatPhoneNumber(collectionPhone) || '',
        address: {
          street: collectionAddress.street,
          city: collectionAddress.city,
          state: shopifyOrder.billing_address?.province || 'England',
          zip: collectionAddress.zipCode,
          country: shopifyOrder.billing_address?.country || 'United Kingdom'
        }
      };
      
      console.log('Parsed sender:', sender);
      
      // Extract delivery (receiver) details from properties
      const deliveryName = getPropertyValue(properties, 'Delivery Name');
      const deliveryEmail = getPropertyValue(properties, 'Delivery Email');
      const deliveryPhone = getPropertyValue(properties, 'Delivery Mobile Number');
      const deliveryAddressStr = getPropertyValue(properties, 'Delivery Address');
      
      // Parse delivery address
      const deliveryAddress = parseAddress(deliveryAddressStr);
      
      receiver = {
        name: deliveryName || sender.name,
        email: deliveryEmail || sender.email,
        phone: formatPhoneNumber(deliveryPhone) || sender.phone,
        address: {
          street: deliveryAddress.street,
          city: deliveryAddress.city,
          state: deliveryAddress.city ? '' : '',  // State is usually not provided in Easify
          zip: deliveryAddress.zipCode,
          country: 'UK'
        }
      };
      
      console.log('Parsed receiver:', receiver);
      
    } else {
      // Fallback to billing/shipping addresses if no line items
      console.log('No line items found, using billing/shipping addresses as fallback');
      
      const billing = shopifyOrder.billing_address;
      sender = {
        name: billing ? `${billing.first_name || ''} ${billing.last_name || ''}`.trim() : 'Unknown',
        email: shopifyOrder.email || '',
        phone: billing?.phone || '',
        address: {
          street: billing ? `${billing.address1 || ''} ${billing.address2 || ''}`.trim() : '',
          city: billing?.city || '',
          state: billing?.province || '',
          zip: billing?.zip || '',
          country: billing?.country || 'UK'
        }
      };
      
      const shipping = shopifyOrder.shipping_address;
      receiver = {
        name: shipping ? `${shipping.first_name || ''} ${shipping.last_name || ''}`.trim() : sender.name,
        email: shopifyOrder.email || '',
        phone: shipping?.phone || sender.phone,
        address: {
          street: shipping ? `${shipping.address1 || ''} ${shipping.address2 || ''}`.trim() : sender.address.street,
          city: shipping?.city || '',
          state: shipping?.province || '',
          zip: shipping?.zip || '',
          country: shipping?.country || 'UK'
        }
      };
      
      bikeBrand = 'Collection';
      bikeModel = 'and Delivery within England and Wales';
    }

    // Create order in the system
    const orderData = {
      user_id: '5ac789cc-2e89-470f-b13a-9476246810df', // Shopify webhook orders user
      bike_brand: bikeBrand,
      bike_model: bikeModel,
      bike_quantity: bikeQuantity,
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