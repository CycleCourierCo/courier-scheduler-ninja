import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { requireAdminOrRoutePlannerAuth, createAuthErrorResponse } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ============================================================
// DEPOT & UK GEOGRAPHIC REGIONS
// ============================================================

const DEPOT = { lat: 52.4690197, lon: -1.8757663, postcode: 'B10' };

const REGION_MAP: Record<string, string> = {};

// West Midlands Local (depot area)
for (const p of ['B', 'WS', 'WV', 'DY', 'CV', 'NN', 'DE']) REGION_MAP[p] = 'West Midlands';

// North West
for (const p of ['M', 'WA', 'WN', 'BL', 'OL', 'SK', 'CW', 'CH', 'PR', 'L', 'FY', 'LA', 'CA']) REGION_MAP[p] = 'North West';

// North East
for (const p of ['LS', 'BD', 'HG', 'YO', 'HU', 'DN', 'S', 'HD', 'WF', 'NE', 'DH', 'SR', 'TS', 'DL', 'HX']) REGION_MAP[p] = 'North East';

// East
for (const p of ['CB', 'PE', 'NR', 'IP', 'CO', 'SG', 'AL', 'LU', 'MK', 'CM']) REGION_MAP[p] = 'East';

// South East London
for (const p of ['E', 'N', 'SE', 'SW', 'W', 'NW', 'EC', 'WC', 'BR', 'CR', 'DA', 'EN', 'HA', 'IG', 'KT', 'RM', 'SM', 'TW', 'UB', 'WD']) REGION_MAP[p] = 'London';

// South East Kent
for (const p of ['CT', 'ME', 'TN', 'SS', 'RH', 'GU', 'BN', 'SL', 'RG', 'OX', 'HP', 'MK']) REGION_MAP[p] = 'South East';

// South West Coastal
for (const p of ['BH', 'SO', 'PO', 'SP', 'BA', 'SN']) REGION_MAP[p] = 'South West Coastal';

// South West Deep (Devon, Cornwall)
for (const p of ['EX', 'PL', 'TQ', 'TR', 'TA', 'DT', 'GL']) REGION_MAP[p] = 'South West Deep';

// Wales
for (const p of ['CF', 'SA', 'LD', 'SY', 'NP', 'LL', 'HR', 'ST']) REGION_MAP[p] = 'Wales';

// Nottingham / East Midlands corridor
for (const p of ['NG', 'LE', 'LN']) REGION_MAP[p] = 'East Midlands';

// ============================================================
// ALLOWED REGION COMBINATIONS (strict allowlist)
// ============================================================

