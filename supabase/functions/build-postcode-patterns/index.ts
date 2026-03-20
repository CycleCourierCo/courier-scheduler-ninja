import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { requireAdminOrCronAuth, createAuthErrorResponse } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authResult = await requireAdminOrCronAuth(req);
    if (!authResult.success) {
      return createAuthErrorResponse(authResult.error!, authResult.status!);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log('Starting postcode pattern build...');

    // Fetch all completed orders (delivered + collected statuses)
    const completedStatuses = ['delivered', 'collected', 'driver_to_delivery'];
    let allOrders: any[] = [];
    let page = 0;
    const pageSize = 1000;

    while (true) {
      const { data, error } = await supabase
        .from('orders')
        .select('id, sender, receiver, pickup_date, delivery_date, scheduled_pickup_date, scheduled_delivery_date, status, created_at, updated_at')
        .in('status', completedStatuses)
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error('Error fetching orders:', error.message);
        throw new Error(`Failed to fetch orders: ${error.message}`);
      }

      if (!data || data.length === 0) break;
      allOrders = allOrders.concat(data);
      if (data.length < pageSize) break;
      page++;
    }

    console.log(`Fetched ${allOrders.length} completed orders`);

    if (allOrders.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No completed orders found', patterns_updated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract postcode prefixes and compute stats
    const postcodeMap = new Map<string, {
      jobs: number;
      daysToCollection: number[];
      daysToDelivery: number[];
      collectionDays: number[]; // 0=Sun, 6=Sat
      deliveryDays: number[];
      cancelCount: number;
      senderReceiverPairs: Map<string, number>;
    }>();

    for (const order of allOrders) {
      const senderPostcode = extractPostcodePrefix(order.sender?.address?.zipCode || order.sender?.address?.postal_code || order.sender?.postcode || order.sender?.postal_code);
      const receiverPostcode = extractPostcodePrefix(order.receiver?.address?.zipCode || order.receiver?.address?.postal_code || order.receiver?.postcode || order.receiver?.postal_code);

      if (!senderPostcode && !receiverPostcode) continue;

      // Process sender postcode
      if (senderPostcode) {
        const entry = getOrCreateEntry(postcodeMap, senderPostcode);
        entry.jobs++;

        if (order.scheduled_pickup_date) {
          const created = new Date(order.created_at);
          const pickup = new Date(order.scheduled_pickup_date);
          const daysDiff = Math.floor((pickup.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
          if (daysDiff >= 0 && daysDiff < 365) {
            entry.daysToCollection.push(daysDiff);
            entry.collectionDays.push(pickup.getDay());
          }
        }

        if (receiverPostcode) {
          const pairKey = `${senderPostcode}->${receiverPostcode}`;
          entry.senderReceiverPairs.set(pairKey, (entry.senderReceiverPairs.get(pairKey) || 0) + 1);
        }
      }

      // Process receiver postcode
      if (receiverPostcode) {
        const entry = getOrCreateEntry(postcodeMap, receiverPostcode);
        entry.jobs++;

        if (order.scheduled_delivery_date) {
          const created = new Date(order.created_at);
          const delivery = new Date(order.scheduled_delivery_date);
          const daysDiff = Math.floor((delivery.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
          if (daysDiff >= 0 && daysDiff < 365) {
            entry.daysToDelivery.push(daysDiff);
            entry.deliveryDays.push(delivery.getDay());
          }
        }
      }
    }

    console.log(`Postcode extraction: ${postcodeMap.size} unique prefixes found from ${allOrders.length} orders`);

    // Compute stats and upsert
    const patterns: any[] = [];
    for (const [prefix, data] of postcodeMap) {
      const collectionFreq: Record<string, number> = {};
      for (const day of data.collectionDays) {
        const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day];
        collectionFreq[dayName] = (collectionFreq[dayName] || 0) + 1;
      }

      const deliveryFreq: Record<string, number> = {};
      for (const day of data.deliveryDays) {
        const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day];
        deliveryFreq[dayName] = (deliveryFreq[dayName] || 0) + 1;
      }

      const topPairings = Array.from(data.senderReceiverPairs.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([pair, count]) => ({ pair, count }));

      patterns.push({
        postcode_prefix: prefix,
        total_jobs: data.jobs,
        sample_size: allOrders.length,
        median_days_to_collection: computeMedian(data.daysToCollection),
        median_days_to_delivery: computeMedian(data.daysToDelivery),
        p90_days_to_collection: computePercentile(data.daysToCollection, 90),
        p90_days_to_delivery: computePercentile(data.daysToDelivery, 90),
        collection_day_frequency: collectionFreq,
        delivery_day_frequency: deliveryFreq,
        cancel_reschedule_rate: 0,
        avg_stop_density_nearby: 0,
        common_sender_receiver_pairings: topPairings,
        weekday_route_inclusion_rate: {},
        updated_at: new Date().toISOString(),
      });
    }

    // Upsert in batches
    let upserted = 0;
    const batchSize = 50;
    for (let i = 0; i < patterns.length; i += batchSize) {
      const batch = patterns.slice(i, i + batchSize);
      const { error } = await supabase
        .from('postcode_patterns')
        .upsert(batch, { onConflict: 'postcode_prefix' });

      if (error) {
        console.error(`Upsert batch error at offset ${i}:`, error.message);
      } else {
        upserted += batch.length;
      }
    }

    console.log(`Postcode pattern build complete: ${upserted} patterns upserted`);

    return new Response(
      JSON.stringify({
        message: 'Postcode patterns built successfully',
        orders_processed: allOrders.length,
        patterns_updated: upserted,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Build postcode patterns error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function extractPostcodePrefix(postcode: string | null | undefined): string | null {
  if (!postcode) return null;
  const cleaned = postcode.trim().toUpperCase().replace(/\s+/g, ' ');
  // UK postcodes: extract the outward code (e.g., "B10" from "B10 1AA", "CV6" from "CV6 5GE")
  const match = cleaned.match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)\s/);
  if (match) return match[1];
  // If no space, try to extract prefix from compact format
  const compactMatch = cleaned.match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)/);
  return compactMatch ? compactMatch[1] : null;
}

function getOrCreateEntry(map: Map<string, any>, key: string) {
  if (!map.has(key)) {
    map.set(key, {
      jobs: 0,
      daysToCollection: [],
      daysToDelivery: [],
      collectionDays: [],
      deliveryDays: [],
      cancelCount: 0,
      senderReceiverPairs: new Map(),
    });
  }
  return map.get(key)!;
}

function computeMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function computePercentile(values: number[], percentile: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}
