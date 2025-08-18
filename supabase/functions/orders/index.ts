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
      const { data: userId, error: keyError } = await supabase.rpc('verify_api_key', { api_key: apiKey })
      
      if (keyError || !userId) {
        console.error('API key verification failed:', keyError)
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
      const requiredFields = ['sender', 'receiver', 'bike_brand']
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

      // Generate tracking number
      const trackingNumber = `CC${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`

      // Create order with user_id from API key
      const orderData = {
        user_id: userId,
        sender: body.sender,
        receiver: body.receiver,
        bike_brand: body.bike_brand,
        bike_model: body.bike_model || '',
        bike_quantity: body.bike_quantity || 1,
        is_bike_swap: body.is_bike_swap || false,
        is_ebay_order: body.is_ebay_order || false,
        collection_code: body.collection_code || null,
        needs_payment_on_collection: body.needs_payment_on_collection || false,
        payment_collection_phone: body.payment_collection_phone || null,
        delivery_instructions: body.delivery_instructions || '',
        sender_notes: body.sender_notes || '',
        receiver_notes: body.receiver_notes || '',
        customer_order_number: body.customer_order_number || null,
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