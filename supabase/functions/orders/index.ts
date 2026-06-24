import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { corsHeaders } from '../_shared/cors.ts'
import { initSentry, captureException, startSpan } from '../_shared/sentry.ts'

// Bike type numeric ID mapping
const BIKE_TYPE_BY_ID: Record<number, string> = {
  1: 'Non-Electric - Mountain Bike',
  2: 'Non-Electric - Road Bike',
  3: 'Non-Electric - Hybrid',
  4: 'Electric Bike - Under 25kg',
  5: 'Electric Bike - Over 25kg',
  6: 'Cargo Bike',
  7: 'Longtail Cargo Bike',
  8: 'Stationary Bike',
  9: 'Kids Bikes',
  10: 'BMX Bikes',
  11: 'Boxed Kids Bikes',
  12: 'Folding Bikes',
  13: 'Tandem',
  14: 'Travel Bike Box',
  15: 'Wheelset/Frameset',
  16: 'Bike Rack',
  17: 'Turbo Trainer',
}

function resolveBikeTypeId(typeId: number | undefined | null): string | null {
  if (typeId === undefined || typeId === null) return null
  const resolved = BIKE_TYPE_BY_ID[typeId]
  if (!resolved) throw new Error(`Invalid bike_type_id: ${typeId}. Must be 1-17.`)
  return resolved
}

// Get ONLY lat/lon coordinates from an address string - does NOT modify any other fields
async function getCoordinates(addressString: string): Promise<{ lat: number; lon: number } | null> {
  const geoapifyKey = Deno.env.get('GEOAPIFY_API_KEY');
  if (!geoapifyKey) {
    console.log('No Geoapify API key, skipping geocoding');
    return null;
  }
  
  try {
    const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(addressString)}&filter=countrycode:gb&apiKey=${geoapifyKey}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const coords = data.features[0].geometry.coordinates;
      console.log(`Geocoded "${addressString}" -> lat: ${coords[1]}, lon: ${coords[0]}`);
      return { lat: coords[1], lon: coords[0] };
    }
    console.log(`No geocoding results for: ${addressString}`);
  } catch (error) {
    console.error('Geocoding failed:', error);
  }
  return null;
}

