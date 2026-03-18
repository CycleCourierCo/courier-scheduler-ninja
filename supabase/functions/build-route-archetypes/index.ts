import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { requireAdminOrCronAuth, createAuthErrorResponse } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEPOT = { lat: 52.4690197, lon: -1.8757663 };

// ============================================================
// GEO & SCORING UTILITIES (will be reused in predict-routes-v2)
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

/** Compute bearing from depot to a point (degrees 0-360) */
function bearingFromDepot(lat: number, lon: number): number {
  const dLon = (lon - DEPOT.lon) * Math.PI / 180;
  const lat1 = DEPOT.lat * Math.PI / 180;
  const lat2 = lat * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

/** Check if two bearings are compatible (within threshold degrees) */
function bearingsCompatible(a: number, b: number, threshold = 120): boolean {
  const diff = Math.abs(a - b);
  const angleDiff = Math.min(diff, 360 - diff);
  return angleDiff <= threshold;
}

/** Jaccard similarity between two string arrays */
function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter(x => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/** Compute compactness metrics for a set of stops */
function computeCompactness(stops: Array<{ lat: number; lon: number }>): {
  spreadKm: number;
  maxPairwiseKm: number;
  stopsPerKmRadius: number;
} {
  if (stops.length <= 1) return { spreadKm: 0, maxPairwiseKm: 0, stopsPerKmRadius: stops.length };

  const centLat = stops.reduce((s, p) => s + p.lat, 0) / stops.length;
  const centLon = stops.reduce((s, p) => s + p.lon, 0) / stops.length;

  let maxPairwise = 0;
  let maxFromCentroid = 0;

  for (let i = 0; i < stops.length; i++) {
    const distFromCent = haversineKm(stops[i].lat, stops[i].lon, centLat, centLon);
    if (distFromCent > maxFromCentroid) maxFromCentroid = distFromCent;
    for (let j = i + 1; j < stops.length; j++) {
      const d = haversineKm(stops[i].lat, stops[i].lon, stops[j].lat, stops[j].lon);
      if (d > maxPairwise) maxPairwise = d;
    }
  }

  return {
    spreadKm: maxFromCentroid,
    maxPairwiseKm: maxPairwise,
    stopsPerKmRadius: maxFromCentroid > 0 ? stops.length / maxFromCentroid : stops.length,
  };
}

/** Compute corridor bearing for a set of stops relative to depot */
function computeCorridorBearing(stops: Array<{ lat: number; lon: number }>): number {
  if (stops.length === 0) return 0;
  const centLat = stops.reduce((s, p) => s + p.lat, 0) / stops.length;
  const centLon = stops.reduce((s, p) => s + p.lon, 0) / stops.length;
  return bearingFromDepot(centLat, centLon);
}

/**
 * Score a stop group against an archetype (0-1 similarity)
 * Weights: region overlap 40%, centroid proximity 25%, postcode overlap 20%, stop count 15%
 */
function scoreStopGroupAgainstArchetype(
  group: { regions: string[]; centroidLat: number; centroidLon: number; postcodePrefixes: string[]; stopCount: number },
  archetype: { regions: string[]; centroid_lat: number; centroid_lon: number; postcode_prefixes: string[]; avg_stop_count: number }
): number {
  // Region overlap (Jaccard)
  const regionScore = jaccard(group.regions, archetype.regions);

  // Centroid proximity (inverse distance, capped at 50km)
  const centDist = haversineKm(group.centroidLat, group.centroidLon, archetype.centroid_lat, archetype.centroid_lon);
  const proximityScore = Math.max(0, 1 - centDist / 50);

  // Postcode prefix overlap (Jaccard)
  const postcodeScore = jaccard(group.postcodePrefixes, archetype.postcode_prefixes);

  // Stop count similarity
  const maxCount = Math.max(group.stopCount, archetype.avg_stop_count, 1);
  const countScore = 1 - Math.abs(group.stopCount - archetype.avg_stop_count) / maxCount;

  return regionScore * 0.4 + proximityScore * 0.25 + postcodeScore * 0.2 + countScore * 0.15;
}

// ============================================================
// ARCHETYPE BUILDING
// ============================================================

interface HistoricalRoute {
  id: string;
  route_date: string;
  driver_name: string;
  route_type: string;
  stop_count: number;
  regions: string[];
  centroid_lat: number;
  centroid_lon: number;
  spread_km: number;
  corridor_bearing: number;
  postcode_prefixes: string[];
}

interface ArchetypeCandidate {
  label: string;
  regions: string[];
  centroid_lat: number;
  centroid_lon: number;
  corridor_bearing: number;
  postcode_prefixes: string[];
  members: Array<{ route_id: string; similarity: number }>;
  spread_kms: number[];
  stop_counts: number[];
}

function buildArchetypes(routes: HistoricalRoute[]): ArchetypeCandidate[] {
  if (routes.length === 0) return [];

  // Sort by primary region then bearing for deterministic grouping
  const sorted = [...routes].sort((a, b) => {
    const regionA = a.regions[0] || '';
    const regionB = b.regions[0] || '';
    if (regionA !== regionB) return regionA.localeCompare(regionB);
    return a.corridor_bearing - b.corridor_bearing;
  });

  const archetypes: ArchetypeCandidate[] = [];

  for (const route of sorted) {
    let bestMatch: { idx: number; score: number } | null = null;

    for (let i = 0; i < archetypes.length; i++) {
      const arch = archetypes[i];

      // Region overlap >= 50%
      const regionOverlap = jaccard(route.regions, arch.regions);
      if (regionOverlap < 0.5) continue;

      // Centroid distance < 30km
      const centDist = haversineKm(route.centroid_lat, route.centroid_lon, arch.centroid_lat, arch.centroid_lon);
      if (centDist > 30) continue;

      // Bearing difference < 45°
      if (!bearingsCompatible(route.corridor_bearing, arch.corridor_bearing, 45)) continue;

      const score = regionOverlap * 0.5 + (1 - centDist / 30) * 0.3 + (1 - Math.min(Math.abs(route.corridor_bearing - arch.corridor_bearing), 360 - Math.abs(route.corridor_bearing - arch.corridor_bearing)) / 45) * 0.2;

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { idx: i, score };
      }
    }

    if (bestMatch) {
      // Add to existing archetype
      const arch = archetypes[bestMatch.idx];
      arch.members.push({ route_id: route.id, similarity: bestMatch.score });
      arch.spread_kms.push(route.spread_km);
      arch.stop_counts.push(route.stop_count);

      // Merge regions and postcodes
      const allRegions = new Set([...arch.regions, ...route.regions]);
      arch.regions = [...allRegions];
      const allPostcodes = new Set([...arch.postcode_prefixes, ...route.postcode_prefixes]);
      arch.postcode_prefixes = [...allPostcodes];

      // Update centroid as running average
      const n = arch.members.length;
      arch.centroid_lat = (arch.centroid_lat * (n - 1) + route.centroid_lat) / n;
      arch.centroid_lon = (arch.centroid_lon * (n - 1) + route.centroid_lon) / n;
      arch.corridor_bearing = computeCorridorBearing([
        { lat: arch.centroid_lat, lon: arch.centroid_lon },
      ]);
    } else {
      // Create new archetype
      archetypes.push({
        label: '', // Generated below
        regions: [...route.regions],
        centroid_lat: route.centroid_lat,
        centroid_lon: route.centroid_lon,
        corridor_bearing: route.corridor_bearing,
        postcode_prefixes: [...route.postcode_prefixes],
        members: [{ route_id: route.id, similarity: 1.0 }],
        spread_kms: [route.spread_km],
        stop_counts: [route.stop_count],
      });
    }
  }

  // Generate labels
  for (const arch of archetypes) {
    const primaryRegion = arch.regions[0] || 'Unknown';
    // Find most common postcode prefix
    const prefixCounts = new Map<string, number>();
    for (const prefix of arch.postcode_prefixes) {
      prefixCounts.set(prefix, (prefixCounts.get(prefix) || 0) + 1);
    }
    const dominantPrefix = [...prefixCounts.entries()]
      .sort((a, b) => b[1] - a[1])[0]?.[0] || '';

    arch.label = `${primaryRegion}-${dominantPrefix}-Corridor`;
  }

  return archetypes;
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

    console.log('Starting route archetype building...');

    // Fetch all historical routes (paginated)
    let allRoutes: HistoricalRoute[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('historical_routes')
        .select('id, route_date, driver_name, route_type, stop_count, regions, centroid_lat, centroid_lon, spread_km, corridor_bearing, postcode_prefixes')
        .range(from, from + pageSize - 1);

      if (error) throw new Error(`Failed to fetch historical routes: ${error.message}`);
      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allRoutes = allRoutes.concat(data);
        hasMore = data.length === pageSize;
        from += pageSize;
      }
    }

    console.log(`Fetched ${allRoutes.length} historical routes`);

    if (allRoutes.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No historical routes found. Run build-historical-routes first.',
        archetypes_created: 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build archetypes
    const archetypes = buildArchetypes(allRoutes);
    console.log(`Built ${archetypes.length} archetypes`);

    // Clear existing archetypes (cascade deletes members)
    await supabase.from('route_archetype_members').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('route_archetypes').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Insert archetypes and members
    let totalMembers = 0;
    const archetypeDistribution: Array<{ label: string; members: number; avg_spread: number; avg_stops: number }> = [];

    for (const arch of archetypes) {
      const avgSpread = arch.spread_kms.reduce((a, b) => a + b, 0) / arch.spread_kms.length;
      const avgStops = arch.stop_counts.reduce((a, b) => a + b, 0) / arch.stop_counts.length;

      const { data: archData, error: archError } = await supabase
        .from('route_archetypes')
        .insert({
          label: arch.label,
          regions: arch.regions,
          centroid_lat: arch.centroid_lat,
          centroid_lon: arch.centroid_lon,
          avg_spread_km: Math.round(avgSpread * 100) / 100,
          avg_stop_count: Math.round(avgStops * 10) / 10,
          corridor_bearing: Math.round(arch.corridor_bearing * 10) / 10,
          postcode_prefixes: arch.postcode_prefixes,
          member_count: arch.members.length,
        })
        .select('id')
        .single();

      if (archError) {
        console.error(`Failed to insert archetype ${arch.label}: ${archError.message}`);
        continue;
      }

      // Insert members in batches
      const memberRows = arch.members.map(m => ({
        archetype_id: archData.id,
        historical_route_id: m.route_id,
        similarity_score: Math.round(m.similarity * 1000) / 1000,
      }));

      // Insert in chunks of 100
      for (let i = 0; i < memberRows.length; i += 100) {
        const chunk = memberRows.slice(i, i + 100);
        const { error: memberError } = await supabase
          .from('route_archetype_members')
          .insert(chunk);

        if (memberError) {
          console.error(`Failed to insert members for ${arch.label}: ${memberError.message}`);
        }
      }

      totalMembers += arch.members.length;
      archetypeDistribution.push({
        label: arch.label,
        members: arch.members.length,
        avg_spread: Math.round(avgSpread * 10) / 10,
        avg_stops: Math.round(avgStops * 10) / 10,
      });
    }

    const result = {
      success: true,
      historical_routes_processed: allRoutes.length,
      archetypes_created: archetypes.length,
      total_members_assigned: totalMembers,
      distribution: archetypeDistribution.sort((a, b) => b.members - a.members),
    };

    console.log('Route archetype building complete:', JSON.stringify(result, null, 2));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in build-route-archetypes:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
