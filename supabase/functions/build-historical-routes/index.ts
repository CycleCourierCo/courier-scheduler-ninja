import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { requireAdminOrCronAuth, createAuthErrorResponse } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ============================================================
// DEPOT & UK GEOGRAPHIC REGIONS (shared with predict-routes)
// ============================================================

const DEPOT = { lat: 52.4690197, lon: -1.8757663 };

const REGION_MAP: Record<string, string> = {};
for (const p of ['B', 'WS', 'WV', 'DY', 'CV', 'NN', 'DE']) REGION_MAP[p] = 'West Midlands';
for (const p of ['M', 'WA', 'WN', 'BL', 'OL', 'SK', 'CW', 'CH', 'PR', 'L', 'FY', 'LA', 'CA']) REGION_MAP[p] = 'North West';
for (const p of ['LS', 'BD', 'HG', 'YO', 'HU', 'DN', 'S', 'HD', 'WF', 'NE', 'DH', 'SR', 'TS', 'DL', 'HX']) REGION_MAP[p] = 'North East';
for (const p of ['CB', 'PE', 'NR', 'IP', 'CO', 'SG', 'AL', 'LU', 'MK', 'CM']) REGION_MAP[p] = 'East';
for (const p of ['E', 'N', 'SE', 'SW', 'W', 'NW', 'EC', 'WC', 'BR', 'CR', 'DA', 'EN', 'HA', 'IG', 'KT', 'RM', 'SM', 'TW', 'UB', 'WD']) REGION_MAP[p] = 'London';
for (const p of ['CT', 'ME', 'TN', 'SS', 'RH', 'GU', 'BN', 'SL', 'RG', 'OX', 'HP']) REGION_MAP[p] = 'South East';
for (const p of ['BH', 'SO', 'PO', 'SP', 'BA', 'SN']) REGION_MAP[p] = 'South West Coastal';
for (const p of ['EX', 'PL', 'TQ', 'TR', 'TA', 'DT', 'GL']) REGION_MAP[p] = 'South West Deep';
for (const p of ['CF', 'SA', 'LD', 'SY', 'NP', 'LL', 'HR', 'ST']) REGION_MAP[p] = 'Wales';
for (const p of ['NG', 'LE', 'LN']) REGION_MAP[p] = 'East Midlands';