Deno.serve(async (req) => {
  // Initialize Sentry for this request
  initSentry("orders");
  
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
      console.log('API key received, verifying...')
      const { data: userId, error: keyError } = await supabase.rpc('verify_api_key', { api_key: apiKey })
      console.log('API key verification:', userId ? 'success' : 'failed')
      
      if (keyError || !userId) {
        console.error('API key verification failed')
        return new Response(
          JSON.stringify({ error: 'Invalid API key', code: 'INVALID_API_KEY' }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      const body = await req.json()

      // Box My Bike: auto-fill depot as receiver so caller doesn't need to provide it
      const isBoxMyBike = body.isBoxMyBike || body.is_box_my_bike || false
      if (isBoxMyBike) {
        body.receiver = {
          name: "Cycle Courier Depot",
          email: "depot@cyclecourierco.com",
          phone: "01215050598",
          address: {
            street: "Lawden Road",
            city: "Birmingham",
            zipCode: "B10 0AD",
            country: "GB",
            lat: 52.4690197,
            lon: -1.8757663,
          },
        }
      }

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
      let bikeType: string | null = null
      let bikeValue: number | null = null
      let bikesArray: any[] | null = null
      
      try {
        if (body.bikes && Array.isArray(body.bikes) && body.bikes.length > 0) {
          bikesArray = body.bikes
          bikeBrand = body.bikes[0].brand || ''
          bikeModel = body.bikes[0].model || ''
          // Resolve type_id to string type (type_id takes precedence over type)
          if (body.bikes[0].type_id !== undefined) {
            bikeType = resolveBikeTypeId(body.bikes[0].type_id)
          } else {
            bikeType = body.bikes[0].type || null
          }
          bikeValue = body.bikes[0].value !== undefined ? Number(body.bikes[0].value) : null
          
          // Resolve type_id in each bike in the array
          bikesArray = body.bikes.map((bike: any) => {
            const resolved = { ...bike }
            if (bike.type_id !== undefined) {
              resolved.type = resolveBikeTypeId(bike.type_id)
            }
            return resolved
          })
        } else if (body.bike_brand) {
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
        
        // Top-level bike_type_id / bike_type / bike_value override
        if (body.bike_type_id !== undefined) {
          bikeType = resolveBikeTypeId(body.bike_type_id)
        } else if (body.bike_type && !bikeType) {
          bikeType = body.bike_type
        }
        if (body.bike_value !== undefined && bikeValue === null) {
          bikeValue = Number(body.bike_value)
        }
      } catch (typeError) {
        return new Response(
          JSON.stringify({ 
            error: typeError instanceof Error ? typeError.message : 'Invalid bike type ID', 
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

      // Idempotency: if customer_order_number provided, return existing order on retry
      const customerOrderNumber = body.customerOrderNumber || body.customer_order_number || null
      if (customerOrderNumber) {
        const { data: existing } = await supabase
          .from('orders')
          .select('id, tracking_number, status, created_at, sender, receiver, bike_brand, bike_model, bike_type, bike_value, bikes, bike_quantity, is_bike_swap, is_ebay_order, collection_code, needs_payment_on_collection, needs_inspection, delivery_instructions')
          .eq('user_id', userId)
          .eq('customer_order_number', customerOrderNumber)
          .maybeSingle()
        if (existing) {
          console.log('Idempotent hit for customer_order_number:', customerOrderNumber, '-> order', existing.id)
          return new Response(
            JSON.stringify({ ...existing, idempotent: true }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      // Generate tracking number using the existing function
      const { data: trackingData, error: trackingError } = await supabase.functions.invoke('generate-tracking-numbers', {
        body: {
          generateSingle: true,
          senderName: body.sender.name || 'Unknown',
          receiverZipCode: body.receiver.address?.zipCode || body.receiver.address?.postal_code || body.receiver.address?.postcode || body.receiver.postcode || body.receiver.postal_code || '00'
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

      // Create order WITHOUT waiting for geocoding/emails/Shipday — those run in the background.
      const orderData = {
        user_id: userId,
        sender: body.sender,
        receiver: body.receiver,
        bike_brand: bikeBrand,
        bike_model: bikeModel,
        bike_type: bikeType,
        bike_value: bikeValue,
        bikes: bikesArray,
        bike_quantity: body.bikeQuantity || body.bike_quantity || 1,
        is_bike_swap: body.isBikeSwap || body.is_bike_swap || false,
        is_ebay_order: body.isEbayOrder || body.is_ebay_order || false,
        collection_code: body.collectionCode || body.collection_code || null,
        needs_payment_on_collection: body.needsPaymentOnCollection || body.needs_payment_on_collection || false,
        payment_collection_phone: body.paymentCollectionPhone || body.payment_collection_phone || null,
        delivery_instructions: body.deliveryInstructions || body.delivery_instructions || '',
        sender_notes: body.senderNotes || body.sender_notes || '',
        receiver_notes: body.receiverNotes || body.receiver_notes || '',
        customer_order_number: customerOrderNumber,
        shopify_order_id: body.shopifyOrderId || body.shopify_order_id || null,
        needs_inspection: body.needsInspection || body.needs_inspection || false,
        is_box_my_bike: body.isBoxMyBike || body.is_box_my_bike || false,
        box_my_bike_status: (body.isBoxMyBike || body.is_box_my_bike) ? 'awaiting_depot' : null,
        status: 'created',
        tracking_number: trackingNumber,
        pickup_date: body.pickup_date || null,
        delivery_date: body.delivery_date || null,
        scheduled_pickup_date: body.scheduled_pickup_date || null,
        scheduled_delivery_date: body.scheduled_delivery_date || null,
        created_via_api: true
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

      // ===== Background: geocoding, contacts, emails, Shipday =====
      const backgroundWork = (async () => {
        // Geocode addresses and update the order row
        try {
          const senderAddress = body.sender.address
          const receiverAddress = body.receiver.address
          const senderAddressString = [
            senderAddress?.street,
            senderAddress?.city,
            senderAddress?.zipCode || senderAddress?.postal_code || senderAddress?.postcode,
            'UK'
          ].filter(Boolean).join(', ')
          const receiverAddressString = [
            receiverAddress?.street,
            receiverAddress?.city,
            receiverAddress?.zipCode || receiverAddress?.postal_code || receiverAddress?.postcode,
            'UK'
          ].filter(Boolean).join(', ')

          const [senderCoords, receiverCoords] = await Promise.all([
            getCoordinates(senderAddressString),
            getCoordinates(receiverAddressString)
          ])

          const updatedSender = senderCoords
            ? { ...body.sender, address: { ...body.sender.address, lat: senderCoords.lat, lon: senderCoords.lon } }
            : body.sender
          const updatedReceiver = receiverCoords
            ? { ...body.receiver, address: { ...body.receiver.address, lat: receiverCoords.lat, lon: receiverCoords.lon } }
            : body.receiver

          if (senderCoords || receiverCoords) {
            await supabase
              .from('orders')
              .update({ sender: updatedSender, receiver: updatedReceiver })
              .eq('id', order.id)
            // keep local body in sync for downstream contact upserts
            body.sender = updatedSender
            body.receiver = updatedReceiver
          }
        } catch (geoErr) {
          console.error('Background geocoding failed:', geoErr)
          captureException(geoErr)
        }

        // Upsert sender and receiver contacts, then link to order
        try {
          let senderContactId: string | null = null
          let receiverContactId: string | null = null

          if (body.sender?.email?.trim()) {
            const senderEmail = body.sender.email.trim().toLowerCase()
            const { data: senderContact, error: senderUpsertError } = await supabase
              .from('contacts')
              .upsert({
                user_id: userId,
                name: body.sender.name,
                email: senderEmail,
                phone: body.sender.phone || null,
                street: body.sender.address?.street || null,
                city: body.sender.address?.city || null,
                state: body.sender.address?.state || null,
                postal_code: body.sender.address?.zipCode || body.sender.address?.postal_code || body.sender.address?.postcode || null,
                country: body.sender.address?.country || null,
                lat: body.sender.address?.lat || null,
                lon: body.sender.address?.lon || null,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'user_id,email', ignoreDuplicates: false })
              .select('id')
              .single()
            if (senderUpsertError) console.error('Failed to upsert sender contact:', senderUpsertError)
            else senderContactId = senderContact?.id || null
          }

          if (body.receiver?.email?.trim()) {
            const receiverEmail = body.receiver.email.trim().toLowerCase()
            const { data: receiverContact, error: receiverUpsertError } = await supabase
              .from('contacts')
              .upsert({
                user_id: userId,
                name: body.receiver.name,
                email: receiverEmail,
                phone: body.receiver.phone || null,
                street: body.receiver.address?.street || null,
                city: body.receiver.address?.city || null,
                state: body.receiver.address?.state || null,
                postal_code: body.receiver.address?.zipCode || body.receiver.address?.postal_code || body.receiver.address?.postcode || null,
                country: body.receiver.address?.country || null,
                lat: body.receiver.address?.lat || null,
                lon: body.receiver.address?.lon || null,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'user_id,email', ignoreDuplicates: false })
              .select('id')
              .single()
            if (receiverUpsertError) console.error('Failed to upsert receiver contact:', receiverUpsertError)
            else receiverContactId = receiverContact?.id || null
          }

          if (senderContactId || receiverContactId) {
            await supabase
              .from('orders')
              .update({ sender_contact_id: senderContactId, receiver_contact_id: receiverContactId })
              .eq('id', order.id)
          }
        } catch (contactError) {
          console.error('Error upserting contacts:', contactError)
          captureException(contactError)
        }

        // Emails
        try {
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('name, email')
            .eq('id', userId)
            .single()
          const userName = userProfile?.name || userProfile?.email || 'Customer'
          const userEmail = userProfile?.email

          if (userEmail) {
            await supabase.functions.invoke('send-email', {
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
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://booking.cyclecourierco.com/tracking/${order.tracking_number}" style="background-color: #4a65d5; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Track Your Order</a>
              </div>
              <p style="word-break: break-all; color: #4a65d5;">https://booking.cyclecourierco.com/tracking/${order.tracking_number}</p>
              <p>The Cycle Courier Co. Team</p>
            </div>
          `,
                from: 'Ccc@notification.cyclecourierco.com'
              }
            })
          }

          if (body.sender?.email) {
            await supabase.functions.invoke('send-email', {
              body: {
                to: body.sender.email,
                emailType: 'sender',
                orderId: order.id,
                name: body.sender.name,
                item: { name: `${bikeBrand} ${bikeModel}`.trim(), quantity: body.bikeQuantity || body.bike_quantity || 1 },
                baseUrl: 'https://booking.cyclecourierco.com'
              }
            })
          }

          if (body.receiver?.email) {
            await supabase.functions.invoke('send-email', {
              body: {
                to: body.receiver.email,
                subject: 'Your Bicycle Delivery - The Cycle Courier Co.',
                html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Hello ${body.receiver.name},</h2>
              <p>A bicycle is being sent to you via The Cycle Courier Co.</p>
              <div style="background-color: #f7f7f7; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p><strong>Bicycle:</strong> ${`${bikeBrand} ${bikeModel}`.trim()}</p>
                <p><strong>Tracking Number:</strong> ${order.tracking_number}</p>
              </div>
              <p><strong>Next Steps:</strong></p>
              <ol>
                <li>We have contacted the sender to arrange a collection date.</li>
                <li>Once the sender confirms their availability, <strong>you will receive an email with a link to confirm your availability for delivery</strong>.</li>
                <li>After both confirmations, we will schedule the pickup and delivery.</li>
              </ol>
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://booking.cyclecourierco.com/tracking/${order.tracking_number}" style="background-color: #4a65d5; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Track This Order</a>
              </div>
              <p style="word-break: break-all; color: #4a65d5;">https://booking.cyclecourierco.com/tracking/${order.tracking_number}</p>
              <p>The Cycle Courier Co. Team</p>
            </div>
          `,
                from: 'Ccc@notification.cyclecourierco.com'
              }
            })
          }
        } catch (emailError) {
          console.error('Background email sending failed:', emailError)
          captureException(emailError)
        }

        // Shipday
        try {
          const shipdayResponse = await supabase.functions.invoke('create-shipday-order', {
            body: { orderId: order.id }
          })
          if (shipdayResponse.error) {
            console.error('Failed to create Shipday jobs:', shipdayResponse.error)
          }
        } catch (shipdayError) {
          console.error('Error creating Shipday jobs:', shipdayError)
          captureException(shipdayError)
        }
      })()

      // @ts-ignore EdgeRuntime is provided by Supabase Edge Runtime
      if (typeof EdgeRuntime !== 'undefined' && (EdgeRuntime as any).waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(backgroundWork)
      } else {
        // Fallback: don't block response but log
        backgroundWork.catch((e) => console.error('Background work error:', e))
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
          bike_type: order.bike_type,
          bike_value: order.bike_value,
          bikes: order.bikes,
          bike_quantity: order.bike_quantity,
          is_bike_swap: order.is_bike_swap,
          is_ebay_order: order.is_ebay_order,
          collection_code: order.collection_code,
          needs_payment_on_collection: order.needs_payment_on_collection,
          needs_inspection: order.needs_inspection,
          delivery_instructions: order.delivery_instructions
        }),
        { 
          status: 201, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }


    if (req.method === 'GET') {
      // Require API key auth for GET, same as POST
      const apiKey = req.headers.get('X-API-Key')
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: 'API key is required', code: 'MISSING_API_KEY' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      const { data: userId, error: keyError } = await supabase.rpc('verify_api_key', { api_key: apiKey })
      if (keyError || !userId) {
        return new Response(
          JSON.stringify({ error: 'Invalid API key', code: 'INVALID_API_KEY' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const url = new URL(req.url)
      const orderId = url.pathname.split('/').pop()

      if (!orderId) {
        return new Response(
          JSON.stringify({ error: 'Order ID is required', code: 'MISSING_ORDER_ID' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Scope to caller's own orders and return only API-safe fields
      const { data: order, error } = await supabase
        .from('orders')
        .select('id, tracking_number, customer_order_number, status, created_at, updated_at, bike_brand, bike_model, bike_type, bike_quantity, bikes, is_bike_swap, is_ebay_order, needs_inspection, needs_payment_on_collection, delivery_instructions, pickup_date, delivery_date, scheduled_pickup_date, scheduled_delivery_date, pickup_timeslot, delivery_timeslot, order_collected, order_delivered, sender, receiver')
        .eq('id', orderId)
        .eq('user_id', userId)
        .maybeSingle()

      if (error || !order) {
        return new Response(
          JSON.stringify({ error: 'Order not found', code: 'ORDER_NOT_FOUND' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify(order),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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