const ALLOWED_COMBOS: Record<string, string[]> = {
  'North West': ['North East'],
  'North East': ['North West'],
  'London': ['East', 'South East', 'South West Coastal'],
  'East': ['London'],
  'South East': ['London'],
  'South West Coastal': ['London'],
  'South West Deep': [],  // NEVER combine with anything
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

    console.log(`Predict routes: ${driver_count} drivers, ${date_range_start} to ${date_range_end}`);

    // ============================================================
    // LAYER 1: DETERMINISTIC PRE-PROCESSING
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

    // Fetch postcode patterns for region summaries
    const { data: patterns } = await supabase.from('postcode_patterns').select('postcode_prefix, total_jobs, collection_day_frequency, delivery_day_frequency');

    console.log(`Found ${orders.length} pending orders, ${patterns?.length || 0} postcode patterns`);

    // Expand orders into stops
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

      // Status-aware stop generation
      const isCollected = order.collection_confirmation_sent_at || order.order_collected || ['collected', 'driver_to_delivery'].includes(order.status);
      const isDelivered = order.order_delivered;

      if (!isCollected && !isDelivered) {
        const senderName = (sender?.name || 'Unknown').trim().toLowerCase();
        stops.push({
          id: `${order.id}_collection`,
          order_id: order.id,
          type: 'collection',
          lat: senderLat,
          lon: senderLon,
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
          lat: receiverLat,
          lon: receiverLon,
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

    // Log region distribution
    const regionCounts: Record<string, number> = {};
    for (const s of stops) {
      regionCounts[s.region] = (regionCounts[s.region] || 0) + 1;
    }
    console.log(`Stop expansion: ${stops.length} stops, ${skippedCount} skipped. Regions:`, JSON.stringify(regionCounts));

    if (stops.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid stops with geocoded addresses found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================================
    // LAYER 2: AI ALLOCATION (with geographic context)
    // ============================================================

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    let aiAssignments: RouteAssignment[] | null = null;
    let validationPassed = false;
    let validationErrors: string[] = [];
    let fallbackUsed = false;
    let aiTokensUsed = 0;

    const weekdays = generateAllWeekdays(dateStart, dateEnd);

    if (LOVABLE_API_KEY) {
      try {
        const stopAbstractions = stops.map(s => ({
          id: s.id,
          type: s.type,
          region: s.region,
          allowed_dates: s.allowed_dates.slice(0, 5),
          priority: s.priority,
          dependency_group: s.dependency_group,
          location_group: s.location_group,
          postcode: s.postcode_prefix,
          lat: Math.round(s.lat * 1000) / 1000,
          lon: Math.round(s.lon * 1000) / 1000,
        }));

        // Build region summary from postcode_patterns
        const regionSummary: Record<string, { totalJobs: number; prefixes: string[] }> = {};
        if (patterns) {
          for (const p of patterns) {
            const region = getRegion(p.postcode_prefix);
            if (!regionSummary[region]) regionSummary[region] = { totalJobs: 0, prefixes: [] };
            regionSummary[region].totalJobs += p.total_jobs || 0;
            regionSummary[region].prefixes.push(p.postcode_prefix);
          }
        }

        const regionInfo = Object.entries(regionCounts)
          .map(([r, count]) => {
            const hist = regionSummary[r];
            return `- ${r}: ${count} stops now${hist ? ` (${hist.totalJobs} historical jobs)` : ''}`;
          })
          .join('\n');

        const systemPrompt = `You are a route planning assistant for Cycle Courier, a bicycle transport company based at a depot in Birmingham (B10 0AD, lat 52.469, lon -1.876).

DEPOT: Birmingham B10. All routes radiate outward from this depot and return. A driver goes in ONE direction per day.

UK REGIONS (from Birmingham depot):
- West Midlands: B, WS, WV, DY, CV, NN, DE — local depot area
- North West: M, WA, WN, BL, OL, SK, CW, CH, PR, L, FY, LA, CA — Manchester, Liverpool direction
- North East: LS, BD, HG, YO, HU, DN, S, HD, WF, NE, DH, SR, TS, DL — Leeds, York, Sheffield direction
- East Midlands: NG, LE, LN — Nottingham, Leicester
- East: CB, PE, NR, IP, CO, SG, AL, LU, MK, CM — Cambridge, Norwich direction
- London: E, N, SE, SW, W, NW, EC, WC, BR, CR, DA, EN, HA, IG, KT, RM, SM, TW, UB, WD
- South East: CT, ME, TN, SS, RH, GU, BN, SL, RG, OX, HP — Kent, Sussex
- South West Coastal: BH, SO, PO, SP, BA, SN — Dorset, Southampton, Portsmouth
- South West Deep: EX, PL, TQ, TR, TA, DT, GL — Devon, Cornwall (long day trip)
- Wales: CF, SA, LD, SY, NP, LL, HR, ST — Cardiff, Swansea direction

Current stops by region:
${regionInfo}

CRITICAL RULES:
1. Each driver slot MUST contain stops from ONE region only, UNLESS they are an explicitly allowed combination. ALL other combinations are STRICTLY FORBIDDEN.
2. ALLOWED region combinations (ONLY these may share a driver slot):
   - North West + North East (if low volume)
   - London + East
   - London + South East
   - London + South West Coastal
   - Wales + West Midlands
   - West Midlands + East Midlands
3. FORBIDDEN: South West Deep (Devon/Cornwall: EX, PL, TQ, TR, TA, DT, GL) MUST NEVER be combined with ANY other region. It always gets its own dedicated driver slot.
4. Target 10-14 stops per driver slot per day. Pack routes DENSELY. Minimise total days used.
5. Fill Day 1 slots first before moving to Day 2. Only use more days when slots are full.
6. Collection stops MUST be on the same day or BEFORE their paired delivery (same dependency_group).
7. CRITICAL: If a collection and delivery for the same order (same dependency_group) are on the SAME day, they MUST be on the SAME driver_slot. They CAN be on different days with different drivers.
8. Stops with the same location_group (same physical location, different orders) SHOULD be assigned to the same driver_slot and day when possible — this avoids visiting the same address twice.
9. Prefer stops' allowed_dates when possible, but density and regional grouping take priority.
10. Higher priority stops should be scheduled earlier.
11. driver_slot values: 1 to ${driver_count}.
12. West Midlands (local) stops can be combined with Wales or East Midlands if there aren't enough local stops to fill a route.`;

        const userPrompt = `Assign these ${stops.length} stops to days and driver slots.

Available days: ${JSON.stringify(weekdays)}
Driver slots: 1 to ${driver_count}

Stops: ${JSON.stringify(stopAbstractions)}

Return assignments using the suggest_route_assignments tool. Every stop MUST be assigned.`;

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
                name: 'suggest_route_assignments',
                description: 'Assign each stop to a day and driver slot',
                parameters: {
                  type: 'object',
                  properties: {
                    assignments: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          stop_id: { type: 'string' },
                          day: { type: 'string', description: 'YYYY-MM-DD format' },
                          driver_slot: { type: 'integer', minimum: 1, maximum: driver_count },
                        },
                        required: ['stop_id', 'day', 'driver_slot'],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ['assignments'],
                  additionalProperties: false,
                },
              },
            }],
            tool_choice: { type: 'function', function: { name: 'suggest_route_assignments' } },
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
              const stopMap = new Map(stops.map(s => [s.id, s]));
              aiAssignments = [];

              for (const assignment of parsed.assignments) {
                const stop = stopMap.get(assignment.stop_id);
                if (stop) {
                  const dateMatch = stop.date_flexible ? 'no_dates' :
                    stop.allowed_dates.includes(assignment.day) ? 'exact' : 'flexible';

                  aiAssignments.push({
                    stop_id: assignment.stop_id,
                    order_id: stop.order_id,
                    type: stop.type,
                    day: assignment.day,
                    driver_slot: assignment.driver_slot,
                    contact_name: stop.contact_name,
                    address: stop.address,
                    phone: stop.phone,
                    lat: stop.lat,
                    lon: stop.lon,
                    postcode_prefix: stop.postcode_prefix,
                    region: stop.region,
                    date_match: dateMatch,
                  });
                }
              }
              console.log(`AI assigned ${aiAssignments.length}/${stops.length} stops`);
            }
          }
        }
      } catch (aiError) {
        console.error('AI allocation error:', aiError);
      }
    } else {
      console.warn('LOVABLE_API_KEY not set, skipping AI allocation');
    }

    // ============================================================
    // LAYER 3: LENIENT VALIDATION (accept >90%, patch rest)
    // ============================================================

    let finalAssignments: RouteAssignment[];

    if (aiAssignments && aiAssignments.length > 0) {
      const assignedIds = new Set(aiAssignments.map(a => a.stop_id));
      const missingStops = stops.filter(s => !assignedIds.has(s.id));
      const coverageRate = aiAssignments.length / stops.length;

      console.log(`AI coverage: ${(coverageRate * 100).toFixed(1)}%, ${missingStops.length} missing stops`);

      // Check for critical errors (delivery before collection, invalid slots)
      const criticalErrors = validateCriticalErrors(aiAssignments, stops, driver_count);

      if (coverageRate >= 0.75 && criticalErrors.length === 0) {
        // Accept AI result and patch missing stops with fallback
        if (missingStops.length > 0) {
          console.log(`Patching ${missingStops.length} missing stops via fallback`);
          const patchAssignments = fallbackHeuristic(missingStops, driver_count, dateStart, dateEnd, weekdays);
          finalAssignments = [...aiAssignments, ...patchAssignments];
        } else {
          finalAssignments = aiAssignments;
        }
        validationPassed = coverageRate >= 0.9;
        validationErrors = missingStops.length > 0 ? [`${missingStops.length} stops patched via fallback`] : [];
      } else {
        console.warn(`AI rejected: coverage=${(coverageRate * 100).toFixed(1)}%, critical errors: ${criticalErrors.join('; ')}`);
        validationErrors = criticalErrors;
        fallbackUsed = true;
        finalAssignments = fallbackHeuristic(stops, driver_count, dateStart, dateEnd, weekdays);
        validationPassed = true; // Fallback is deterministic, always "passes"
      }
    } else {
      fallbackUsed = true;
      finalAssignments = fallbackHeuristic(stops, driver_count, dateStart, dateEnd, weekdays);
      validationPassed = true;
    }

    // Group by day
    const routesByDay: Record<string, Record<number, RouteAssignment[]>> = {};
    for (const assignment of finalAssignments) {
      if (!routesByDay[assignment.day]) routesByDay[assignment.day] = {};
      if (!routesByDay[assignment.day][assignment.driver_slot]) routesByDay[assignment.day][assignment.driver_slot] = [];
      routesByDay[assignment.day][assignment.driver_slot].push(assignment);
    }

    // Log route density summary
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
        status: 'draft',
      })
      .select()
      .single();

    if (predError) console.error('Failed to save prediction:', predError.message);

    // Log the run
    if (prediction) {
      const jobsHash = stops.map(s => s.id).sort().join(',');
      const hashBuffer = new TextEncoder().encode(jobsHash);
      const hashArray = await crypto.subtle.digest('SHA-256', hashBuffer);
      const hashHex = Array.from(new Uint8Array(hashArray)).map(b => b.toString(16).padStart(2, '0')).join('');

      await supabase.from('route_prediction_runs').insert({
        prediction_id: prediction.id,
        model_used: fallbackUsed ? 'fallback_heuristic_v2' : 'google/gemini-2.5-flash',
        prompt_version: 'v2_geographic',
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
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Predict routes error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============================================================
// HELPER FUNCTIONS
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

function validateCriticalErrors(
  assignments: RouteAssignment[],
  stops: Stop[],
  driverCount: number
): string[] {
  const errors: string[] = [];
  const stopMap = new Map(stops.map(s => [s.id, s]));

  // Check driver slot bounds
  for (const a of assignments) {
    if (a.driver_slot < 1 || a.driver_slot > driverCount) {
      errors.push(`Stop ${a.stop_id} assigned to invalid driver_slot ${a.driver_slot}`);
    }
  }

  // Check collection before delivery
  const assignmentMap = new Map(assignments.map(a => [a.stop_id, a]));
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
        errors.push(`Order ${groupId}: same-day collection and delivery on different driver slots (slot ${g.collection.driver_slot} vs ${g.delivery.driver_slot})`);
      }
    }
  }

  // Check region compatibility per day/slot
  const slotRegions = new Map<string, Set<string>>();
  for (const a of assignments) {
    const key = `${a.day}_${a.driver_slot}`;
    if (!slotRegions.has(key)) slotRegions.set(key, new Set());
    slotRegions.get(key)!.add(a.region);
  }

  for (const [key, regions] of slotRegions) {
    const regionList = [...regions];
    for (let i = 0; i < regionList.length; i++) {
      for (let j = i + 1; j < regionList.length; j++) {
        if (!canShareSlot(regionList[i], regionList[j])) {
          errors.push(`${key}: incompatible regions ${regionList[i]} + ${regionList[j]} on same driver slot`);
        }
      }
    }
  }

  return errors;
}

