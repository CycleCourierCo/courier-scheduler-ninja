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
    console.log('Raw Shopify order data:', JSON.stringify(shopifyOrder, null, 2));

    // Get the API key for calling the Orders API
    const ordersApiKey = Deno.env.get('SHOPIFY_ORDERS_API_KEY');
    if (!ordersApiKey) {
      console.error('SHOPIFY_ORDERS_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

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

    // Prepare data for Orders API
    const ordersApiBody = {
      sender: {
        name: sender.name,
        email: sender.email,
        phone: sender.phone,
        address: {
          street: sender.address.street,
          city: sender.address.city,
          state: sender.address.state,
          zipCode: sender.address.zip,
          country: sender.address.country
        }
      },
      receiver: {
        name: receiver.name,
        email: receiver.email,
        phone: receiver.phone,
        address: {
          street: receiver.address.street,
          city: receiver.address.city,
          state: receiver.address.state,
          zipCode: receiver.address.zip,
          country: receiver.address.country
        }
      },
      bikes: [
        {
          brand: bikeBrand,
          model: bikeModel
        }
      ],
      bikeQuantity: bikeQuantity,
      customerOrderNumber: shopifyOrder.order_number?.toString() || shopifyOrder.id?.toString(),
      deliveryInstructions: shopifyOrder.note || ''
    };

    console.log('Calling Orders API with data:', JSON.stringify(ordersApiBody, null, 2));

    // Call the Orders API edge function
    try {
      const ordersApiResponse = await fetch(`${supabaseUrl}/functions/v1/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': ordersApiKey,
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify(ordersApiBody)
      });

      const responseData = await ordersApiResponse.json();

      if (!ordersApiResponse.ok) {
        console.error('Orders API error:', responseData);
        return new Response(JSON.stringify({ 
          error: 'Failed to create order via API',
          details: responseData
        }), {
          status: ordersApiResponse.status,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      console.log('Order created successfully via Orders API:', responseData);

      return new Response(JSON.stringify({ 
        success: true, 
        order: responseData,
        message: 'Order created successfully via Orders API (includes tracking number, emails, and Shipday jobs)' 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (apiError) {
      console.error('Error calling Orders API:', apiError);
      return new Response(JSON.stringify({ 
        error: 'Failed to call Orders API',
        message: apiError instanceof Error ? apiError.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

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