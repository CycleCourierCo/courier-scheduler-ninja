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
            error: error.message, 
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
          receiverZipCode: body.receiver.address?.postal_code || body.receiver.postcode || body.receiver.postal_code || '00'
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

      // Send availability emails to sender and receiver
      console.log('Sending availability emails for new order:', order.id)
      
      try {
        // Send sender availability email
        if (body.sender && body.sender.email) {
          const senderEmailResponse = await supabase.functions.invoke('send-email', {
            body: {
              to: body.sender.email,
              emailType: 'sender',
              orderId: order.id,
              name: body.sender.name,
              item: { name: `${bikeBrand} ${bikeModel}`.trim(), quantity: body.bikeQuantity || 1 },
              baseUrl: 'https://booking.cyclecourierco.com'
            }
          })
          
          if (senderEmailResponse.error) {
            console.error('Failed to send sender email:', senderEmailResponse.error)
          } else {
            console.log('Sender availability email sent successfully')
          }
        }
        
        // Send receiver availability email
        if (body.receiver && body.receiver.email) {
          const receiverEmailResponse = await supabase.functions.invoke('send-email', {
            body: {
              to: body.receiver.email,
              emailType: 'receiver', 
              orderId: order.id,
              name: body.receiver.name,
              item: { name: `${bikeBrand} ${bikeModel}`.trim(), quantity: body.bikeQuantity || 1 },
              baseUrl: 'https://booking.cyclecourierco.com'
            }
          })
          
          if (receiverEmailResponse.error) {
            console.error('Failed to send receiver email:', receiverEmailResponse.error)
          } else {
            console.log('Receiver availability email sent successfully')
          }
        }
      } catch (emailError) {
        console.error('Error sending availability emails:', emailError)
        // Don't fail the order creation if emails fail
      }

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