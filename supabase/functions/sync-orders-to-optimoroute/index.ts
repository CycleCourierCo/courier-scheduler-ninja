import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to convert ISO timestamp to YYYY-MM-DD format
const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  // Handle both "2025-12-15T00:00:00.000Z" and "2025-12-15" formats
  return dateStr.split('T')[0];
};

// Get today's date in YYYY-MM-DD format
const getTodayDate = (): string => {
  return new Date().toISOString().split('T')[0];
};

// Get tomorrow's date in YYYY-MM-DD format
const getTomorrowDate = (): string => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
};

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

        const pickupOrderNo = `${trackingNumber}-PICKUP`;
        const deliveryOrderNo = `${trackingNumber}-DELIVERY`;
        const updateData: any = {};
        let pickupId: string | null = order.optimoroute_pickup_id || null;
        let orderSynced = false;

        // Create pickup order if NOT collected and not already in OptimoRoute
        if (!orderCollected && !order.optimoroute_pickup_id) {
          const senderAddress = sender?.address || {};
          // Use street/city/zipCode fields (actual data structure)
          const pickupAddress = [
            senderAddress.street || senderAddress.line1,
            senderAddress.city,
            senderAddress.zipCode || senderAddress.postcode
          ].filter(Boolean).join(', ');

          if (pickupAddress) {
            // Build pickup order payload
            const pickupPayload: any = {
              operation: 'CREATE',
              orderNo: pickupOrderNo,
              type: 'P',
              duration: 15,
              location: {
                address: pickupAddress,
                locationName: sender?.name || 'Sender',
              },
              notes: `Phone: ${sender?.phone || 'N/A'}. ${order.sender_notes || ''} Bike: ${order.bike_brand || ''} ${order.bike_model || ''}. Tracking: ${trackingNumber}`,
            };

            // Add coordinates if available (use lat/lon field names)
            if (senderAddress.lat && senderAddress.lon) {
              pickupPayload.location.latitude = senderAddress.lat;
              pickupPayload.location.longitude = senderAddress.lon;
            } else if (senderAddress.latitude && senderAddress.longitude) {
              pickupPayload.location.latitude = senderAddress.latitude;
              pickupPayload.location.longitude = senderAddress.longitude;
            }

            // Handle dates - OptimoRoute requires YYYY-MM-DD format
            if (order.pickup_date && Array.isArray(order.pickup_date) && order.pickup_date.length > 0) {
              const sortedDates = order.pickup_date.map(formatDate).filter(Boolean).sort();
              if (sortedDates.length > 0) {
                pickupPayload.allowedDates = {
                  from: sortedDates[0],
                  to: sortedDates[sortedDates.length - 1]
                };
              }
            } else if (order.scheduled_pickup_date) {
              // Use scheduled date if no pickup_date array
              pickupPayload.date = formatDate(order.scheduled_pickup_date);
            } else {
              // Default to today if no date specified
              pickupPayload.date = getTodayDate();
            }

            console.log(`Creating pickup for ${trackingNumber}`, JSON.stringify(pickupPayload));
            const pickupResponse = await fetch(`https://api.optimoroute.com/v1/create_order?key=${optimoRouteApiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(pickupPayload)
            });

            const pickupResult = await pickupResponse.json();
            console.log(`Pickup response for ${trackingNumber}:`, JSON.stringify(pickupResult));

            if (pickupResult.success && pickupResult.id) {
              pickupId = pickupResult.id;
              updateData.optimoroute_pickup_id = pickupResult.id;
              orderSynced = true;
            } else {
              console.error(`Pickup creation failed for ${trackingNumber}:`, pickupResult);
              errors.push(`${trackingNumber}-PICKUP: ${pickupResult.message || 'Unknown error'}`);
            }
          }
        }

        // Create delivery order if not already in OptimoRoute
        if (!order.optimoroute_delivery_id) {
          const receiverAddress = receiver?.address || {};
          // Use street/city/zipCode fields (actual data structure)
          const deliveryAddress = [
            receiverAddress.street || receiverAddress.line1,
            receiverAddress.city,
            receiverAddress.zipCode || receiverAddress.postcode
          ].filter(Boolean).join(', ');

          if (deliveryAddress) {
            // Build delivery order payload
            const deliveryPayload: any = {
              operation: 'CREATE',
              orderNo: deliveryOrderNo,
              type: 'D',
              duration: 15,
              location: {
                address: deliveryAddress,
                locationName: receiver?.name || 'Receiver',
              },
              notes: `Phone: ${receiver?.phone || 'N/A'}. ${order.receiver_notes || ''} ${order.delivery_instructions || ''} Bike: ${order.bike_brand || ''} ${order.bike_model || ''}. Tracking: ${trackingNumber}`,
            };

            // Add coordinates if available (use lat/lon field names)
            if (receiverAddress.lat && receiverAddress.lon) {
              deliveryPayload.location.latitude = receiverAddress.lat;
              deliveryPayload.location.longitude = receiverAddress.lon;
            } else if (receiverAddress.latitude && receiverAddress.longitude) {
              deliveryPayload.location.latitude = receiverAddress.latitude;
              deliveryPayload.location.longitude = receiverAddress.longitude;
            }

            // Handle dates - OptimoRoute requires YYYY-MM-DD format
            if (order.delivery_date && Array.isArray(order.delivery_date) && order.delivery_date.length > 0) {
              const sortedDates = order.delivery_date.map(formatDate).filter(Boolean).sort();
              if (sortedDates.length > 0) {
                deliveryPayload.allowedDates = {
                  from: sortedDates[0],
                  to: sortedDates[sortedDates.length - 1]
                };
              }
            } else if (order.scheduled_delivery_date) {
              // Use scheduled date if no delivery_date array
              deliveryPayload.date = formatDate(order.scheduled_delivery_date);
            } else {
              // Default to tomorrow if no date specified
              deliveryPayload.date = getTomorrowDate();
            }

            // Link to pickup order if we have an ID
            if (pickupId) {
              deliveryPayload.relatedOrderNo = pickupOrderNo;
              deliveryPayload.relatedId = pickupId;
            } else if (!orderCollected) {
              // Just link by order number if pickup exists but we don't have ID
              deliveryPayload.relatedOrderNo = pickupOrderNo;
            }

            console.log(`Creating delivery for ${trackingNumber}`, JSON.stringify(deliveryPayload));
            const deliveryResponse = await fetch(`https://api.optimoroute.com/v1/create_order?key=${optimoRouteApiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(deliveryPayload)
            });

            const deliveryResult = await deliveryResponse.json();
            console.log(`Delivery response for ${trackingNumber}:`, JSON.stringify(deliveryResult));

            if (deliveryResult.success && deliveryResult.id) {
              updateData.optimoroute_delivery_id = deliveryResult.id;
              orderSynced = true;
            } else {
              console.error(`Delivery creation failed for ${trackingNumber}:`, deliveryResult);
              errors.push(`${trackingNumber}-DELIVERY: ${deliveryResult.message || 'Unknown error'}`);
            }
          }
        }

        // Update order with OptimoRoute IDs
        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabase
            .from('orders')
            .update(updateData)
            .eq('id', order.id);

          if (updateError) {
            console.error(`Failed to update order ${order.id}:`, updateError);
          }
        }

        if (orderSynced) {
          synced++;
        } else if (order.optimoroute_pickup_id && order.optimoroute_delivery_id) {
          console.log(`Order ${trackingNumber} already fully synced, skipping`);
          skipped++;
        } else if (!updateData.optimoroute_pickup_id && !updateData.optimoroute_delivery_id) {
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
