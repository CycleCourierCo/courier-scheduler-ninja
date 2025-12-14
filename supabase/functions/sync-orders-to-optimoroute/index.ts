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
    const errorsByType: Record<string, string[]> = {
      geocoding: [],
      relatedId: [],
      other: []
    };

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
        let pickupCreatedThisSync = false;
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

          // Warn if no coordinates available
          const hasCoordinates = (senderAddress.lat && senderAddress.lon) || 
                                 (senderAddress.latitude && senderAddress.longitude);
          if (!hasCoordinates) {
            console.warn(`Order ${trackingNumber}: Sender address has no coordinates, geocoding may fail`);
          }

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

            // date = order creation date (REQUIRED)
            pickupPayload.date = formatDate(order.created_at) || getTodayDate();

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
              pickupCreatedThisSync = true;
              orderSynced = true;
            } else {
              console.error(`Pickup creation failed for ${trackingNumber}:`, pickupResult);
              const errorMsg = pickupResult.message || 'Unknown error';
              // Categorize error
              if (errorMsg.toLowerCase().includes('geocod') || errorMsg.toLowerCase().includes('address')) {
                errorsByType.geocoding.push(`${trackingNumber}-PICKUP: ${errorMsg}`);
              } else {
                errorsByType.other.push(`${trackingNumber}-PICKUP: ${errorMsg}`);
              }
              // Mark pickup as failed - don't try to link delivery
              pickupId = null;
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

          // Warn if no coordinates available
          const hasCoordinates = (receiverAddress.lat && receiverAddress.lon) || 
                                 (receiverAddress.latitude && receiverAddress.longitude);
          if (!hasCoordinates) {
            console.warn(`Order ${trackingNumber}: Receiver address has no coordinates, geocoding may fail`);
          }

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

            // date = order creation date (REQUIRED)
            deliveryPayload.date = formatDate(order.created_at) || getTodayDate();

            // ONLY link to pickup if:
            // 1. We have a valid pickup ID AND
            // 2. Either the pickup was created this sync OR it already existed in DB
            // Do NOT link if pickup creation failed this sync
            if (pickupId && (pickupCreatedThisSync || order.optimoroute_pickup_id)) {
              deliveryPayload.relatedOrderNo = pickupOrderNo;
              deliveryPayload.relatedId = pickupId;
            }
            // If order is already collected, no pickup linkage needed

            console.log(`Creating delivery for ${trackingNumber}`, JSON.stringify(deliveryPayload));
            let deliveryResponse = await fetch(`https://api.optimoroute.com/v1/create_order?key=${optimoRouteApiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(deliveryPayload)
            });

            let deliveryResult = await deliveryResponse.json();
            console.log(`Delivery response for ${trackingNumber}:`, JSON.stringify(deliveryResult));

            // Handle stale relatedId - if OptimoRoute says pickup doesn't exist, retry without linking
            if (!deliveryResult.success && deliveryResult.message?.includes('relatedId does not exist')) {
              console.warn(`${trackingNumber}: Stale pickup ID detected, clearing and retrying delivery without link`);
              
              // Clear stale pickup ID from update data
              updateData.optimoroute_pickup_id = null;
              
              // Remove pickup linking from payload
              delete deliveryPayload.relatedOrderNo;
              delete deliveryPayload.relatedId;
              
              // Retry delivery creation without linking
              console.log(`Retrying delivery for ${trackingNumber} without pickup link`);
              deliveryResponse = await fetch(`https://api.optimoroute.com/v1/create_order?key=${optimoRouteApiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(deliveryPayload)
              });
              
              deliveryResult = await deliveryResponse.json();
              console.log(`Delivery retry response for ${trackingNumber}:`, JSON.stringify(deliveryResult));
            }

            if (deliveryResult.success && deliveryResult.id) {
              updateData.optimoroute_delivery_id = deliveryResult.id;
              orderSynced = true;
            } else {
              console.error(`Delivery creation failed for ${trackingNumber}:`, deliveryResult);
              const errorMsg = deliveryResult.message || 'Unknown error';
              // Categorize error
              if (errorMsg.toLowerCase().includes('geocod') || errorMsg.toLowerCase().includes('address')) {
                errorsByType.geocoding.push(`${trackingNumber}-DELIVERY: ${errorMsg}`);
              } else if (errorMsg.toLowerCase().includes('relatedid')) {
                errorsByType.relatedId.push(`${trackingNumber}-DELIVERY: ${errorMsg}`);
              } else {
                errorsByType.other.push(`${trackingNumber}-DELIVERY: ${errorMsg}`);
              }
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
        } else {
          // Determine what this order actually needs
          const needsPickup = !orderCollected && !order.optimoroute_pickup_id;
          const needsDelivery = !order.optimoroute_delivery_id;
          const gotPickup = !!updateData.optimoroute_pickup_id;
          const gotDelivery = !!updateData.optimoroute_delivery_id;
          
          if (!needsPickup && !needsDelivery) {
            // Fully synced or doesn't need more work
            console.log(`Order ${trackingNumber} already fully synced, skipping`);
            skipped++;
          } else if ((needsPickup && !gotPickup && !order.optimoroute_pickup_id) || 
                     (needsDelivery && !gotDelivery && !order.optimoroute_delivery_id)) {
            // Needed something and didn't get it - check if there was an actual error logged
            // Only count as failed if we actually tried and failed (errors were logged above)
            const hasErrors = errorsByType.geocoding.some(e => e.includes(trackingNumber)) ||
                              errorsByType.relatedId.some(e => e.includes(trackingNumber)) ||
                              errorsByType.other.some(e => e.includes(trackingNumber));
            if (hasErrors) {
              failed++;
            } else {
              // No errors logged, order is in a valid waiting state
              console.log(`Order ${trackingNumber} in partial sync state, skipping`);
              skipped++;
            }
          } else {
            // Partial progress made or waiting state
            skipped++;
          }
        }

      } catch (orderError) {
        console.error(`Error processing order ${order.id}:`, orderError);
        errorsByType.other.push(`${order.tracking_number || order.id}: ${orderError.message}`);
        failed++;
      }
    }

    // Build error summary with categorization
    const allErrors: string[] = [];
    if (errorsByType.geocoding.length > 0) {
      allErrors.push(`=== GEOCODING ERRORS (${errorsByType.geocoding.length}) ===`);
      allErrors.push(...errorsByType.geocoding.slice(0, 5));
    }
    if (errorsByType.relatedId.length > 0) {
      allErrors.push(`=== RELATED ID ERRORS (${errorsByType.relatedId.length}) ===`);
      allErrors.push(...errorsByType.relatedId.slice(0, 5));
    }
    if (errorsByType.other.length > 0) {
      allErrors.push(`=== OTHER ERRORS (${errorsByType.other.length}) ===`);
      allErrors.push(...errorsByType.other.slice(0, 5));
    }

    const summary = {
      success: true,
      synced,
      skipped,
      failed,
      total: orders?.length || 0,
      errorCounts: {
        geocoding: errorsByType.geocoding.length,
        relatedId: errorsByType.relatedId.length,
        other: errorsByType.other.length
      },
      errors: allErrors.length > 0 ? allErrors : undefined
    };

    console.log('Sync complete:', JSON.stringify(summary, null, 2));

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
