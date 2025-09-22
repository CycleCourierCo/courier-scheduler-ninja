import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";

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
    
    console.log(`Original deliveryTime: ${deliveryTime}`);
    console.log(`Parsed hour: ${deliveryHour}, minute: ${deliveryMinute}`);
    console.log(`Time window: ${startTime} to ${endTime}`);

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

    // Initialize Resend for email
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const resend = resendApiKey ? new Resend(resendApiKey) : null;

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
    let shipdayResponse = null;
    const shipdayId = recipientType === 'sender' ? order.shipday_pickup_id : order.shipday_delivery_id;
    if (shipdayId) {
      console.log(`Updating Shipday order ${shipdayId} with delivery time...`);

      const shipdayApiKey = Deno.env.get('SHIPDAY_API_KEY');
      if (!shipdayApiKey) {
        console.log('Shipday API key not found - skipping Shipday update');
      } else {
        try {
          // Use the correct Shipday API endpoint and match the create-shipday-order schema
          const shipdayUrl = `https://api.shipday.com/order/edit/${shipdayId}`;
          console.log('Shipday URL:', shipdayUrl);
          
          // Convert user's local time to UTC for Shipday
          // Assuming UK timezone (UTC+0 in winter, UTC+1 in summer)
          const ukTimezoneOffset = new Date().getTimezoneOffset() === 0 ? 1 : 0; // 1 hour ahead if server is UTC
          const adjustedHour = deliveryHour - ukTimezoneOffset;
          const adjustedEndTime = `${adjustedHour.toString().padStart(2, '0')}:${deliveryMinute.toString().padStart(2, '0')}`;
          
          const expectedDeliveryTime = adjustedEndTime.includes(':') && adjustedEndTime.split(':').length === 2 
            ? `${adjustedEndTime}:00` 
            : adjustedEndTime;
          
          console.log(`User selected time: ${deliveryTime}`);
          console.log(`Server timezone offset: ${new Date().getTimezoneOffset()} minutes`);
          console.log(`UK timezone adjustment: -${ukTimezoneOffset} hours`);
          console.log(`Adjusted time for Shipday: ${expectedDeliveryTime}`);
          console.log(`Scheduled date: ${scheduledDate}`);
          
          // Use the same comprehensive schema as create-shipday-order function
          // Build comprehensive delivery instructions with all order details
          const bikeInfo = order.bike_brand && order.bike_model 
            ? `Bike: ${order.bike_brand} ${order.bike_model}` 
            : order.bike_brand 
              ? `Bike: ${order.bike_brand}` 
              : order.bike_model 
                ? `Bike: ${order.bike_model}` 
                : '';

          const orderDetails = [];
          if (bikeInfo) orderDetails.push(bikeInfo);
          if (order.customer_order_number) orderDetails.push(`Order #: ${order.customer_order_number}`);
          if (order.collection_code) orderDetails.push(`eBay Code: ${order.collection_code}`);
          if (order.needs_payment_on_collection) orderDetails.push('Payment required on collection');
          if (order.is_ebay_order) orderDetails.push('eBay Order');
          if (order.is_bike_swap) orderDetails.push('Bike Swap');
          
          const baseDeliveryInstructions = order.delivery_instructions || '';
          const contextNotes = recipientType === 'sender' ? order.sender_notes : order.receiver_notes;
          
          const allInstructions = [
            ...orderDetails,
            baseDeliveryInstructions,
            contextNotes
          ].filter(Boolean).join(' | ');

          const requestBody = {
            orderNumber: order.tracking_number || `${orderId.substring(0, 8)}-UPDATE`,
            customerName: recipientType === 'sender' ? order.sender.name : order.receiver.name,
            customerAddress: recipientType === 'sender' 
              ? `${order.sender.address.street}, ${order.sender.address.city}, ${order.sender.address.state} ${order.sender.address.zipCode}`
              : `${order.receiver.address.street}, ${order.receiver.address.city}, ${order.receiver.address.state} ${order.receiver.address.zipCode}`,
            customerEmail: recipientType === 'sender' ? order.sender.email : order.receiver.email,
            customerPhoneNumber: recipientType === 'sender' ? order.sender.phone : order.receiver.phone,
            restaurantName: "Cycle Courier Co.",
            restaurantAddress: "Lawden road, birmingham, b100ad, united kingdom",
            expectedDeliveryTime: expectedDeliveryTime,
            expectedDeliveryDate: new Date(scheduledDate).toISOString().split('T')[0],
            deliveryInstruction: allInstructions
          };
          console.log('Shipday request body:', requestBody);

          shipdayResponse = await fetch(shipdayUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${shipdayApiKey}`
            },
            body: JSON.stringify(requestBody)
          });

          console.log('Shipday response status:', shipdayResponse.status);
          console.log('Shipday response status text:', shipdayResponse.statusText);

          if (shipdayResponse.ok) {
            console.log('Shipday order updated successfully');
          } else {
            console.log(`Shipday update failed with status ${shipdayResponse.status}: ${shipdayResponse.statusText}`);
            // Try to get response text for debugging
            const responseText = await shipdayResponse.text();
            console.log('Shipday error response:', responseText);
          }
        } catch (shipdayError) {
          console.log('Error updating Shipday order (non-critical):', shipdayError);
          // Don't fail the entire function for Shipday errors
        }
      }
    } else {
      console.log('No Shipday ID found - skipping Shipday update');
    }

    // Send email notification
    let emailResult = null;
    if (resend && contact.email) {
      console.log(`Sending email to ${contact.email}...`);
      
      try {
        const emailSubject = recipientType === 'sender' 
          ? `Your ${order.bike_brand || 'bike'} collection has been scheduled - ${order.tracking_number}`
          : `Your ${order.bike_brand || 'bike'} delivery has been scheduled - ${order.tracking_number}`;

        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Dear ${contact.name},</h2>
            
            <p>Your <strong>${order.bike_brand || 'bike'} ${order.bike_model || ''}</strong> ${recipientType === 'sender' ? 'Collection' : 'Delivery'} has been scheduled for:</p>
            
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; font-size: 18px;"><strong>${formatDate(scheduledDate)}</strong></p>
              <p style="margin: 5px 0; font-size: 16px;">Between <strong>${startTime}</strong> and <strong>${endTime}</strong></p>
            </div>
            
            <p>You will receive a text with a live tracking link once the driver is on their way.</p>
            
            ${recipientType === 'sender' ? `
              <div style="border-left: 4px solid #ffa500; padding-left: 16px; margin: 20px 0;">
                <p><strong>Collection Instructions:</strong></p>
                <ul>
                  <li>Please ensure the pedals have been removed from the bike and placed in a bag</li>
                  <li>Any other accessories should also be in the bag</li>
                  <li>Make sure the bag is attached to the bike securely to avoid any loss</li>
                </ul>
              </div>
            ` : ''}
            
            <p style="margin-top: 30px;">Thank you!</p>
            <p><strong>Cycle Courier Co.</strong></p>
          </div>
        `;

        emailResult = await resend.emails.send({
          from: "Ccc@notification.cyclecourierco.com",
          to: [contact.email],
          subject: emailSubject,
          html: emailHtml
        });

        console.log('Email sent successfully:', emailResult);
      } catch (emailError) {
        console.error('Error sending email (non-critical):', emailError);
        emailResult = { error: emailError.message };
      }
    } else {
      console.log(resend ? 'No email address found - skipping email' : 'Resend not configured - skipping email');
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Timeslot sent successfully',
      whatsappResult,
      emailResult,
      shipdayStatus: shipdayId ? (shipdayResponse?.ok ? 'updated' : 'failed') : 'no_shipday_id',
      shipdayError: shipdayId && !shipdayResponse?.ok ? `Status ${shipdayResponse?.status}: ${shipdayResponse?.statusText}` : null
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