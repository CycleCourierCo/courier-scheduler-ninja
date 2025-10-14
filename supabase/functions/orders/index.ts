import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    if (req.method === 'POST') {
      // Get API key from header
      const apiKey = req.headers.get('X-API-Key')
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: 'API key is required', code: 'MISSING_API_KEY' }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // Verify API key and get user ID
      console.log('Received API key:', apiKey?.substring(0, 20) + '...')
      const { data: userId, error: keyError } = await supabase.rpc('verify_api_key', { api_key: apiKey })
      console.log('verify_api_key result - userId:', userId, 'error:', keyError)
      
      if (keyError || !userId) {
        console.error('API key verification failed:', userId)
        return new Response(
          JSON.stringify({ error: 'Invalid API key', code: 'INVALID_API_KEY' }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      const body = await req.json()
      
      // Validate required fields
      const requiredFields = ['sender', 'receiver']
      for (const field of requiredFields) {
        if (!body[field]) {
          return new Response(
            JSON.stringify({ 
              error: `Missing required field: ${field}`, 
              code: 'VALIDATION_ERROR' 
            }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }
      }

      // Validate bikes array or individual bike fields
      let bikeBrand = ''
      let bikeModel = ''
      
      if (body.bikes && Array.isArray(body.bikes) && body.bikes.length > 0) {
        // Handle bikes array format (from API documentation)
        bikeBrand = body.bikes[0].brand || ''
        bikeModel = body.bikes[0].model || ''
      } else if (body.bike_brand) {
        // Handle individual bike_brand/bike_model format
        bikeBrand = body.bike_brand
        bikeModel = body.bike_model || ''
      } else {
        return new Response(
          JSON.stringify({ 
            error: 'Missing bike information. Provide either bikes array or bike_brand field', 
            code: 'VALIDATION_ERROR' 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // Validate sender and receiver have required fields
      const validateContact = (contact: any, type: string) => {
        const required = ['name', 'phone', 'address']
        for (const field of required) {
          if (!contact[field]) {
            throw new Error(`Missing ${type}.${field}`)
          }
        }
      }

      try {
        validateContact(body.sender, 'sender')
        validateContact(body.receiver, 'receiver')
      } catch (error) {
        return new Response(
          JSON.stringify({ 
            error: error instanceof Error ? error.message : 'Validation error', 
            code: 'VALIDATION_ERROR' 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // Generate tracking number using the existing function
      const { data: trackingData, error: trackingError } = await supabase.functions.invoke('generate-tracking-numbers', {
        body: {
          generateSingle: true,
          senderName: body.sender.name || 'Unknown',
          receiverZipCode: body.receiver.address?.zipCode || body.receiver.address?.postal_code || body.receiver.postcode || body.receiver.postal_code || '00'
        }
      })
      
      if (trackingError || !trackingData?.trackingNumber) {
        console.error('Failed to generate tracking number:', trackingError)
        return new Response(
          JSON.stringify({ 
            error: 'Failed to generate tracking number', 
            code: 'TRACKING_GENERATION_FAILED' 
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      const trackingNumber = trackingData.trackingNumber

      // Create order with user_id from API key
      const orderData = {
        user_id: userId,
        sender: body.sender,
        receiver: body.receiver,
        bike_brand: bikeBrand,
        bike_model: bikeModel,
        bike_quantity: body.bikeQuantity || body.bike_quantity || 1,
        is_bike_swap: body.isBikeSwap || body.is_bike_swap || false,
        is_ebay_order: body.isEbayOrder || body.is_ebay_order || false,
        collection_code: body.collectionCode || body.collection_code || null,
        needs_payment_on_collection: body.needsPaymentOnCollection || body.needs_payment_on_collection || false,
        payment_collection_phone: body.paymentCollectionPhone || body.payment_collection_phone || null,
        delivery_instructions: body.deliveryInstructions || body.delivery_instructions || '',
        sender_notes: body.senderNotes || body.sender_notes || '',
        receiver_notes: body.receiverNotes || body.receiver_notes || '',
        customer_order_number: body.customerOrderNumber || body.customer_order_number || null,
        status: 'created',
        tracking_number: trackingNumber,
        pickup_date: body.pickup_date || null,
        delivery_date: body.delivery_date || null,
        scheduled_pickup_date: body.scheduled_pickup_date || null,
        scheduled_delivery_date: body.scheduled_delivery_date || null
      }

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([orderData])
        .select()
        .single()

      if (orderError) {
        console.error('Order creation failed:', orderError)
        return new Response(
          JSON.stringify({ 
            error: 'Failed to create order', 
            code: 'ORDER_CREATION_FAILED',
            details: orderError.message 
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // Get user profile for confirmation email
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('id', userId)
        .single()

      const userName = userProfile?.name || userProfile?.email || 'Customer'
      const userEmail = userProfile?.email

      // Send emails following the exact same flow as normal order creation
      console.log('===== STARTING EMAIL SENDING PROCESS (API ORDER) =====')
      console.log('Order ID:', order.id)
      console.log('User email:', userEmail)
      console.log('Sender email:', body.sender.email)
      console.log('Receiver email:', body.receiver.email)
      
      try {
        // 1. Order creation confirmation to the user who created the order (API key owner)
        if (userEmail) {
          console.log('STEP 1: Sending confirmation email to user...')
          const userConfirmationResponse = await supabase.functions.invoke('send-email', {
            body: {
              to: userEmail,
              subject: 'Your Order Has Been Created - The Cycle Courier Co.',
              html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Hello ${userName},</h2>
            <p>Thank you for creating your order with The Cycle Courier Co.</p>
            <p>Your order has been successfully created. Here are the details:</p>
            <div style="background-color: #f7f7f7; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Bicycle:</strong> ${`${bikeBrand} ${bikeModel}`.trim()}</p>
              <p><strong>Tracking Number:</strong> ${order.tracking_number}</p>
            </div>
            <p>We will send further emails to arrange a collection date and delivery with the sender and receiver.</p>
            <p>You can track your order's progress by visiting:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://booking.cyclecourierco.com/tracking/${order.tracking_number}" style="background-color: #4a65d5; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Track Your Order
              </a>
            </div>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #4a65d5;">https://booking.cyclecourierco.com/tracking/${order.tracking_number}</p>
            <p>Thank you for using our service.</p>
            <p>The Cycle Courier Co. Team</p>
          </div>
        `,
              from: 'Ccc@notification.cyclecourierco.com'
            }
          })
          
          if (userConfirmationResponse.error) {
            console.error('Failed to send user confirmation email:', userConfirmationResponse.error)
          } else {
            console.log('User confirmation email sent successfully')
          }
        }

        // 2. Sender availability email 
        if (body.sender && body.sender.email) {
          console.log('STEP 2: Sending availability email to sender...')
          const senderEmailResponse = await supabase.functions.invoke('send-email', {
            body: {
              to: body.sender.email,
              emailType: 'sender',
              orderId: order.id,
              name: body.sender.name,
              item: { name: `${bikeBrand} ${bikeModel}`.trim(), quantity: body.bikeQuantity || body.bike_quantity || 1 },
              baseUrl: 'https://booking.cyclecourierco.com'
            }
          })
          
          if (senderEmailResponse.error) {
            console.error('Failed to send sender availability email:', senderEmailResponse.error)
          } else {
            console.log('Sender availability email sent successfully')
          }
        }
        
        // 3. Receiver notification email (using proper email service)
        if (body.receiver && body.receiver.email) {
          console.log('STEP 3: Sending notification email to receiver...')
          const receiverEmailResponse = await supabase.functions.invoke('send-email', {
            body: {
              to: body.receiver.email,
              subject: 'Your Bicycle Delivery - The Cycle Courier Co.',
              html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Hello ${body.receiver.name},</h2>
            <p>A bicycle is being sent to you via The Cycle Courier Co.</p>
            <p>Here are the details:</p>
            <div style="background-color: #f7f7f7; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Bicycle:</strong> ${`${bikeBrand} ${bikeModel}`.trim()}</p>
              <p><strong>Tracking Number:</strong> ${order.tracking_number}</p>
            </div>
            <p><strong>Next Steps:</strong></p>
            <ol style="margin-bottom: 20px;">
              <li>We have contacted the sender to arrange a collection date.</li>
              <li>Once the sender confirms their availability, <strong>you will receive an email with a link to confirm your availability for delivery</strong>.</li>
              <li>After both confirmations, we will schedule the pickup and delivery.</li>
            </ol>
            <p>You can track the order's progress by visiting:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://booking.cyclecourierco.com/tracking/${order.tracking_number}" style="background-color: #4a65d5; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Track This Order
              </a>
            </div>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #4a65d5;">https://booking.cyclecourierco.com/tracking/${order.tracking_number}</p>
            <p>Thank you for using our service.</p>
            <p>The Cycle Courier Co. Team</p>
          </div>
        `,
              from: 'Ccc@notification.cyclecourierco.com'
            }
          })
          
          if (receiverEmailResponse.error) {
            console.error('Failed to send receiver notification email:', receiverEmailResponse.error)
          } else {
            console.log('Receiver notification email sent successfully')
          }
        }
        
      console.log('===== EMAIL SENDING PROCESS COMPLETED =====')
      } catch (emailError) {
        console.error('===== EMAIL SENDING PROCESS FAILED =====')
        console.error('Error sending emails:', emailError)
        // Don't fail the order creation if emails fail
      }

      // Create Shipday jobs in the background
      console.log('===== STARTING SHIPDAY JOB CREATION =====')
      try {
        const shipdayResponse = await supabase.functions.invoke('create-shipday-order', {
          body: { orderId: order.id }
        })
        
        if (shipdayResponse.error) {
          console.error('Failed to create Shipday jobs:', shipdayResponse.error)
        } else {
          console.log('Shipday jobs created successfully:', shipdayResponse.data)
        }
      } catch (shipdayError) {
        console.error('Error creating Shipday jobs:', shipdayError)
        // Don't fail the order creation if Shipday fails
      }
      console.log('===== SHIPDAY JOB CREATION COMPLETED =====')

      return new Response(
        JSON.stringify({
          id: order.id,
          tracking_number: order.tracking_number,
          status: order.status,
          created_at: order.created_at,
          sender: order.sender,
          receiver: order.receiver,
          bike_brand: order.bike_brand,
          bike_model: order.bike_model,
          bike_quantity: order.bike_quantity,
          is_bike_swap: order.is_bike_swap,
          is_ebay_order: order.is_ebay_order,
          collection_code: order.collection_code,
          needs_payment_on_collection: order.needs_payment_on_collection,
          delivery_instructions: order.delivery_instructions
        }),
        { 
          status: 201, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (req.method === 'GET') {
      const url = new URL(req.url)
      const orderId = url.pathname.split('/').pop()
      
      if (!orderId) {
        return new Response(
          JSON.stringify({ error: 'Order ID is required', code: 'MISSING_ORDER_ID' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      const { data: order, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single()

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Order not found', code: 'ORDER_NOT_FOUND' }),
          { 
            status: 404, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      return new Response(
        JSON.stringify(order),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        code: 'INTERNAL_ERROR' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})