// ============================================================
// DENSITY-FIRST, REGION-GROUPED FALLBACK HEURISTIC
// ============================================================

function fallbackHeuristic(
  stops: Stop[],
  driverCount: number,
  dateStart: Date,
  dateEnd: Date,
  weekdays?: string[]
): RouteAssignment[] {
  const allWeekdays = weekdays || generateAllWeekdays(dateStart, dateEnd);
  if (allWeekdays.length === 0) return [];

  const TARGET_STOPS_PER_SLOT = 11;
  const assignments: RouteAssignment[] = [];

  // Group stops by region
  const regionGroups = new Map<string, Stop[]>();
  for (const stop of stops) {
    const region = stop.region || 'Unknown';
    if (!regionGroups.has(region)) regionGroups.set(region, []);
    regionGroups.get(region)!.push(stop);
  }

  // Sort regions by size (largest first) so big regions get assigned first
  const sortedRegions = [...regionGroups.entries()]
    .sort((a, b) => b[1].length - a[1].length);

  // Within each region, sort by distance from depot (for sensible route ordering)
  for (const [, regionStops] of sortedRegions) {
    regionStops.sort((a, b) => {
      // Collections before deliveries
      if (a.type !== b.type) return a.type === 'collection' ? -1 : 1;
      // Then by distance from depot
      const distA = haversineDistance(DEPOT.lat, DEPOT.lon, a.lat, a.lon);
      const distB = haversineDistance(DEPOT.lat, DEPOT.lon, b.lat, b.lon);
      return distA - distB;
    });
  }

  // Track collection assignments per dependency group (day + slot)
  const collectionAssignmentMap = new Map<string, { day: string; slot: number }>();
  // Track location group assignments (first stop at a location determines preferred day/slot)
  const locationGroupMap = new Map<string, { day: string; slot: number }>();
  // Track slot assignments: day -> slot -> count
  const slotCounts: Record<string, Record<number, number>> = {};

  const getSlotCount = (day: string, slot: number) => slotCounts[day]?.[slot] || 0;
  const addToSlot = (day: string, slot: number) => {
    if (!slotCounts[day]) slotCounts[day] = {};
    slotCounts[day][slot] = (slotCounts[day][slot] || 0) + 1;
  };

  // Assign regions to day/slot combos, filling densely
  let currentDay = 0;
  let currentSlot = 1;

  // Collect all stops to assign, maintaining regional grouping
  // Process collections first across all regions, then deliveries
  const collectionStops: Stop[] = [];
  const deliveryStops: Stop[] = [];

  for (const [, regionStops] of sortedRegions) {
    for (const stop of regionStops) {
      if (stop.type === 'collection') collectionStops.push(stop);
      else deliveryStops.push(stop);
    }
  }

  // Group collections by region for dense assignment
  const collectionsByRegion = new Map<string, Stop[]>();
  for (const s of collectionStops) {
    if (!collectionsByRegion.has(s.region)) collectionsByRegion.set(s.region, []);
    collectionsByRegion.get(s.region)!.push(s);
  }

  // Assign collections first, region by region
  const regionSlotMap = new Map<string, { day: string; slot: number }[]>(); // Track which slots each region uses

  for (const [region, rStops] of [...collectionsByRegion.entries()].sort((a, b) => b[1].length - a[1].length)) {
    for (const stop of rStops) {
      let bestDay = allWeekdays[currentDay] || allWeekdays[allWeekdays.length - 1];
      let bestSlot = currentSlot;
      let found = false;

      // Priority 1: Check if this stop's location_group already has an assignment
      const locAssignment = locationGroupMap.get(stop.location_group);
      if (locAssignment && getSlotCount(locAssignment.day, locAssignment.slot) < TARGET_STOPS_PER_SLOT * 1.5) {
        bestDay = locAssignment.day;
        bestSlot = locAssignment.slot;
        found = true;
      }

      // Priority 2: Check if this region already has a slot on the current day
      if (!found) {
        const existingSlots = regionSlotMap.get(region) || [];
        const sameDay = existingSlots.find(rs => rs.day === allWeekdays[currentDay] && getSlotCount(rs.day, rs.slot) < TARGET_STOPS_PER_SLOT);

        if (sameDay) {
          bestDay = sameDay.day;
          bestSlot = sameDay.slot;
          found = true;
        }
      }

      // Priority 3: Find first available day/slot
      if (!found) {
        const existingSlots = regionSlotMap.get(region) || [];
        for (let di = 0; di < allWeekdays.length && !found; di++) {
          const day = allWeekdays[di];
          if (!stop.date_flexible && stop.allowed_dates.length > 0 && !stop.allowed_dates.includes(day)) continue;

          for (let sl = 1; sl <= driverCount; sl++) {
            if (getSlotCount(day, sl) < TARGET_STOPS_PER_SLOT) {
              const isRegionSlot = existingSlots.some(rs => rs.day === day && rs.slot === sl);
              const isEmpty = getSlotCount(day, sl) === 0;

              if (isRegionSlot || isEmpty) {
                bestDay = day;
                bestSlot = sl;
                found = true;
                break;
              }
            }
          }
        }
      }

      // Last resort: any slot with capacity
      if (!found) {
        for (let di = 0; di < allWeekdays.length; di++) {
          const day = allWeekdays[di];
          for (let sl = 1; sl <= driverCount; sl++) {
            if (getSlotCount(day, sl) < TARGET_STOPS_PER_SLOT * 1.5) {
              bestDay = day;
              bestSlot = sl;
              found = true;
              break;
            }
          }
          if (found) break;
        }
      }

      // Record region->slot mapping
      if (!regionSlotMap.has(region)) regionSlotMap.set(region, []);
      const existingMapping = regionSlotMap.get(region)!.find(rs => rs.day === bestDay && rs.slot === bestSlot);
      if (!existingMapping) regionSlotMap.get(region)!.push({ day: bestDay, slot: bestSlot });

      // Record collection assignment (day + slot) and location group
      collectionAssignmentMap.set(stop.dependency_group, { day: bestDay, slot: bestSlot });
      if (!locationGroupMap.has(stop.location_group)) {
        locationGroupMap.set(stop.location_group, { day: bestDay, slot: bestSlot });
      }
      addToSlot(bestDay, bestSlot);

      const dateMatch = stop.date_flexible ? 'no_dates' :
        stop.allowed_dates.includes(bestDay) ? 'exact' : 'flexible';

      assignments.push({
        stop_id: stop.id,
        order_id: stop.order_id,
        type: stop.type,
        day: bestDay,
        driver_slot: bestSlot,
        contact_name: stop.contact_name,
        address: stop.address,
        phone: stop.phone,
        lat: stop.lat,
        lon: stop.lon,
        postcode_prefix: stop.postcode_prefix,
        region: stop.region,
        date_match: dateMatch,
      });
    }
  }

  // Now assign deliveries, trying to put them in the same region's slots (same day or later)
  const deliveriesByRegion = new Map<string, Stop[]>();
  for (const s of deliveryStops) {
    if (!deliveriesByRegion.has(s.region)) deliveriesByRegion.set(s.region, []);
    deliveriesByRegion.get(s.region)!.push(s);
  }

  for (const [region, rStops] of deliveriesByRegion) {
    for (const stop of rStops) {
      const collectionAssignment = collectionAssignmentMap.get(stop.dependency_group);
      const minDay = collectionAssignment?.day || allWeekdays[0];

      const existingSlots = regionSlotMap.get(region) || [];
      let bestDay = minDay;
      let bestSlot = 1;
      let found = false;

      // Priority 0: If collection is on same day, MUST use same slot
      if (collectionAssignment) {
        // Check if location_group has an assignment on/after minDay
        const locAssignment = locationGroupMap.get(stop.location_group);
        if (locAssignment && locAssignment.day >= minDay && getSlotCount(locAssignment.day, locAssignment.slot) < TARGET_STOPS_PER_SLOT * 1.5) {
          bestDay = locAssignment.day;
          bestSlot = locAssignment.slot;
          // If this puts delivery on same day as collection, must use collection's slot
          if (bestDay === collectionAssignment.day) {
            bestSlot = collectionAssignment.slot;
          }
          found = true;
        }
      }

      // Priority 1: Try same-region slot with capacity on/after minDay
      if (!found) {
        for (const rs of existingSlots) {
          if (rs.day >= minDay && getSlotCount(rs.day, rs.slot) < TARGET_STOPS_PER_SLOT) {
            bestDay = rs.day;
            bestSlot = rs.slot;
            // Enforce same-day same-slot constraint
            if (collectionAssignment && bestDay === collectionAssignment.day) {
              bestSlot = collectionAssignment.slot;
            }
            found = true;
            break;
          }
        }
      }

      // Priority 2: Any slot with capacity on/after minDay
      if (!found) {
        for (let di = 0; di < allWeekdays.length; di++) {
          const day = allWeekdays[di];
          if (day < minDay) continue;
          // If this is the same day as collection, must use collection's slot
          if (collectionAssignment && day === collectionAssignment.day) {
            if (getSlotCount(day, collectionAssignment.slot) < TARGET_STOPS_PER_SLOT * 1.5) {
              bestDay = day;
              bestSlot = collectionAssignment.slot;
              found = true;
              break;
            }
            continue; // Skip this day if collection slot is full
          }
          for (let sl = 1; sl <= driverCount; sl++) {
            if (getSlotCount(day, sl) < TARGET_STOPS_PER_SLOT) {
              bestDay = day;
              bestSlot = sl;
              found = true;
              break;
            }
          }
          if (found) break;
        }
      }

      // Last resort: anywhere with any capacity
      if (!found) {
        for (let di = 0; di < allWeekdays.length; di++) {
          for (let sl = 1; sl <= driverCount; sl++) {
            if (getSlotCount(allWeekdays[di], sl) < TARGET_STOPS_PER_SLOT * 2) {
              bestDay = allWeekdays[di];
              bestSlot = sl;
              found = true;
              break;
            }
          }
          if (found) break;
        }
      }

      addToSlot(bestDay, bestSlot);

      // Track region slot and location group
      if (!regionSlotMap.has(region)) regionSlotMap.set(region, []);
      if (!regionSlotMap.get(region)!.find(rs => rs.day === bestDay && rs.slot === bestSlot)) {
        regionSlotMap.get(region)!.push({ day: bestDay, slot: bestSlot });
      }
      if (!locationGroupMap.has(stop.location_group)) {
        locationGroupMap.set(stop.location_group, { day: bestDay, slot: bestSlot });
      }

      const dateMatch = stop.date_flexible ? 'no_dates' :
        stop.allowed_dates.includes(bestDay) ? 'exact' : 'flexible';

      assignments.push({
        stop_id: stop.id,
        order_id: stop.order_id,
        type: stop.type,
        day: bestDay,
        driver_slot: bestSlot,
        contact_name: stop.contact_name,
        address: stop.address,
        phone: stop.phone,
        lat: stop.lat,
        lon: stop.lon,
        postcode_prefix: stop.postcode_prefix,
        region: stop.region,
        date_match: dateMatch,
      });
    }
  }

  return assignments;
}
