import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateOptimoRouteOrderRequest {
  orderId: string;
  jobType: 'pickup' | 'delivery';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderId, jobType }: CreateOptimoRouteOrderRequest = await req.json();
    
    console.log(`Creating OptimoRoute order: orderId=${orderId}, jobType=${jobType}`);

    if (!orderId || !jobType) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing orderId or jobType' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const optimoRouteApiKey = Deno.env.get('OPTIMOROUTE_API_KEY');
    if (!optimoRouteApiKey) {
      console.error('OPTIMOROUTE_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, message: 'OptimoRoute API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch order details
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      console.error('Error fetching order:', fetchError);
      return new Response(
        JSON.stringify({ success: false, message: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Order fetched:', order.tracking_number);

    const trackingNumber = order.tracking_number;
    if (!trackingNumber) {
      return new Response(
        JSON.stringify({ success: false, message: 'Order has no tracking number' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse sender and receiver from JSON
    const sender = typeof order.sender === 'string' ? JSON.parse(order.sender) : order.sender;
    const receiver = typeof order.receiver === 'string' ? JSON.parse(order.receiver) : order.receiver;

    // Determine order details based on job type
    const isPickup = jobType === 'pickup';
    const orderNo = `${trackingNumber}-${isPickup ? 'PICKUP' : 'DELIVERY'}`;
    const contact = isPickup ? sender : receiver;
    const address = contact?.address;

    // Build full address string
    const fullAddress = [
      address?.street,
      address?.city,
      address?.state,
      address?.zipCode,
      address?.country || 'UK'
    ].filter(Boolean).join(', ');

    // Build allowed dates from pickup_date or delivery_date arrays
    let allowedDates: { from?: string; to?: string } = {};
    const dateArray = isPickup ? order.pickup_date : order.delivery_date;
    
    if (dateArray && Array.isArray(dateArray) && dateArray.length > 0) {
      // Sort dates and get first and last
      const sortedDates = dateArray
        .map((d: string) => new Date(d))
        .sort((a: Date, b: Date) => a.getTime() - b.getTime());
      
      const firstDate = sortedDates[0];
      const lastDate = sortedDates[sortedDates.length - 1];
      
      allowedDates = {
        from: firstDate.toISOString().split('T')[0],
        to: lastDate.toISOString().split('T')[0]
      };
    }

    // Build the OptimoRoute order object
    const optimoRouteOrder: Record<string, any> = {
      operation: 'SYNC',
      orderNo: orderNo,
      type: isPickup ? 'P' : 'D',
      date: new Date().toISOString().split('T')[0], // Today's date as default
      duration: 15,
      location: {
        address: fullAddress,
        locationName: contact?.name || 'Unknown',
        latitude: address?.lat,
        longitude: address?.lon,
        acceptPartialMatch: true,
        acceptMultipleResults: true
      },
      notes: `${isPickup ? 'Pickup' : 'Delivery'} for ${trackingNumber}. Bike: ${order.bike_brand || ''} ${order.bike_model || ''}${order.delivery_instructions ? `. ${order.delivery_instructions}` : ''}`.trim(),
      phone: contact?.phone || '',
      email: contact?.email || '',
      load1: order.bike_quantity || 1
    };

    // Add allowed dates if available
    if (Object.keys(allowedDates).length > 0) {
      optimoRouteOrder.allowedDates = allowedDates;
    }

    // For delivery orders, link to the pickup order
    if (!isPickup) {
      const pickupOrderNo = `${trackingNumber}-PICKUP`;
      optimoRouteOrder.relatedOrderNo = pickupOrderNo;
      
      // If we have the pickup ID already, include it
      if (order.optimoroute_pickup_id) {
        optimoRouteOrder.relatedId = order.optimoroute_pickup_id;
      }
    }

    console.log('OptimoRoute order payload:', JSON.stringify(optimoRouteOrder, null, 2));

    // Call OptimoRoute API
    const optimoRouteResponse = await fetch(
      `https://api.optimoroute.com/v1/create_order?key=${optimoRouteApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(optimoRouteOrder),
      }
    );

    const optimoRouteResult = await optimoRouteResponse.json();
    console.log('OptimoRoute API response:', JSON.stringify(optimoRouteResult, null, 2));

    if (!optimoRouteResult.success) {
      console.error('OptimoRoute API error:', optimoRouteResult);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: optimoRouteResult.message || optimoRouteResult.code || 'Failed to create order in OptimoRoute' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store the OptimoRoute order ID
    const updateColumn = isPickup ? 'optimoroute_pickup_id' : 'optimoroute_delivery_id';
    const { error: updateError } = await supabase
      .from('orders')
      .update({ [updateColumn]: optimoRouteResult.id })
      .eq('id', orderId);

    if (updateError) {
      console.error('Error updating order with OptimoRoute ID:', updateError);
      // Don't fail the request, the order was created in OptimoRoute
    }

    console.log(`OptimoRoute ${jobType} order created successfully: ${optimoRouteResult.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${isPickup ? 'Collection' : 'Delivery'} added to OptimoRoute successfully`,
        optimorouteId: optimoRouteResult.id,
        orderNo: orderNo
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-optimoroute-order:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
