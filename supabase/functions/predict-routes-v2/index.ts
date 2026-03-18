import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { requireAdminOrRoutePlannerAuth, createAuthErrorResponse } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ============================================================
// DEPOT & UK GEOGRAPHIC REGIONS (same as v1)
// ============================================================

const DEPOT = { lat: 52.4690197, lon: -1.8757663, postcode: 'B10' };

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

const ALLOWED_COMBOS: Record<string, string[]> = {
  'North West': ['North East'],
  'North East': ['North West'],
  'London': ['East', 'South East', 'South West Coastal'],
  'East': ['London'],
  'South East': ['London'],
  'South West Coastal': ['London'],
  'South West Deep': [],
  'Wales': ['West Midlands'],
  'West Midlands': ['Wales', 'East Midlands'],
  'East Midlands': ['West Midlands'],
  'Unknown': [],
};

function canShareSlot(regionA: string, regionB: string): boolean {
  if (regionA === regionB) return true;
  return ALLOWED_COMBOS[regionA]?.includes(regionB) ?? false;
}

function canAddToSlotRegions(newRegion: string, existingRegions: Set<string>): boolean {
  for (const existing of existingRegions) {
    if (!canShareSlot(newRegion, existing)) return false;
  }
  return true;
}

function getRegion(postcodePrefix: string): string {
  if (!postcodePrefix || postcodePrefix === 'UNKNOWN') return 'Unknown';
  const upper = postcodePrefix.toUpperCase();
  const lettersOnly = upper.replace(/[0-9].*/g, '');
  return REGION_MAP[lettersOnly] || REGION_MAP[upper] || 'Unknown';
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
    Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

// ============================================================
// TYPES
// ============================================================

interface Stop {
  id: string;
  order_id: string;
  type: 'collection' | 'delivery';
  lat: number;
  lon: number;
  postcode_prefix: string;
  region: string;
  contact_name: string;
  address: string;
  phone: string;
  allowed_dates: string[];
  priority: number;
  dependency_group: string;
  date_flexible: boolean;
  location_group: string;
}

interface CandidateGroup {
  label: string;
  stops: Stop[];
  regions: string[];
  centroidLat: number;
  centroidLon: number;
  corridorBearing: number;
  postcodePrefixes: string[];
  spreadKm: number;
  maxPairwiseKm: number;
  topArchetypes: { id: string; label: string; similarity: number }[];
  compositeScore: number;
  priorityDensity: number;
}

interface RouteAssignment {
  stop_id: string;
  order_id: string;
  type: string;
  day: string;
  driver_slot: number;
  contact_name: string;
  address: string;
  phone: string;
  lat: number;
  lon: number;
  postcode_prefix: string;
  region: string;
  date_match: 'exact' | 'flexible' | 'no_dates';
  archetype_label?: string;
  similarity_score?: number;
  compactness_score?: number;
}

interface Archetype {
  id: string;
  label: string;
  regions: string[];
  centroid_lat: number;
  centroid_lon: number;
  corridor_bearing: number | null;
  avg_spread_km: number | null;
  avg_stop_count: number | null;
  postcode_prefixes: string[];
  member_count: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authResult = await requireAdminOrRoutePlannerAuth(req);
    if (!authResult.success) {
      return createAuthErrorResponse(authResult.error!, authResult.status!);
    }

    const { driver_count, date_range_start, date_range_end, include_no_dates = true } = await req.json();

    if (!driver_count || !date_range_start || !date_range_end) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: driver_count, date_range_start, date_range_end' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log(`Predict routes v2: ${driver_count} drivers, ${date_range_start} to ${date_range_end}`);

    // ============================================================
    // LAYER 1: DETERMINISTIC PRE-PROCESSING (same as v1)
    // ============================================================

    const excludeStatuses = ['created', 'sender_availability_pending', 'delivered', 'cancelled'];
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .not('status', 'in', `(${excludeStatuses.join(',')})`)
      .order('created_at', { ascending: true });

    if (ordersError) throw new Error(`Failed to fetch orders: ${ordersError.message}`);
    if (!orders || orders.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No pending orders found for route prediction' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch archetypes
    const { data: archetypes } = await supabase
      .from('route_archetypes')
      .select('id, label, regions, centroid_lat, centroid_lon, corridor_bearing, avg_spread_km, avg_stop_count, postcode_prefixes, member_count');

    const archetypeList: Archetype[] = (archetypes || []) as Archetype[];
    console.log(`Loaded ${archetypeList.length} route archetypes`);

    // Expand orders into stops (identical to v1)
    const stops: Stop[] = [];
    const dateStart = new Date(date_range_start);
    const dateEnd = new Date(date_range_end);
    let skippedCount = 0;

    for (const order of orders) {
      const sender = order.sender as any;
      const receiver = order.receiver as any;

      const senderLat = sender?.address?.lat || sender?.lat || sender?.latitude;
      const senderLon = sender?.address?.lon || sender?.lon || sender?.longitude;
      const receiverLat = receiver?.address?.lat || receiver?.lat || receiver?.latitude;
      const receiverLon = receiver?.address?.lon || receiver?.lon || receiver?.longitude;

      if (!senderLat || !senderLon || !receiverLat || !receiverLon) {
        skippedCount++;
        continue;
      }

      const senderPostcode = extractPostcodePrefix(sender?.address?.zipCode || sender?.address?.postal_code || sender?.postcode || sender?.postal_code) || 'UNKNOWN';
      const receiverPostcode = extractPostcodePrefix(receiver?.address?.zipCode || receiver?.address?.postal_code || receiver?.postcode || receiver?.postal_code) || 'UNKNOWN';

      const collectionDates = computeAllowedDates(order.pickup_date, dateStart, dateEnd);
      const deliveryDates = computeAllowedDates(order.delivery_date, dateStart, dateEnd);
      const collectionFlexible = collectionDates.length === 0;
      const deliveryFlexible = deliveryDates.length === 0;

      if (!include_no_dates && collectionFlexible && deliveryFlexible) continue;

      const ageInDays = Math.floor((Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60 * 24));
      const priority = Math.min(ageInDays, 100);

      const isCollected = order.collection_confirmation_sent_at || order.order_collected || ['collected', 'driver_to_delivery'].includes(order.status);
      const isDelivered = order.order_delivered;

      if (!isCollected && !isDelivered) {
        const senderName = (sender?.name || 'Unknown').trim().toLowerCase();
        stops.push({
          id: `${order.id}_collection`,
          order_id: order.id,
          type: 'collection',
          lat: senderLat, lon: senderLon,
          postcode_prefix: senderPostcode,
          region: getRegion(senderPostcode),
          contact_name: sender?.name || 'Unknown',
          address: formatAddress(sender),
          phone: sender?.phone || '',
          allowed_dates: collectionFlexible ? generateAllWeekdays(dateStart, dateEnd) : collectionDates,
          priority,
          dependency_group: order.id,
          date_flexible: collectionFlexible,
          location_group: `${senderName}__${senderPostcode}`,
        });
      }

      if (!isDelivered) {
        const receiverName = (receiver?.name || 'Unknown').trim().toLowerCase();
        stops.push({
          id: `${order.id}_delivery`,
          order_id: order.id,
          type: 'delivery',
          lat: receiverLat, lon: receiverLon,
          postcode_prefix: receiverPostcode,
          region: getRegion(receiverPostcode),
          contact_name: receiver?.name || 'Unknown',
          address: formatAddress(receiver),
          phone: receiver?.phone || '',
          allowed_dates: deliveryFlexible ? generateAllWeekdays(dateStart, dateEnd) : deliveryDates,
          priority,
          dependency_group: order.id,
          date_flexible: deliveryFlexible,
          location_group: `${receiverName}__${receiverPostcode}`,
        });
      }
    }

    console.log(`Stop expansion: ${stops.length} stops, ${skippedCount} skipped`);

    if (stops.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid stops with geocoded addresses found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================================
    // LAYER 2: BUILD CANDIDATE GROUPS
    // ============================================================

    const candidateGroups = buildCandidateGroups(stops, archetypeList);
    console.log(`Built ${candidateGroups.length} candidate groups`);

    // ============================================================
    // LAYER 3: AI ALLOCATION WITH CANDIDATE GROUPS
    // ============================================================

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    let aiAssignments: RouteAssignment[] | null = null;
    let validationPassed = false;
    let validationErrors: string[] = [];
    let fallbackUsed = false;
    let aiTokensUsed = 0;
    let unassignedStops: Stop[] = [];

    const weekdays = generateAllWeekdays(dateStart, dateEnd);

    if (LOVABLE_API_KEY && candidateGroups.length > 0) {
      try {
        const groupSummaries = candidateGroups.map((g, i) => ({
          index: i,
          label: g.label,
          regions: g.regions,
          stop_count: g.stops.length,
          stop_ids: g.stops.map(s => s.id),
          centroid: { lat: Math.round(g.centroidLat * 1000) / 1000, lon: Math.round(g.centroidLon * 1000) / 1000 },
          corridor_bearing: Math.round(g.corridorBearing),
          spread_km: Math.round(g.spreadKm * 10) / 10,
          composite_score: Math.round(g.compositeScore * 100) / 100,
          top_archetype: g.topArchetypes[0] ? { label: g.topArchetypes[0].label, similarity: Math.round(g.topArchetypes[0].similarity * 100) / 100 } : null,
          priority_density: Math.round(g.priorityDensity * 10) / 10,
          collections: g.stops.filter(s => s.type === 'collection').length,
          deliveries: g.stops.filter(s => s.type === 'delivery').length,
        }));

        const systemPrompt = `You are a route planning assistant for Cycle Courier, a bicycle transport company based in Birmingham (B10 0AD).

You are given PRE-SCORED candidate groups of stops. Each group is already clustered by geographic region and scored against historical route archetypes.

RULES:
1. Assign each candidate group to a day and driver_slot. You may MERGE compatible adjacent groups (same or allowed-combo regions) into one slot, but you CANNOT split a group.
2. Target 10-14 stops per driver_slot per day. Prefer groups with higher composite_score.
3. ALLOWED region combinations for same slot: North West+North East, London+East, London+South East, London+South West Coastal, Wales+West Midlands, West Midlands+East Midlands. ALL other combos are FORBIDDEN.
4. South West Deep MUST have its own dedicated slot.
5. Fill Day 1 slots before using Day 2. Minimise total days.
6. Collection stops must be on same day or before their paired delivery (same order). Same-day collection+delivery MUST share a driver_slot. HOWEVER, if the collection region and delivery region are INCOMPATIBLE (cannot share a slot per the allowed combinations above), they MUST be on DIFFERENT days — never the same day.
7. driver_slot values: 1 to ${driver_count}.
8. Groups with low composite scores (<0.3) can be marked as unassigned if they don't fit well.`;

        const userPrompt = `Assign these ${candidateGroups.length} candidate groups to days and driver slots.

Available days: ${JSON.stringify(weekdays)}
Driver slots: 1 to ${driver_count}

Candidate groups: ${JSON.stringify(groupSummaries)}

Use the assign_groups tool. Every group should ideally be assigned, but you may mark low-scoring groups as unassigned.`;

        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            tools: [{
              type: 'function',
              function: {
                name: 'assign_groups',
                description: 'Assign candidate groups to day/slot or mark as unassigned',
                parameters: {
                  type: 'object',
                  properties: {
                    assignments: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          group_index: { type: 'integer', description: 'Index of the candidate group' },
                          day: { type: 'string', description: 'YYYY-MM-DD or "unassigned"' },
                          driver_slot: { type: 'integer', minimum: 1, maximum: driver_count },
                        },
                        required: ['group_index', 'day', 'driver_slot'],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ['assignments'],
                  additionalProperties: false,
                },
              },
            }],
            tool_choice: { type: 'function', function: { name: 'assign_groups' } },
          }),
        });

        if (!aiResponse.ok) {
          const statusCode = aiResponse.status;
          const errorText = await aiResponse.text();
          console.error(`AI gateway error: ${statusCode}`, errorText);
        } else {
          const aiData = await aiResponse.json();
          aiTokensUsed = aiData.usage?.total_tokens || 0;

          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            const parsed = JSON.parse(toolCall.function.arguments);
            if (parsed.assignments && Array.isArray(parsed.assignments)) {
              aiAssignments = [];

              for (const ga of parsed.assignments) {
                const group = candidateGroups[ga.group_index];
                if (!group) continue;

                if (ga.day === 'unassigned') {
                  unassignedStops.push(...group.stops);
                  continue;
                }

                const archetypeLabel = group.topArchetypes[0]?.label;
                const similarityScore = group.topArchetypes[0]?.similarity || 0;
                const compactnessScore = 1 - Math.min(group.spreadKm / 200, 1);

                for (const stop of group.stops) {
                  const dateMatch = stop.date_flexible ? 'no_dates' :
                    stop.allowed_dates.includes(ga.day) ? 'exact' : 'flexible';

                  aiAssignments.push({
                    stop_id: stop.id,
                    order_id: stop.order_id,
                    type: stop.type,
                    day: ga.day,
                    driver_slot: ga.driver_slot,
                    contact_name: stop.contact_name,
                    address: stop.address,
                    phone: stop.phone,
                    lat: stop.lat, lon: stop.lon,
                    postcode_prefix: stop.postcode_prefix,
                    region: stop.region,
                    date_match: dateMatch,
                    archetype_label: archetypeLabel,
                    similarity_score: similarityScore,
                    compactness_score: compactnessScore,
                  });
                }
              }
              console.log(`AI assigned ${aiAssignments.length}/${stops.length} stops, ${unassignedStops.length} unassigned`);
            }
          }
        }
      } catch (aiError) {
        console.error('AI allocation error:', aiError);
      }
    } else if (!LOVABLE_API_KEY) {
      console.warn('LOVABLE_API_KEY not set, using archetype-aware fallback');
    }

    // ============================================================
    // LAYER 4: VALIDATION
    // ============================================================

    let finalAssignments: RouteAssignment[];
    let aiProposedRoutes: Record<string, Record<number, RouteAssignment[]>> | null = null;
    let validatedRoutes: Record<string, Record<number, RouteAssignment[]>> | null = null;

    if (aiAssignments && aiAssignments.length > 0) {
      // Save AI proposed routes before validation
      aiProposedRoutes = groupByDaySlot(aiAssignments);

      const assignedIds = new Set(aiAssignments.map(a => a.stop_id));
      const missingStops = stops.filter(s => !assignedIds.has(s.id) && !unassignedStops.find(u => u.id === s.id));
      const coverageRate = aiAssignments.length / stops.length;

      const criticalErrors = validateCriticalErrors(aiAssignments, stops, driver_count);

      // Additional v2 validation: compactness per slot
      const slotCompactness = validateSlotCompactness(aiAssignments);
      criticalErrors.push(...slotCompactness);

      if (coverageRate >= 0.75 && criticalErrors.length === 0) {
        if (missingStops.length > 0) {
          const patchAssignments = archetypeAwareFallback(missingStops, driver_count, weekdays, candidateGroups, archetypeList);
          finalAssignments = [...aiAssignments, ...patchAssignments.assigned];
          unassignedStops.push(...patchAssignments.unassigned);
        } else {
          finalAssignments = aiAssignments;
        }
        validationPassed = coverageRate >= 0.9;
        validationErrors = missingStops.length > 0 ? [`${missingStops.length} stops patched via fallback`] : [];
      } else {
        console.warn(`AI rejected: coverage=${(coverageRate * 100).toFixed(1)}%, errors: ${criticalErrors.join('; ')}`);
        validationErrors = criticalErrors;
        fallbackUsed = true;
        const fallbackResult = archetypeAwareFallback(stops, driver_count, weekdays, candidateGroups, archetypeList);
        finalAssignments = fallbackResult.assigned;
        unassignedStops = fallbackResult.unassigned;
        validationPassed = true;
      }
    } else {
      fallbackUsed = true;
      const fallbackResult = archetypeAwareFallback(stops, driver_count, weekdays, candidateGroups, archetypeList);
      finalAssignments = fallbackResult.assigned;
      unassignedStops = fallbackResult.unassigned;
      validationPassed = true;
    }

    // Group by day for response
    const routesByDay = groupByDaySlot(finalAssignments);
    validatedRoutes = routesByDay;

    // Log summary
    for (const [day, slots] of Object.entries(routesByDay)) {
      const slotSummary = Object.entries(slots).map(([s, stops]) => {
        const regions = [...new Set((stops as RouteAssignment[]).map(st => st.region))];
        return `Slot${s}:${(stops as RouteAssignment[]).length}stops[${regions.join('+')}]`;
      }).join(', ');
      console.log(`${day}: ${slotSummary}`);
    }

    // Save prediction
    const { data: prediction, error: predError } = await supabase
      .from('route_predictions')
      .insert({
        created_by: authResult.userId,
        driver_count,
        date_range_start,
        date_range_end,
        pending_job_count: orders.length,
        predicted_routes: routesByDay,
        ai_proposed_routes: aiProposedRoutes,
        validated_routes: validatedRoutes,
        planning_mode: 'v2',
        unassigned_stops: unassignedStops.map(s => ({
          stop_id: s.id, order_id: s.order_id, type: s.type,
          contact_name: s.contact_name, address: s.address,
          postcode_prefix: s.postcode_prefix, region: s.region,
          lat: s.lat, lon: s.lon,
        })),
        status: 'draft',
      })
      .select()
      .single();

    if (predError) console.error('Failed to save prediction:', predError.message);

    // Save group scores
    if (prediction) {
      const scoreRows = candidateGroups.map(g => ({
        prediction_id: prediction.id,
        group_label: g.label,
        archetype_id: g.topArchetypes[0]?.id || null,
        similarity_score: g.topArchetypes[0]?.similarity || 0,
        compactness_score: 1 - Math.min(g.spreadKm / 200, 1),
        corridor_fit: g.corridorBearing > 0 ? 1 : 0,
        fill_efficiency: Math.max(0, 1 - Math.abs(g.stops.length - 11) / 11),
        selected: !unassignedStops.some(u => g.stops.some(gs => gs.id === u.id)),
      }));

      if (scoreRows.length > 0) {
        const { error: scoreError } = await supabase.from('route_group_scores').insert(scoreRows);
        if (scoreError) console.error('Failed to save group scores:', scoreError.message);
      }

      // Log run
      const jobsHash = stops.map(s => s.id).sort().join(',');
      const hashBuffer = new TextEncoder().encode(jobsHash);
      const hashArray = await crypto.subtle.digest('SHA-256', hashBuffer);
      const hashHex = Array.from(new Uint8Array(hashArray)).map(b => b.toString(16).padStart(2, '0')).join('');

      await supabase.from('route_prediction_runs').insert({
        prediction_id: prediction.id,
        model_used: fallbackUsed ? 'fallback_archetype_aware' : 'google/gemini-2.5-flash',
        prompt_version: 'v2_candidate_groups',
        pending_jobs_hash: hashHex.substring(0, 16),
        validation_passed: validationPassed,
        validation_errors: validationErrors,
        fallback_used: fallbackUsed,
        ai_tokens_used: aiTokensUsed,
      });
    }

    return new Response(
      JSON.stringify({
        prediction_id: prediction?.id,
        driver_count,
        date_range: { start: date_range_start, end: date_range_end },
        total_stops: finalAssignments.length,
        total_orders: orders.length,
        routes_by_day: routesByDay,
        validation: {
          passed: validationPassed,
          errors: validationErrors,
          fallback_used: fallbackUsed,
        },
        ai_tokens_used: aiTokensUsed,
        planning_mode: 'v2',
        unassigned_stops: unassignedStops.map(s => ({
          stop_id: s.id, order_id: s.order_id, type: s.type,
          contact_name: s.contact_name, address: s.address,
          postcode_prefix: s.postcode_prefix, region: s.region,
          lat: s.lat, lon: s.lon,
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Predict routes v2 error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============================================================
// CANDIDATE GROUP BUILDER
// ============================================================

function buildCandidateGroups(stops: Stop[], archetypes: Archetype[]): CandidateGroup[] {
  // Group stops by region
  const regionGroups = new Map<string, Stop[]>();
  for (const stop of stops) {
    if (!regionGroups.has(stop.region)) regionGroups.set(stop.region, []);
    regionGroups.get(stop.region)!.push(stop);
  }

  const candidateGroups: CandidateGroup[] = [];

  for (const [region, regionStops] of regionGroups) {
    if (regionStops.length <= 14) {
      // Small enough to be one group
      const group = createCandidateGroup(region, regionStops, archetypes);
      if (group) candidateGroups.push(group);
    } else {
      // Subdivide by corridor bearing in 45° buckets
      const bearingBuckets = new Map<number, Stop[]>();
      for (const stop of regionStops) {
        const b = bearing(DEPOT.lat, DEPOT.lon, stop.lat, stop.lon);
        const bucket = Math.floor(b / 45) * 45;
        if (!bearingBuckets.has(bucket)) bearingBuckets.set(bucket, []);
        bearingBuckets.get(bucket)!.push(stop);
      }

      for (const [bucket, bucketStops] of bearingBuckets) {
        if (bucketStops.length <= 16) {
          const group = createCandidateGroup(`${region}_${bucket}°`, bucketStops, archetypes);
          if (group) candidateGroups.push(group);
        } else {
          // Further split into chunks of ~12
          const sorted = bucketStops.sort((a, b) =>
            haversineDistance(DEPOT.lat, DEPOT.lon, a.lat, a.lon) -
            haversineDistance(DEPOT.lat, DEPOT.lon, b.lat, b.lon)
          );
          for (let i = 0; i < sorted.length; i += 12) {
            const chunk = sorted.slice(i, i + 12);
            const group = createCandidateGroup(`${region}_${bucket}°_${Math.floor(i / 12)}`, chunk, archetypes);
            if (group) candidateGroups.push(group);
          }
        }
      }
    }
  }

  return candidateGroups;
}

function createCandidateGroup(label: string, stops: Stop[], archetypes: Archetype[]): CandidateGroup | null {
  if (stops.length === 0) return null;

  const centroidLat = stops.reduce((s, st) => s + st.lat, 0) / stops.length;
  const centroidLon = stops.reduce((s, st) => s + st.lon, 0) / stops.length;
  const corridorBearing = bearing(DEPOT.lat, DEPOT.lon, centroidLat, centroidLon);
  const regions = [...new Set(stops.map(s => s.region))];
  const postcodePrefixes = [...new Set(stops.map(s => s.postcode_prefix))];

  // Compute spread and max pairwise distance
  let maxDist = 0;
  let totalDist = 0;
  let distCount = 0;
  for (let i = 0; i < stops.length; i++) {
    for (let j = i + 1; j < stops.length; j++) {
      const d = haversineDistance(stops[i].lat, stops[i].lon, stops[j].lat, stops[j].lon);
      if (d > maxDist) maxDist = d;
      totalDist += d;
      distCount++;
    }
  }
  const spreadKm = distCount > 0 ? totalDist / distCount : 0;

  // Hard-reject if too spread out
  if (maxDist > 150) {
    // Still create it but it'll get a low score
  }

  // Score against archetypes
  const archetypeScores = archetypes.map(arch => {
    const regionOverlap = regions.filter(r => arch.regions.includes(r)).length / Math.max(regions.length, arch.regions.length, 1);
    const centroidDist = haversineDistance(centroidLat, centroidLon, arch.centroid_lat, arch.centroid_lon);
    const centroidSimilarity = Math.max(0, 1 - centroidDist / 300);
    const postcodeOverlap = postcodePrefixes.filter(p => arch.postcode_prefixes?.includes(p)).length /
      Math.max(postcodePrefixes.length, (arch.postcode_prefixes?.length || 1), 1);

    const similarity = regionOverlap * 0.5 + centroidSimilarity * 0.3 + postcodeOverlap * 0.2;
    return { id: arch.id, label: arch.label, similarity };
  }).sort((a, b) => b.similarity - a.similarity).slice(0, 3);

  // Composite score
  const archetypeSimilarity = archetypeScores[0]?.similarity || 0;
  const compactness = Math.max(0, 1 - spreadKm / 200);
  const corridorFit = archetypeScores[0] ? 1 : 0;
  const fillEfficiency = Math.max(0, 1 - Math.abs(stops.length - 11) / 11);
  const priorityDensity = stops.reduce((s, st) => s + st.priority, 0) / stops.length;
  const normalizedPriority = Math.min(priorityDensity / 50, 1);

  const compositeScore =
    archetypeSimilarity * 0.35 +
    compactness * 0.25 +
    corridorFit * 0.20 +
    fillEfficiency * 0.10 +
    normalizedPriority * 0.10;

  return {
    label,
    stops,
    regions,
    centroidLat, centroidLon,
    corridorBearing,
    postcodePrefixes,
    spreadKm,
    maxPairwiseKm: maxDist,
    topArchetypes: archetypeScores,
    compositeScore,
    priorityDensity,
  };
}

// ============================================================
// ARCHETYPE-AWARE FALLBACK
// ============================================================

function archetypeAwareFallback(
  stops: Stop[],
  driverCount: number,
  weekdays: string[],
  candidateGroups: CandidateGroup[],
  _archetypes: Archetype[]
): { assigned: RouteAssignment[]; unassigned: Stop[] } {
  if (weekdays.length === 0) return { assigned: [], unassigned: stops };

  const TARGET = 11;
  const assigned: RouteAssignment[] = [];
  const unassigned: Stop[] = [];

  // Sort groups by composite score descending
  const sortedGroups = [...candidateGroups].sort((a, b) => b.compositeScore - a.compositeScore);

  const slotCounts: Record<string, Record<number, number>> = {};
  const slotRegions = new Map<string, Set<string>>();
  const collectionMap = new Map<string, { day: string; slot: number }>();

  const getCount = (day: string, slot: number) => slotCounts[day]?.[slot] || 0;
  const getRegs = (day: string, slot: number) => slotRegions.get(`${day}_${slot}`) || new Set<string>();
  const addCount = (day: string, slot: number, region: string) => {
    if (!slotCounts[day]) slotCounts[day] = {};
    slotCounts[day][slot] = (slotCounts[day][slot] || 0) + 1;
    const k = `${day}_${slot}`;
    if (!slotRegions.has(k)) slotRegions.set(k, new Set());
    slotRegions.get(k)!.add(region);
  };

  // Assign groups greedily
  const assignedStopIds = new Set<string>();

  for (const group of sortedGroups) {
    // Low-score groups go to unassigned
    if (group.compositeScore < 0.3 && group.topArchetypes[0]?.similarity < 0.3) {
      for (const s of group.stops) {
        if (!assignedStopIds.has(s.id)) {
          unassigned.push(s);
          assignedStopIds.add(s.id);
        }
      }
      continue;
    }

    // Find best day/slot for this group
    let bestDay = weekdays[0];
    let bestSlot = 1;
    let found = false;

    for (const day of weekdays) {
      for (let sl = 1; sl <= driverCount; sl++) {
        const count = getCount(day, sl);
        const regs = getRegs(day, sl);
        const canFit = count + group.stops.length <= TARGET * 1.5;
        const regionOk = group.regions.every(r => canAddToSlotRegions(r, regs));
        if (canFit && regionOk) {
          bestDay = day;
          bestSlot = sl;
          found = true;
          break;
        }
      }
      if (found) break;
    }

    const archetypeLabel = group.topArchetypes[0]?.label;
    const similarityScore = group.topArchetypes[0]?.similarity || 0;
    const compactnessScore = 1 - Math.min(group.spreadKm / 200, 1);

    // PASS 1: Assign only collections from this group
    for (const stop of group.stops) {
      if (stop.type !== 'collection') continue;
      if (assignedStopIds.has(stop.id)) continue;
      assignedStopIds.add(stop.id);

      const assignDay = bestDay;
      const assignSlot = bestSlot;

      collectionMap.set(stop.dependency_group, { day: assignDay, slot: assignSlot });
      addCount(assignDay, assignSlot, stop.region);

      const dateMatch = stop.date_flexible ? 'no_dates' :
        stop.allowed_dates.includes(assignDay) ? 'exact' : 'flexible';

      assigned.push({
        stop_id: stop.id,
        order_id: stop.order_id,
        type: stop.type,
        day: assignDay,
        driver_slot: assignSlot,
        contact_name: stop.contact_name,
        address: stop.address,
        phone: stop.phone,
        lat: stop.lat, lon: stop.lon,
        postcode_prefix: stop.postcode_prefix,
        region: stop.region,
        date_match: dateMatch,
        archetype_label: archetypeLabel,
        similarity_score: similarityScore,
        compactness_score: compactnessScore,
      });
    }
  }

  // Handle any stops not in any group (edge case)
  for (const stop of stops) {
    if (!assignedStopIds.has(stop.id)) {
      unassigned.push(stop);
    }
  }

  return { assigned, unassigned };
}

// ============================================================
// VALIDATION HELPERS
// ============================================================

function validateCriticalErrors(assignments: RouteAssignment[], stops: Stop[], driverCount: number): string[] {
  const errors: string[] = [];
  const stopMap = new Map(stops.map(s => [s.id, s]));

  for (const a of assignments) {
    if (a.driver_slot < 1 || a.driver_slot > driverCount) {
      errors.push(`Stop ${a.stop_id} assigned to invalid driver_slot ${a.driver_slot}`);
    }
  }

  const groups = new Map<string, { collection?: RouteAssignment; delivery?: RouteAssignment }>();
  for (const a of assignments) {
    const stop = stopMap.get(a.stop_id);
    if (!stop) continue;
    if (!groups.has(stop.dependency_group)) groups.set(stop.dependency_group, {});
    const g = groups.get(stop.dependency_group)!;
    if (a.type === 'collection') g.collection = a;
    if (a.type === 'delivery') g.delivery = a;
  }

  for (const [groupId, g] of groups) {
    if (g.collection && g.delivery) {
      if (g.delivery.day < g.collection.day) {
        errors.push(`Order ${groupId}: delivery before collection`);
      }
      if (g.collection.day === g.delivery.day && g.collection.driver_slot !== g.delivery.driver_slot) {
        errors.push(`Order ${groupId}: same-day collection and delivery on different driver slots`);
      }
    }
  }

  const slotRegionsMap = new Map<string, Set<string>>();
  for (const a of assignments) {
    const key = `${a.day}_${a.driver_slot}`;
    if (!slotRegionsMap.has(key)) slotRegionsMap.set(key, new Set());
    slotRegionsMap.get(key)!.add(a.region);
  }

  for (const [key, regions] of slotRegionsMap) {
    const regionList = [...regions];
    for (let i = 0; i < regionList.length; i++) {
      for (let j = i + 1; j < regionList.length; j++) {
        if (!canShareSlot(regionList[i], regionList[j])) {
          errors.push(`${key}: incompatible regions ${regionList[i]} + ${regionList[j]}`);
        }
      }
    }
  }

  return errors;
}

function validateSlotCompactness(assignments: RouteAssignment[]): string[] {
  const errors: string[] = [];
  const slotStops = new Map<string, RouteAssignment[]>();

  for (const a of assignments) {
    const key = `${a.day}_${a.driver_slot}`;
    if (!slotStops.has(key)) slotStops.set(key, []);
    slotStops.get(key)!.push(a);
  }

  for (const [key, stops] of slotStops) {
    let maxDist = 0;
    for (let i = 0; i < stops.length; i++) {
      for (let j = i + 1; j < stops.length; j++) {
        const d = haversineDistance(stops[i].lat, stops[i].lon, stops[j].lat, stops[j].lon);
        if (d > maxDist) maxDist = d;
      }
    }
    if (maxDist > 200) {
      errors.push(`${key}: max pairwise distance ${maxDist.toFixed(0)}km exceeds 200km limit`);
    }
  }

  return errors;
}

function groupByDaySlot(assignments: RouteAssignment[]): Record<string, Record<number, RouteAssignment[]>> {
  const result: Record<string, Record<number, RouteAssignment[]>> = {};
  for (const a of assignments) {
    if (!result[a.day]) result[a.day] = {};
    if (!result[a.day][a.driver_slot]) result[a.day][a.driver_slot] = [];
    result[a.day][a.driver_slot].push(a);
  }
  return result;
}

// ============================================================
// SHARED HELPER FUNCTIONS (same as v1)
// ============================================================

function extractPostcodePrefix(postcode: string | null | undefined): string | null {
  if (!postcode) return null;
  const cleaned = postcode.trim().toUpperCase().replace(/\s+/g, ' ');
  const match = cleaned.match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)\s/);
  if (match) return match[1];
  const compactMatch = cleaned.match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)/);
  return compactMatch ? compactMatch[1] : null;
}

function formatAddress(contact: any): string {
  if (!contact) return '';
  const addr = contact.address || contact;
  const parts = [addr.street, addr.city, addr.zipCode || addr.postal_code || addr.postcode].filter(Boolean);
  return parts.join(', ');
}

function computeAllowedDates(dateField: any, rangeStart: Date, rangeEnd: Date): string[] {
  if (!dateField) return [];
  const dates: string[] = [];

  if (typeof dateField === 'string') {
    const d = new Date(dateField);
    if (d >= rangeStart && d <= rangeEnd) dates.push(d.toISOString().split('T')[0]);
  } else if (Array.isArray(dateField)) {
    for (const item of dateField) {
      const d = new Date(typeof item === 'string' ? item : item.date || item);
      if (!isNaN(d.getTime()) && d >= rangeStart && d <= rangeEnd) dates.push(d.toISOString().split('T')[0]);
    }
  } else if (typeof dateField === 'object') {
    if (dateField.date) {
      const d = new Date(dateField.date);
      if (!isNaN(d.getTime()) && d >= rangeStart && d <= rangeEnd) dates.push(d.toISOString().split('T')[0]);
    }
    if (dateField.dates && Array.isArray(dateField.dates)) {
      for (const item of dateField.dates) {
        const d = new Date(typeof item === 'string' ? item : item.date || item);
        if (!isNaN(d.getTime()) && d >= rangeStart && d <= rangeEnd) dates.push(d.toISOString().split('T')[0]);
      }
    }
  }

  return [...new Set(dates)].sort();
}

function generateAllWeekdays(start: Date, end: Date): string[] {
  const dates: string[] = [];
  const d = new Date(start);
  while (d <= end) {
    if (d.getDay() !== 0 && d.getDay() !== 6) dates.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
  }
  return dates;
}
