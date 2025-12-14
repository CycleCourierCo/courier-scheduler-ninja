import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OptimoRouteOrder {
  orderNo: string;
  type: 'P' | 'D';
  date?: string;
  location: {
    address: string;
    locationName?: string;
    notes?: string;
  };
  duration?: number;
  notes?: string;
  allowedDates?: {
    anyTime?: boolean;
    dates?: string[];
  };
  relatedOrderNo?: string;
  relatedId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const optimoRouteApiKey = Deno.env.get('OPTIMOROUTE_API_KEY');
    if (!optimoRouteApiKey) {
      throw new Error('OPTIMOROUTE_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all orders that are NOT cancelled and NOT delivered
    console.log('Fetching active orders...');
    const { data: orders, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .not('status', 'in', '("cancelled","delivered")');

    if (fetchError) {
      console.error('Error fetching orders:', fetchError);
      throw new Error(`Failed to fetch orders: ${fetchError.message}`);
    }

    console.log(`Found ${orders?.length || 0} active orders`);

    let synced = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const order of orders || []) {
      try {
        const trackingNumber = order.tracking_number;
        if (!trackingNumber) {
          console.log(`Order ${order.id} has no tracking number, skipping`);
          skipped++;
          continue;
        }

        const sender = order.sender as any;
        const receiver = order.receiver as any;
        const orderCollected = order.order_collected === true;
        const orderDelivered = order.order_delivered === true;

        // Skip if already delivered
        if (orderDelivered) {
          console.log(`Order ${trackingNumber} already delivered, skipping`);
          skipped++;
          continue;
        }

        const ordersToCreate: OptimoRouteOrder[] = [];
        let pickupOrderNo = `${trackingNumber}-PICKUP`;
        let deliveryOrderNo = `${trackingNumber}-DELIVERY`;

        // If NOT collected, create pickup order
        if (!orderCollected && !order.optimoroute_pickup_id) {
          const senderAddress = sender?.address || {};
          const pickupAddress = [
            senderAddress.line1,
            senderAddress.line2,
            senderAddress.city,
            senderAddress.postcode
          ].filter(Boolean).join(', ');

          if (pickupAddress) {
            // Parse pickup dates
            let allowedDates: { anyTime?: boolean; dates?: string[] } | undefined;
            if (order.pickup_date) {
              const pickupDates = Array.isArray(order.pickup_date) 
                ? order.pickup_date 
                : [order.pickup_date];
              allowedDates = { dates: pickupDates };
            }

            ordersToCreate.push({
              orderNo: pickupOrderNo,
              type: 'P',
              location: {
                address: pickupAddress,
                locationName: sender?.name || 'Sender',
                notes: `Phone: ${sender?.phone || 'N/A'}. ${order.sender_notes || ''}`
              },
              duration: 15,
              notes: `Bike: ${order.bike_brand || ''} ${order.bike_model || ''}. Tracking: ${trackingNumber}`,
              allowedDates
            });
          }
        }

        // Create delivery order if not already in OptimoRoute
        if (!order.optimoroute_delivery_id) {
          const receiverAddress = receiver?.address || {};
          const deliveryAddress = [
            receiverAddress.line1,
            receiverAddress.line2,
            receiverAddress.city,
            receiverAddress.postcode
          ].filter(Boolean).join(', ');

          if (deliveryAddress) {
            // Parse delivery dates
            let allowedDates: { anyTime?: boolean; dates?: string[] } | undefined;
            if (order.delivery_date) {
              const deliveryDates = Array.isArray(order.delivery_date) 
                ? order.delivery_date 
                : [order.delivery_date];
              allowedDates = { dates: deliveryDates };
            }

            const deliveryOrder: OptimoRouteOrder = {
              orderNo: deliveryOrderNo,
              type: 'D',
              location: {
                address: deliveryAddress,
                locationName: receiver?.name || 'Receiver',
                notes: `Phone: ${receiver?.phone || 'N/A'}. ${order.receiver_notes || ''} ${order.delivery_instructions || ''}`
              },
              duration: 15,
              notes: `Bike: ${order.bike_brand || ''} ${order.bike_model || ''}. Tracking: ${trackingNumber}`,
              allowedDates
            };

            // Link to pickup order
            if (!orderCollected && !order.optimoroute_pickup_id) {
              // Pickup is being created now
              deliveryOrder.relatedOrderNo = pickupOrderNo;
            } else if (order.optimoroute_pickup_id) {
              // Pickup already exists
              deliveryOrder.relatedOrderNo = pickupOrderNo;
              deliveryOrder.relatedId = order.optimoroute_pickup_id;
            }

            ordersToCreate.push(deliveryOrder);
          }
        }

        if (ordersToCreate.length === 0) {
          console.log(`Order ${trackingNumber} already synced or no address data, skipping`);
          skipped++;
          continue;
        }

        // Send to OptimoRoute
        console.log(`Syncing ${ordersToCreate.length} jobs for order ${trackingNumber}`);
        const response = await fetch(`https://api.optimoroute.com/v1/create_order?key=${optimoRouteApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operation: 'CREATE', orderData: ordersToCreate })
        });

        const result = await response.json();
        console.log(`OptimoRoute response for ${trackingNumber}:`, JSON.stringify(result));

        if (result.success) {
          // Update order with OptimoRoute IDs
          const updateData: any = {};
          
          if (result.orders) {
            for (const createdOrder of result.orders) {
              if (createdOrder.orderNo === pickupOrderNo && createdOrder.id) {
                updateData.optimoroute_pickup_id = createdOrder.id;
              }
              if (createdOrder.orderNo === deliveryOrderNo && createdOrder.id) {
                updateData.optimoroute_delivery_id = createdOrder.id;
              }
            }
          }

          if (Object.keys(updateData).length > 0) {
            const { error: updateError } = await supabase
              .from('orders')
              .update(updateData)
              .eq('id', order.id);

            if (updateError) {
              console.error(`Failed to update order ${order.id}:`, updateError);
            }
          }

          synced++;
        } else {
          console.error(`OptimoRoute error for ${trackingNumber}:`, result);
          errors.push(`${trackingNumber}: ${result.message || 'Unknown error'}`);
          failed++;
        }
      } catch (orderError) {
        console.error(`Error processing order ${order.id}:`, orderError);
        errors.push(`${order.tracking_number || order.id}: ${orderError.message}`);
        failed++;
      }
    }

    const summary = {
      success: true,
      synced,
      skipped,
      failed,
      total: orders?.length || 0,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined
    };

    console.log('Sync complete:', summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Sync error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
