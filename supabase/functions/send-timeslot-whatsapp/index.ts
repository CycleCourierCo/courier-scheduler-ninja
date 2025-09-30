import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TimeslotRequest {
  orderId: string;
  recipientType: 'sender' | 'receiver';
  deliveryTime: string;
  customMessage?: string; // Optional custom message for grouped locations
  relatedOrderIds?: string[]; // Optional array of related order IDs for consolidated messages
}

const serve_handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderId, recipientType, deliveryTime, customMessage, relatedOrderIds }: TimeslotRequest = await req.json();

    console.log(`Processing timeslot request for order ${orderId}, type: ${recipientType}, time: ${deliveryTime}`);
    if (relatedOrderIds && relatedOrderIds.length > 0) {
      console.log(`Also processing ${relatedOrderIds.length} related orders for consolidated message`);
    }

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
    
    // Create time window: original time + 3 hours (corrected from previous -3 hours bug)
    const endHour = Math.min(23, deliveryHour + 3);
    const startTime = `${deliveryHour.toString().padStart(2, '0')}:${deliveryMinute.toString().padStart(2, '0')}`;
    const endTime = `${endHour.toString().padStart(2, '0')}:${deliveryMinute.toString().padStart(2, '0')}`;
    
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

    // Create message based on recipient type or use custom message
    let message: string;
    if (customMessage) {
      // Use the provided custom message (for grouped deliveries/collections)
      message = customMessage;
    } else if (recipientType === 'sender') {
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

    // Update Shipday order with delivery time - handle both primary and related orders
    let shipdayResponse = null;
    const shipdayApiKey = Deno.env.get('SHIPDAY_API_KEY');
    
    // Collect all orders that need Shipday updates (primary + related)
    const ordersToUpdate = [order];
    if (relatedOrderIds && relatedOrderIds.length > 0) {
      console.log(`Fetching ${relatedOrderIds.length} related orders for Shipday updates...`);
      for (const relatedId of relatedOrderIds) {
        const { data: relatedOrder, error: relatedError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', relatedId)
          .single();
        
        if (!relatedError && relatedOrder) {
          ordersToUpdate.push(relatedOrder);
        } else {
          console.error(`Failed to fetch related order ${relatedId}:`, relatedError);
        }
      }
    }
    
    console.log(`Updating Shipday for ${ordersToUpdate.length} order(s)...`);
    
    // Update Shipday for each order
    const shipdayResults: any[] = [];
    for (const orderToUpdate of ordersToUpdate) {
      const shipdayId = recipientType === 'sender' ? orderToUpdate.shipday_pickup_id : orderToUpdate.shipday_delivery_id;
      
      if (!shipdayId) {
        console.log(`No Shipday ID found for order ${orderToUpdate.id} - skipping Shipday update`);
        shipdayResults.push({ orderId: orderToUpdate.id, status: 'no_shipday_id' });
        continue;
      }
      
      if (!shipdayApiKey) {
        console.log(`Shipday API key not found - skipping Shipday update for order ${orderToUpdate.id}`);
        shipdayResults.push({ orderId: orderToUpdate.id, status: 'no_api_key' });
        continue;
      }
      
      console.log(`Updating Shipday order ${shipdayId} for order ${orderToUpdate.id}...`);
      
      try {
        const shipdayUrl = `https://api.shipday.com/order/edit/${shipdayId}`;
        
        // Convert user's local time to UTC for Shipday
        const [deliveryHour, deliveryMinute] = deliveryTime.split(':').map(Number);
        const endHour = Math.min(23, deliveryHour + 3);
        const ukTimezoneOffset = new Date().getTimezoneOffset() === 0 ? 1 : 0;
        const adjustedHour = endHour - ukTimezoneOffset;
        const adjustedEndTime = `${adjustedHour.toString().padStart(2, '0')}:${deliveryMinute.toString().padStart(2, '0')}`;
        const expectedDeliveryTime = adjustedEndTime.includes(':') && adjustedEndTime.split(':').length === 2 
          ? `${adjustedEndTime}:00` 
          : adjustedEndTime;
        
        // Build delivery instructions
        const bikeInfo = orderToUpdate.bike_brand && orderToUpdate.bike_model 
          ? `Bike: ${orderToUpdate.bike_brand} ${orderToUpdate.bike_model}` 
          : orderToUpdate.bike_brand 
            ? `Bike: ${orderToUpdate.bike_brand}` 
            : orderToUpdate.bike_model 
              ? `Bike: ${orderToUpdate.bike_model}` 
              : '';

        const orderDetails = [];
        if (bikeInfo) orderDetails.push(bikeInfo);
        if (orderToUpdate.customer_order_number) orderDetails.push(`Order #: ${orderToUpdate.customer_order_number}`);
        if (orderToUpdate.collection_code) orderDetails.push(`eBay Code: ${orderToUpdate.collection_code}`);
        if (orderToUpdate.needs_payment_on_collection) orderDetails.push('Payment required on collection');
        if (orderToUpdate.is_ebay_order) orderDetails.push('eBay Order');
        if (orderToUpdate.is_bike_swap) orderDetails.push('Bike Swap');
        
        const baseDeliveryInstructions = orderToUpdate.delivery_instructions || '';
        const contextNotes = recipientType === 'sender' ? orderToUpdate.sender_notes : orderToUpdate.receiver_notes;
        
        const allInstructions = [
          ...orderDetails,
          baseDeliveryInstructions,
          contextNotes
        ].filter(Boolean).join(' | ');

        const requestBody = {
          orderNumber: orderToUpdate.tracking_number || `${orderToUpdate.id.substring(0, 8)}-UPDATE`,
          customerName: recipientType === 'sender' ? orderToUpdate.sender.name : orderToUpdate.receiver.name,
          customerAddress: recipientType === 'sender' 
            ? `${orderToUpdate.sender.address.street}, ${orderToUpdate.sender.address.city}, ${orderToUpdate.sender.address.state} ${orderToUpdate.sender.address.zipCode}`
            : `${orderToUpdate.receiver.address.street}, ${orderToUpdate.receiver.address.city}, ${orderToUpdate.receiver.address.state} ${orderToUpdate.receiver.address.zipCode}`,
          customerEmail: recipientType === 'sender' ? orderToUpdate.sender.email : orderToUpdate.receiver.email,
          customerPhoneNumber: recipientType === 'sender' ? orderToUpdate.sender.phone : orderToUpdate.receiver.phone,
          restaurantName: "Cycle Courier Co.",
          restaurantAddress: "Lawden road, birmingham, b100ad, united kingdom",
          expectedDeliveryTime: expectedDeliveryTime,
          expectedDeliveryDate: new Date(scheduledDate).toISOString().split('T')[0],
          deliveryInstruction: allInstructions
        };

        shipdayResponse = await fetch(shipdayUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${shipdayApiKey}`
          },
          body: JSON.stringify(requestBody)
        });

        if (shipdayResponse.ok) {
          console.log(`Shipday order ${shipdayId} updated successfully for order ${orderToUpdate.id}`);
          shipdayResults.push({ orderId: orderToUpdate.id, status: 'success', shipdayId });
        } else {
          const responseText = await shipdayResponse.text();
          console.log(`Shipday update failed for order ${orderToUpdate.id} with status ${shipdayResponse.status}: ${responseText}`);
          shipdayResults.push({ orderId: orderToUpdate.id, status: 'failed', error: responseText });
        }
      } catch (shipdayError) {
        console.log(`Error updating Shipday order for ${orderToUpdate.id} (non-critical):`, shipdayError);
        shipdayResults.push({ orderId: orderToUpdate.id, status: 'error', error: shipdayError instanceof Error ? shipdayError.message : 'Unknown error' });
      }
    }
    
    console.log(`Shipday update results:`, shipdayResults);

    // Send email notification
    let emailResult = null;
    if (resend && contact.email) {
      console.log(`Sending email to ${contact.email}...`);
      
      try {
        const emailSubject = customMessage 
          ? "Your Bike Deliveries and Collections have been Scheduled"
          : recipientType === 'sender' 
            ? `Your ${order.bike_brand || 'bike'} collection has been scheduled - ${order.tracking_number}`
            : `Your ${order.bike_brand || 'bike'} delivery has been scheduled - ${order.tracking_number}`;

        let emailHtml: string;
        
        if (customMessage) {
          // For grouped messages, format the custom message with proper styling
          const lines = customMessage.split('\n\n');
          let emailContent = '';
          let hasCollections = customMessage.includes('Collections:');
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith('Dear ')) {
              emailContent += `<h2>${line}</h2>\n`;
            } else if (line.includes('We are due to be with you')) {
              emailContent += `<p>${line}</p>\n`;
            } else if (line.includes('Deliveries:') || line.includes('Collections:')) {
              emailContent += `<p><strong>${line}</strong></p>\n`;
            } else if (line.includes('You will receive a text')) {
              emailContent += `<p>${line}</p>\n`;
              
              // Add collection instructions right after tracking message if there are collections
              if (hasCollections) {
                emailContent += `
                  <div style="border-left: 4px solid #ffa500; padding-left: 16px; margin: 20px 0; background-color: #fff8f0; padding: 16px; border-radius: 4px;">
                    <p style="margin: 0 0 10px 0; font-weight: bold; color: #e67e22;">📦 Collection Instructions</p>
                    <ul style="margin: 0; padding-left: 20px; color: #2c3e50;">
                      <li style="margin-bottom: 8px;">Please ensure the pedals have been removed from the bikes we are collecting and placed in a secure bag</li>
                      <li style="margin-bottom: 8px;">Any other accessories should also be placed in the bag</li>
                      <li style="margin-bottom: 0;">Make sure the bag is securely attached to the bike to avoid any loss</li>
                    </ul>
                  </div>
                `;
              }
            } else if (line.includes('Please ensure the pedals')) {
              // Skip the original collection instructions text as we've replaced it with formatted version
              continue;
            } else if (line === 'Thank you!') {
              emailContent += `<p style="margin-top: 30px; font-weight: bold;">${line}</p>\n`;
            } else if (line === 'Cycle Courier Co.') {
              emailContent += `<p style="margin-top: 10px;"><strong>${line}</strong></p>\n`;
            } else if (line) {
              emailContent += `<p>${line}</p>\n`;
            }
          }
            
          emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px;">
              ${emailContent}
            </div>
          `;
        } else {
          // Single job message format
          emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Dear ${contact.name},</h2>
              
              <p>Your <strong>${order.bike_brand || 'bike'} ${order.bike_model || ''}</strong> ${recipientType === 'sender' ? 'Collection' : 'Delivery'} has been scheduled for:</p>
              
              <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; font-size: 18px;"><strong>${formatDate(scheduledDate)}</strong></p>
                <p style="margin: 5px 0; font-size: 16px;">Between <strong>${startTime}</strong> and <strong>${endTime}</strong></p>
              </div>
              
              <p>You will receive a text with a live tracking link once the driver is on their way.</p>
              
              ${recipientType === 'sender' ? `
                <div style="border-left: 4px solid #ffa500; padding-left: 16px; margin: 20px 0; background-color: #fff8f0; padding: 16px; border-radius: 4px;">
                  <p style="margin: 0 0 10px 0; font-weight: bold; color: #e67e22;">📦 Collection Instructions</p>
                  <ul style="margin: 0; padding-left: 20px; color: #2c3e50;">
                    <li style="margin-bottom: 8px;">Please ensure the pedals have been removed from the bike and placed in a secure bag</li>
                    <li style="margin-bottom: 8px;">Any other accessories should also be placed in the bag</li>
                    <li style="margin-bottom: 0;">Make sure the bag is securely attached to the bike to avoid any loss</li>
                  </ul>
                </div>
              ` : ''}
              
              <p style="margin-top: 30px;">Thank you!</p>
              <p><strong>Cycle Courier Co.</strong></p>
            </div>
          `;
        }

        emailResult = await resend.emails.send({
          from: "Ccc@notification.cyclecourierco.com",
          to: [contact.email],
          subject: emailSubject,
          html: emailHtml
        });

        console.log('Email sent successfully:', emailResult);
      } catch (emailError) {
        console.error('Error sending email (non-critical):', emailError);
        emailResult = { error: emailError instanceof Error ? emailError.message : 'Unknown email error' };
      }
    } else {
      console.log(resend ? 'No email address found - skipping email' : 'Resend not configured - skipping email');
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Timeslot sent successfully',
      whatsappResult,
      emailResult,
      shipdayResults: shipdayResults // Array of results for all orders updated
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