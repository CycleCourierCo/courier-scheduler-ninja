import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TimeslotRequest {
  orderId: string;
  recipientType: 'sender' | 'receiver';
  deliveryTime: string;
}

const serve_handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderId, recipientType, deliveryTime }: TimeslotRequest = await req.json();

    console.log(`Processing timeslot request for order ${orderId}, type: ${recipientType}, time: ${deliveryTime}`);

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('Order not found:', orderError);
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Order found:', order.id);

    // Extract contact information
    const contact = recipientType === 'sender' ? order.sender : order.receiver;
    const scheduledDate = recipientType === 'sender' ? order.scheduled_pickup_date : order.scheduled_delivery_date;

    if (!contact || !contact.phone) {
      console.error(`No phone number found for ${recipientType}`);
      return new Response(JSON.stringify({ error: `No phone number found for ${recipientType}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!scheduledDate) {
      console.error(`No scheduled date found for ${recipientType}`);
      return new Response(JSON.stringify({ error: `No scheduled date found for ${recipientType}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse the delivery time to create time windows
    const [deliveryHour, deliveryMinute] = deliveryTime.split(':').map(Number);
    
    // Create time window: 3 hours before the latest time
    const startHour = Math.max(0, deliveryHour - 3);
    const startTime = `${startHour.toString().padStart(2, '0')}:${deliveryMinute.toString().padStart(2, '0')}`;
    const endTime = `${deliveryHour.toString().padStart(2, '0')}:${deliveryMinute.toString().padStart(2, '0')}`;

    // Format scheduled date
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    // Create message based on recipient type
    let message: string;
    if (recipientType === 'sender') {
      message = `Dear ${contact.name},

Your ${order.bike_brand || 'bike'} ${order.bike_model || ''} Collection has been scheduled for ${formatDate(scheduledDate)} between ${startTime} and ${endTime}.

You will receive a text with a live tracking link once the driver is on his way.

Please ensure the pedals have been removed from the bike and in a bag along with any other accessories. Make sure the bag is attached to the bike securely to avoid any loss.

Thank you!
Cycle Courier Co.`;
    } else {
      message = `Dear ${contact.name},

Your ${order.bike_brand || 'bike'} ${order.bike_model || ''} Delivery has been scheduled for ${formatDate(scheduledDate)} between ${startTime} and ${endTime}.

You will receive a text with a live tracking link once the driver is on his way.

Thank you!
Cycle Courier Co.`;
    }

    console.log('Sending WhatsApp message via 2chat...');

    // Send WhatsApp message via 2chat API
    const twoChatApiKey = Deno.env.get('TWOCHAT_API_KEY');
    if (!twoChatApiKey) {
      console.error('2Chat API key not found');
      return new Response(JSON.stringify({ error: '2Chat API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Clean phone number (remove + and non-digits)
    const cleanPhone = contact.phone.replace(/[^\d]/g, '');
    
    // Get the from_number from environment variables
    const fromNumber = Deno.env.get('TWOCHAT_FROM_NUMBER');
    if (!fromNumber) {
      console.error('2Chat from_number not configured');
      return new Response(JSON.stringify({ error: '2Chat from_number not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const whatsappResponse = await fetch('https://api.p.2chat.io/open/whatsapp/send-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-API-Key': twoChatApiKey
      },
      body: JSON.stringify({
        to_number: `+${cleanPhone}`,
        from_number: fromNumber,
        text: message
      })
    });

    const whatsappResult = await whatsappResponse.json();
    console.log('2Chat API response:', whatsappResult);

    if (!whatsappResponse.ok) {
      console.error('Failed to send WhatsApp message:', whatsappResult);
      return new Response(JSON.stringify({ 
        error: 'Failed to send WhatsApp message',
        details: whatsappResult 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update Shipday order with delivery time if shipdayId exists
    const shipdayId = recipientType === 'sender' ? order.shipday_pickup_id : order.shipday_delivery_id;
    if (shipdayId) {
      console.log(`Updating Shipday order ${shipdayId} with delivery time...`);

      const shipdayApiKey = Deno.env.get('SHIPDAY_API_KEY');
      if (!shipdayApiKey) {
        console.error('Shipday API key not found');
        // Continue anyway, WhatsApp was sent successfully
      } else {
        try {
          const shipdayResponse = await fetch(`https://api.shipday.com/orders/${shipdayId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${btoa(shipdayApiKey + ':')}`
            },
            body: JSON.stringify({
              expectedDeliveryDate: scheduledDate.split('T')[0],
              deliveryEndTime: endTime
            })
          });

          console.log('Shipday response status:', shipdayResponse.status);
          console.log('Shipday response headers:', Object.fromEntries(shipdayResponse.headers));

          // Handle different response types
          let shipdayResult;
          const contentType = shipdayResponse.headers.get('content-type');
          
          if (contentType && contentType.includes('application/json')) {
            // Only try to parse JSON if content-type indicates JSON
            const responseText = await shipdayResponse.text();
            if (responseText.trim()) {
              try {
                shipdayResult = JSON.parse(responseText);
              } catch (parseError) {
                console.error('Failed to parse Shipday JSON response:', responseText);
                shipdayResult = { error: 'Invalid JSON response', responseText };
              }
            } else {
              shipdayResult = { message: 'Empty response from Shipday' };
            }
          } else {
            // Handle non-JSON responses
            const responseText = await shipdayResponse.text();
            shipdayResult = { message: 'Non-JSON response', responseText };
          }

          console.log('Shipday update response:', shipdayResult);

          if (!shipdayResponse.ok) {
            console.error('Failed to update Shipday order:', shipdayResult);
            // Continue anyway, WhatsApp was sent successfully
          }
        } catch (shipdayError) {
          console.error('Error updating Shipday order:', shipdayError);
          // Continue anyway, WhatsApp was sent successfully
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Timeslot sent successfully',
      whatsappResult
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in send-timeslot-whatsapp function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

serve(serve_handler);