// ============================================================
// GEO UTILITIES
// ============================================================

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingFromDepot(lat: number, lon: number): number {
  const dLon = (lon - DEPOT.lon) * Math.PI / 180;
  const lat1 = DEPOT.lat * Math.PI / 180;
  const lat2 = lat * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

function extractPostcodePrefix(zipCode: string): string {
  if (!zipCode) return '';
  const match = zipCode.trim().toUpperCase().match(/^([A-Z]{1,2})/);
  return match ? match[1] : '';
}

function getRegion(prefix: string): string {
  return REGION_MAP[prefix] || 'Unknown';
}

interface StopData {
  order_id: string;
  type: 'collection' | 'delivery';
  lat: number;
  lon: number;
  postcode_prefix: string;
  region: string;
  sequence: number;
}

interface RouteGroup {
  date: string;
  driver_name: string;
  route_type: 'collection' | 'delivery';
  stops: StopData[];
}

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

    console.log('Starting historical route ingestion...');

    // Fetch all delivered orders with geocoded addresses and driver assignments
    // Use pagination to handle >1000 rows
    let allOrders: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('orders')
        .select('id, sender, receiver, scheduled_pickup_date, scheduled_delivery_date, collection_driver_name, delivery_driver_name, bike_quantity')
        .eq('status', 'delivered')
        .range(from, from + pageSize - 1);

      if (error) throw new Error(`Failed to fetch orders: ${error.message}`);
      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allOrders = allOrders.concat(data);
        hasMore = data.length === pageSize;
        from += pageSize;
      }
    }

    console.log(`Fetched ${allOrders.length} delivered orders`);

    // Group into route-days
    const routeGroups = new Map<string, RouteGroup>();

    for (const order of allOrders) {
      const sender = typeof order.sender === 'string' ? JSON.parse(order.sender) : order.sender;
      const receiver = typeof order.receiver === 'string' ? JSON.parse(order.receiver) : order.receiver;

      const senderLat = sender?.address?.lat;
      const senderLon = sender?.address?.lon;
      const receiverLat = receiver?.address?.lat;
      const receiverLon = receiver?.address?.lon;
      const senderZip = sender?.address?.zipCode || '';
      const receiverZip = receiver?.address?.zipCode || '';

      // Collection route: group by pickup date + collection driver
      if (order.scheduled_pickup_date && order.collection_driver_name && senderLat && senderLon) {
        const dateStr = order.scheduled_pickup_date.split('T')[0];
        const key = `${dateStr}|${order.collection_driver_name}|collection`;
        if (!routeGroups.has(key)) {
          routeGroups.set(key, {
            date: dateStr,
            driver_name: order.collection_driver_name,
            route_type: 'collection',
            stops: [],
          });
        }
        const prefix = extractPostcodePrefix(senderZip);
        routeGroups.get(key)!.stops.push({
          order_id: order.id,
          type: 'collection',
          lat: senderLat,
          lon: senderLon,
          postcode_prefix: prefix,
          region: getRegion(prefix),
          sequence: routeGroups.get(key)!.stops.length,
        });
      }

      // Delivery route: group by delivery date + delivery driver
      if (order.scheduled_delivery_date && order.delivery_driver_name && receiverLat && receiverLon) {
        const dateStr = order.scheduled_delivery_date.split('T')[0];
        const key = `${dateStr}|${order.delivery_driver_name}|delivery`;
        if (!routeGroups.has(key)) {
          routeGroups.set(key, {
            date: dateStr,
            driver_name: order.delivery_driver_name,
            route_type: 'delivery',
            stops: [],
          });
        }
        const prefix = extractPostcodePrefix(receiverZip);
        routeGroups.get(key)!.stops.push({
          order_id: order.id,
          type: 'delivery',
          lat: receiverLat,
          lon: receiverLon,
          postcode_prefix: prefix,
          region: getRegion(prefix),
          sequence: routeGroups.get(key)!.stops.length,
        });
      }
    }

    console.log(`Created ${routeGroups.size} route groups`);

    // Filter out routes with only 1 stop (not meaningful patterns)
    const meaningfulRoutes = Array.from(routeGroups.values()).filter(r => r.stops.length >= 2);
    console.log(`${meaningfulRoutes.length} routes with ≥2 stops`);

    let routesCreated = 0;
    let stopsCreated = 0;

    // Clear existing data for fresh rebuild
    await supabase.from('historical_route_stops').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('historical_routes').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Process in batches
    for (const route of meaningfulRoutes) {
      const stops = route.stops;
      
      // Compute centroid
      const centroidLat = stops.reduce((s, p) => s + p.lat, 0) / stops.length;
      const centroidLon = stops.reduce((s, p) => s + p.lon, 0) / stops.length;

      // Compute spread (max pairwise distance)
      let maxDist = 0;
      for (let i = 0; i < stops.length; i++) {
        for (let j = i + 1; j < stops.length; j++) {
          const d = haversineKm(stops[i].lat, stops[i].lon, stops[j].lat, stops[j].lon);
          if (d > maxDist) maxDist = d;
        }
      }

      // Compute total sequential distance
      let totalDist = 0;
      for (let i = 1; i < stops.length; i++) {
        totalDist += haversineKm(stops[i - 1].lat, stops[i - 1].lon, stops[i].lat, stops[i].lon);
      }

      // Corridor bearing from depot to centroid
      const corridorBearing = bearingFromDepot(centroidLat, centroidLon);

      // Distinct regions and postcode prefixes
      const regions = [...new Set(stops.map(s => s.region))].filter(r => r !== 'Unknown');
      const postcodePrefixes = [...new Set(stops.map(s => s.postcode_prefix))].filter(Boolean);

      // Upsert historical route
      const { data: routeData, error: routeError } = await supabase
        .from('historical_routes')
        .upsert({
          route_date: route.date,
          driver_name: route.driver_name,
          route_type: route.route_type,
          stop_count: stops.length,
          regions,
          centroid_lat: centroidLat,
          centroid_lon: centroidLon,
          spread_km: Math.round(maxDist * 100) / 100,
          corridor_bearing: Math.round(corridorBearing * 10) / 10,
          postcode_prefixes: postcodePrefixes,
          total_distance_km: Math.round(totalDist * 100) / 100,
          stops: stops,
        }, { onConflict: 'route_date,driver_name,route_type' })
        .select('id')
        .single();

      if (routeError) {
        console.error(`Failed to upsert route ${route.date}/${route.driver_name}: ${routeError.message}`);
        continue;
      }

      routesCreated++;

      // Insert denormalized stops
      const stopRows = stops.map((s, idx) => ({
        historical_route_id: routeData.id,
        order_id: s.order_id,
        type: s.type,
        lat: s.lat,
        lon: s.lon,
        postcode_prefix: s.postcode_prefix,
        region: s.region,
        sequence_order: idx,
      }));

      const { error: stopsError } = await supabase
        .from('historical_route_stops')
        .insert(stopRows);

      if (stopsError) {
        console.error(`Failed to insert stops for route ${routeData.id}: ${stopsError.message}`);
      } else {
        stopsCreated += stopRows.length;
      }
    }

    const result = {
      success: true,
      total_orders_processed: allOrders.length,
      route_groups_found: routeGroups.size,
      meaningful_routes: meaningfulRoutes.length,
      routes_created: routesCreated,
      stops_created: stopsCreated,
    };

    console.log('Historical route ingestion complete:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in build-historical-routes:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
