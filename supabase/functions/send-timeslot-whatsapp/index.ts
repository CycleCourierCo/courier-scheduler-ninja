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

    // Format scheduled date (local timezone)
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth();
      const day = date.getUTCDate();
      const localDate = new Date(year, month, day);
      return localDate.toLocaleDateString('en-GB', {
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

    // OPERATION 1: Send WhatsApp message via 2chat API (independent operation)
    let whatsappResult: any = { success: false };
    try {
      console.log('--- Starting WhatsApp operation ---');
      const twoChatApiKey = Deno.env.get('TWOCHAT_API_KEY');
      const fromNumber = Deno.env.get('TWOCHAT_FROM_NUMBER');
      
      if (!twoChatApiKey || !fromNumber) {
        throw new Error('2Chat API credentials not configured');
      }

      const cleanPhone = contact.phone.replace(/[^\d]/g, '');
      
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

      // Check content type before parsing
      const contentType = whatsappResponse.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        try {
          const jsonData = await whatsappResponse.json();
          whatsappResult = {
            success: whatsappResponse.ok,
            data: jsonData
          };
          console.log('WhatsApp API response:', jsonData);
        } catch (parseError) {
          whatsappResult = {
            success: false,
            error: 'Failed to parse WhatsApp API response'
          };
          console.error('JSON parse error:', parseError);
        }
      } else {
        // API returned HTML or other non-JSON response
        const errorText = await whatsappResponse.text();
        whatsappResult = {
          success: false,
          error: 'WhatsApp API returned unexpected response (likely authentication error)',
          details: errorText.substring(0, 200)
        };
        console.error('WhatsApp API returned non-JSON:', errorText.substring(0, 500));
      }
    } catch (whatsappError: any) {
      whatsappResult = {
        success: false,
        error: whatsappError.message || 'Failed to send WhatsApp message'
      };
      console.error('WhatsApp operation error:', whatsappError);
    }
    console.log('WhatsApp operation result:', whatsappResult.success ? 'SUCCESS' : 'FAILED');

    // OPERATION 2: Update Shipday order (independent operation)
    let shipdayResult: any = { success: false, orders: [] };
    try {
      console.log('--- Starting Shipday operation ---');
      const shipdayApiKey = Deno.env.get('SHIPDAY_API_KEY');
      
      if (!shipdayApiKey) {
        throw new Error('Shipday API key not configured');
      }
      
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
          console.log(`No Shipday ID found for order ${orderToUpdate.id} - skipping`);
          shipdayResults.push({ orderId: orderToUpdate.id, status: 'no_shipday_id' });
          continue;
        }
        
        try {
          const shipdayUrl = `https://api.shipday.com/order/edit/${shipdayId}`;
          
          // Parse the start time
          const [deliveryHour, deliveryMinute] = deliveryTime.split(':').map(Number);
          
          // Expected pickup time is the start of the timeslot
          const expectedPickupTime = `${deliveryHour.toString().padStart(2, '0')}:${deliveryMinute.toString().padStart(2, '0')}:00`;
          
          // Expected delivery time is 3 hours after start (end of timeslot)
          const endHour = deliveryHour + 3;
          const expectedDeliveryTime = `${endHour.toString().padStart(2, '0')}:${deliveryMinute.toString().padStart(2, '0')}:00`;
          
          console.log('Shipday time details:', {
            originalTime: deliveryTime,
            expectedPickupTime,
            expectedDeliveryTime
          });
          
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
          expectedPickupTime: expectedPickupTime,
          expectedDeliveryTime: expectedDeliveryTime,
          expectedDeliveryDate: new Date(scheduledDate).toISOString().split('T')[0],
          deliveryInstruction: allInstructions
        };

          const shipdayResponse = await fetch(shipdayUrl, {
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
            console.log(`Shipday update failed for order ${orderToUpdate.id}: ${responseText}`);
            shipdayResults.push({ orderId: orderToUpdate.id, status: 'failed', error: responseText });
          }
        } catch (orderError) {
          console.log(`Error updating Shipday order for ${orderToUpdate.id}:`, orderError);
          shipdayResults.push({ 
            orderId: orderToUpdate.id, 
            status: 'error', 
            error: orderError instanceof Error ? orderError.message : 'Unknown error' 
          });
        }
      }
      
      shipdayResult = {
        success: shipdayResults.some(r => r.status === 'success'),
        orders: shipdayResults,
        allSuccessful: shipdayResults.every(r => r.status === 'success')
      };
      
      console.log('Shipday operation results:', shipdayResults);
    } catch (shipdayError: any) {
      shipdayResult = {
        success: false,
        error: shipdayError.message || 'Failed to update Shipday'
      };
      console.error('Shipday operation error:', shipdayError);
    }
    console.log('Shipday operation result:', shipdayResult.success ? 'SUCCESS' : 'FAILED');

    // OPERATION 3: Send email notification (independent operation)
    let emailResult: any = { success: false };
    try {
      console.log('--- Starting Email operation ---');
      
      if (!resend) {
        throw new Error('Email service not configured');
      }
      
      if (!contact.email) {
        throw new Error('No email address found for recipient');
      }
      
      console.log(`Sending email to ${contact.email}...`);
      
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

      const emailData = await resend.emails.send({
        from: "Ccc@notification.cyclecourierco.com",
        to: [contact.email],
        subject: emailSubject,
        html: emailHtml
      });
      
      emailResult = {
        success: true,
        data: emailData
      };
      console.log('Email sent successfully:', emailData);
    } catch (emailError: any) {
      emailResult = {
        success: false,
        error: emailError.message || 'Failed to send email'
      };
      console.error('Email operation error:', emailError);
    }
    console.log('Email operation result:', emailResult.success ? 'SUCCESS' : 'FAILED');

    // Return comprehensive status for all operations
    const overallSuccess = whatsappResult.success || shipdayResult.success || emailResult.success;
    
    return new Response(JSON.stringify({ 
      success: overallSuccess,
      results: {
        whatsapp: whatsappResult,
        shipday: shipdayResult,
        email: emailResult
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Unexpected error in send-timeslot-whatsapp function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message || 'Unexpected error occurred',
      details: error 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

serve(serve_handler);
