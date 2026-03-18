import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { requireAdminOrRoutePlannerAuth, createAuthErrorResponse } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Stop {
  id: string;
  order_id: string;
  type: 'collection' | 'delivery';
  lat: number;
  lon: number;
  postcode_prefix: string;
  contact_name: string;
  address: string;
  phone: string;
  allowed_dates: string[];
  priority: number;
  dependency_group: string;
  cluster_id: number;
  date_flexible: boolean;
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

    // Fetch pending orders (exclude very early statuses)
    const excludeStatuses = ['created', 'sender_availability_pending', 'delivered', 'cancelled'];
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .not('status', 'in', `(${excludeStatuses.join(',')})`)
      .order('created_at', { ascending: true });

    if (ordersError) {
      throw new Error(`Failed to fetch orders: ${ordersError.message}`);
    }

    if (!orders || orders.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No pending orders found for route prediction' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${orders.length} pending orders`);

    // Expand orders into stops
    const stops: Stop[] = [];
    const dateStart = new Date(date_range_start);
    const dateEnd = new Date(date_range_end);

    for (const order of orders) {
      const sender = order.sender as any;
      const receiver = order.receiver as any;

      const senderLat = sender?.lat || sender?.latitude;
      const senderLon = sender?.lon || sender?.longitude;
      const receiverLat = receiver?.lat || receiver?.latitude;
      const receiverLon = receiver?.lon || receiver?.longitude;

      // Skip orders without geocoded addresses
      if (!senderLat || !senderLon || !receiverLat || !receiverLon) continue;

      const senderPostcode = extractPostcodePrefix(sender?.postcode || sender?.postal_code) || 'UNKNOWN';
      const receiverPostcode = extractPostcodePrefix(receiver?.postcode || receiver?.postal_code) || 'UNKNOWN';

      // Compute allowed dates from pickup_date / delivery_date fields
      const collectionDates = computeAllowedDates(order.pickup_date, dateStart, dateEnd);
      const deliveryDates = computeAllowedDates(order.delivery_date, dateStart, dateEnd);

      const collectionFlexible = collectionDates.length === 0;
      const deliveryFlexible = deliveryDates.length === 0;

      if (!include_no_dates && collectionFlexible && deliveryFlexible) continue;

      // Priority: older orders get higher priority
      const ageInDays = Math.floor((Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60 * 24));
      const priority = Math.min(ageInDays, 100);

      // Only add collection stop if not already collected
      if (!order.order_collected) {
        stops.push({
          id: `${order.id}_collection`,
          order_id: order.id,
          type: 'collection',
          lat: senderLat,
          lon: senderLon,
          postcode_prefix: senderPostcode,
          contact_name: sender?.name || 'Unknown',
          address: formatAddress(sender),
          phone: sender?.phone || '',
          allowed_dates: collectionFlexible ? generateAllWeekdays(dateStart, dateEnd) : collectionDates,
          priority,
          dependency_group: order.id,
          cluster_id: 0,
          date_flexible: collectionFlexible,
        });
      }

      // Only add delivery stop if not already delivered
      if (!order.order_delivered) {
        stops.push({
          id: `${order.id}_delivery`,
          order_id: order.id,
          type: 'delivery',
          lat: receiverLat,
          lon: receiverLon,
          postcode_prefix: receiverPostcode,
          contact_name: receiver?.name || 'Unknown',
          address: formatAddress(receiver),
          phone: receiver?.phone || '',
          allowed_dates: deliveryFlexible ? generateAllWeekdays(dateStart, dateEnd) : deliveryDates,
          priority,
          dependency_group: order.id,
          cluster_id: 0,
          date_flexible: deliveryFlexible,
        });
      }
    }

    if (stops.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid stops with geocoded addresses found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Simple geographic clustering using grid-based approach
    assignClusters(stops, driver_count * 2);

    console.log(`Pre-processed ${stops.length} stops into clusters`);

    // ============================================================
    // LAYER 2: AI ALLOCATION
    // ============================================================

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    let aiAssignments: RouteAssignment[] | null = null;
    let validationPassed = false;
    let validationErrors: string[] = [];
    let fallbackUsed = false;
    let aiTokensUsed = 0;

    if (LOVABLE_API_KEY) {
      try {
        const stopAbstractions = stops.map(s => ({
          id: s.id,
          type: s.type,
          cluster_id: s.cluster_id,
          allowed_dates: s.allowed_dates.slice(0, 5), // Limit to reduce token count
          priority: s.priority,
          dependency_group: s.dependency_group,
          lat: Math.round(s.lat * 1000) / 1000,
          lon: Math.round(s.lon * 1000) / 1000,
          postcode: s.postcode_prefix,
        }));

        const dateRange: string[] = [];
        const d = new Date(dateStart);
        while (d <= dateEnd) {
          if (d.getDay() !== 0 && d.getDay() !== 6) {
            dateRange.push(d.toISOString().split('T')[0]);
          }
          d.setDate(d.getDate() + 1);
        }

        const systemPrompt = `You are a route planning assistant for a bicycle courier company. You assign stops to days and driver slots.

RULES:
1. Collection stops MUST be scheduled on the same day or BEFORE their paired delivery stop (same dependency_group).
2. Each stop must be assigned to exactly one day and one driver_slot.
3. Stops should be assigned to days within their allowed_dates when possible.
4. Balance the number of stops across driver slots evenly.
5. Group geographically close stops (similar cluster_id) on the same driver slot.
6. Higher priority stops should be scheduled earlier in the date range.
7. driver_slot values must be between 1 and ${driver_count}.`;

        const userPrompt = `Assign these ${stops.length} stops to days and driver slots.

Available days: ${JSON.stringify(dateRange)}
Driver slots: 1 to ${driver_count}

Stops: ${JSON.stringify(stopAbstractions)}

Return assignments using the suggest_route_assignments tool.`;

        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
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
          
          if (statusCode === 429) {
            console.warn('AI rate limited, using fallback');
          } else if (statusCode === 402) {
            console.warn('AI credits exhausted, using fallback');
          }
        } else {
          const aiData = await aiResponse.json();
          aiTokensUsed = aiData.usage?.total_tokens || 0;

          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            const parsed = JSON.parse(toolCall.function.arguments);
            if (parsed.assignments && Array.isArray(parsed.assignments)) {
              // Map AI assignments back to full stop data
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
                    date_match: dateMatch,
                  });
                }
              }
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
    // LAYER 3: DETERMINISTIC VALIDATION
    // ============================================================

    if (aiAssignments && aiAssignments.length > 0) {
      const { valid, errors } = validateAssignments(aiAssignments, stops, driver_count);
      validationPassed = valid;
      validationErrors = errors;

      if (!valid) {
        console.warn(`AI validation failed with ${errors.length} errors, using fallback`);
        aiAssignments = null;
      }
    }

    // Fallback heuristic if AI failed or wasn't available
    let finalAssignments: RouteAssignment[];
    if (aiAssignments && aiAssignments.length > 0) {
      finalAssignments = aiAssignments;
    } else {
      fallbackUsed = true;
      finalAssignments = fallbackHeuristic(stops, driver_count, dateStart, dateEnd);
      
      // Validate fallback too
      const { valid, errors } = validateAssignments(finalAssignments, stops, driver_count);
      validationPassed = valid;
      validationErrors = errors;
    }

    // Group by day for the response
    const routesByDay: Record<string, Record<number, RouteAssignment[]>> = {};
    for (const assignment of finalAssignments) {
      if (!routesByDay[assignment.day]) {
        routesByDay[assignment.day] = {};
      }
      if (!routesByDay[assignment.day][assignment.driver_slot]) {
        routesByDay[assignment.day][assignment.driver_slot] = [];
      }
      routesByDay[assignment.day][assignment.driver_slot].push(assignment);
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

    if (predError) {
      console.error('Failed to save prediction:', predError.message);
    }

    // Log the run
    if (prediction) {
      const jobsHash = stops.map(s => s.id).sort().join(',');
      const hashBuffer = new TextEncoder().encode(jobsHash);
      const hashArray = await crypto.subtle.digest('SHA-256', hashBuffer);
      const hashHex = Array.from(new Uint8Array(hashArray)).map(b => b.toString(16).padStart(2, '0')).join('');

      await supabase.from('route_prediction_runs').insert({
        prediction_id: prediction.id,
        model_used: fallbackUsed ? 'fallback_heuristic' : 'google/gemini-3-flash-preview',
        prompt_version: 'v1',
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
  const parts = [contact.street, contact.city, contact.postcode || contact.postal_code].filter(Boolean);
  return parts.join(', ');
}

function computeAllowedDates(dateField: any, rangeStart: Date, rangeEnd: Date): string[] {
  if (!dateField) return [];
  
  const dates: string[] = [];
  
  if (typeof dateField === 'string') {
    const d = new Date(dateField);
    if (d >= rangeStart && d <= rangeEnd) {
      dates.push(d.toISOString().split('T')[0]);
    }
  } else if (Array.isArray(dateField)) {
    for (const item of dateField) {
      const d = new Date(typeof item === 'string' ? item : item.date || item);
      if (!isNaN(d.getTime()) && d >= rangeStart && d <= rangeEnd) {
        dates.push(d.toISOString().split('T')[0]);
      }
    }
  } else if (typeof dateField === 'object') {
    // Handle {date: "...", ...} format
    if (dateField.date) {
      const d = new Date(dateField.date);
      if (!isNaN(d.getTime()) && d >= rangeStart && d <= rangeEnd) {
        dates.push(d.toISOString().split('T')[0]);
      }
    }
    // Handle {dates: [...]} format
    if (dateField.dates && Array.isArray(dateField.dates)) {
      for (const item of dateField.dates) {
        const d = new Date(typeof item === 'string' ? item : item.date || item);
        if (!isNaN(d.getTime()) && d >= rangeStart && d <= rangeEnd) {
          dates.push(d.toISOString().split('T')[0]);
        }
      }
    }
  }

  return [...new Set(dates)].sort();
}

function generateAllWeekdays(start: Date, end: Date): string[] {
  const dates: string[] = [];
  const d = new Date(start);
  while (d <= end) {
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      dates.push(d.toISOString().split('T')[0]);
    }
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function assignClusters(stops: Stop[], numClusters: number) {
  if (stops.length === 0) return;

  // Simple grid-based clustering
  const lats = stops.map(s => s.lat);
  const lons = stops.map(s => s.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const gridSize = Math.ceil(Math.sqrt(numClusters));
  const latStep = (maxLat - minLat) / gridSize || 1;
  const lonStep = (maxLon - minLon) / gridSize || 1;

  for (const stop of stops) {
    const latBin = Math.min(Math.floor((stop.lat - minLat) / latStep), gridSize - 1);
    const lonBin = Math.min(Math.floor((stop.lon - minLon) / lonStep), gridSize - 1);
    stop.cluster_id = latBin * gridSize + lonBin;
  }
}

function validateAssignments(
  assignments: RouteAssignment[],
  stops: Stop[],
  driverCount: number
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const stopMap = new Map(stops.map(s => [s.id, s]));
  const assignedStopIds = new Set(assignments.map(a => a.stop_id));

  // Check all stops are assigned
  for (const stop of stops) {
    if (!assignedStopIds.has(stop.id)) {
      errors.push(`Stop ${stop.id} not assigned`);
    }
  }

  // Check no duplicates
  if (assignedStopIds.size !== assignments.length) {
    errors.push('Duplicate stop assignments detected');
  }

  // Check driver slot bounds
  for (const a of assignments) {
    if (a.driver_slot < 1 || a.driver_slot > driverCount) {
      errors.push(`Stop ${a.stop_id} assigned to invalid driver_slot ${a.driver_slot}`);
    }
  }

  // Check collection before delivery (same dependency group)
  const assignmentMap = new Map(assignments.map(a => [a.stop_id, a]));
  const dependencyGroups = new Map<string, { collection?: RouteAssignment; delivery?: RouteAssignment }>();

  for (const a of assignments) {
    const stop = stopMap.get(a.stop_id);
    if (!stop) continue;
    
    if (!dependencyGroups.has(stop.dependency_group)) {
      dependencyGroups.set(stop.dependency_group, {});
    }
    const group = dependencyGroups.get(stop.dependency_group)!;
    if (a.type === 'collection') group.collection = a;
    if (a.type === 'delivery') group.delivery = a;
  }

  for (const [groupId, group] of dependencyGroups) {
    if (group.collection && group.delivery) {
      if (group.delivery.day < group.collection.day) {
        errors.push(`Order ${groupId}: delivery scheduled before collection`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function fallbackHeuristic(
  stops: Stop[],
  driverCount: number,
  dateStart: Date,
  dateEnd: Date
): RouteAssignment[] {
  const assignments: RouteAssignment[] = [];
  const weekdays = generateAllWeekdays(dateStart, dateEnd);

  if (weekdays.length === 0) return assignments;

  // Sort stops: collections first, then by priority (highest first), then by cluster
  const sorted = [...stops].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'collection' ? -1 : 1;
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.cluster_id - b.cluster_id;
  });

  // Track collection day per dependency group
  const collectionDayMap = new Map<string, string>();

  // Distribute stops across days and driver slots
  const stopsPerDayPerDriver = Math.ceil(sorted.length / (weekdays.length * driverCount));
  const daySlotCounts: Record<string, Record<number, number>> = {};

  for (const stop of sorted) {
    let bestDay = weekdays[0];
    let bestSlot = 1;

    // For deliveries, ensure they're on or after collection day
    const minDay = stop.type === 'delivery' ? collectionDayMap.get(stop.dependency_group) || weekdays[0] : weekdays[0];

    // Find least-loaded day/slot combo that respects constraints
    let minCount = Infinity;
    for (const day of weekdays) {
      if (day < minDay) continue;
      
      // Prefer allowed dates
      const isAllowed = stop.allowed_dates.includes(day);
      
      for (let slot = 1; slot <= driverCount; slot++) {
        const key = `${day}_${slot}`;
        const count = (daySlotCounts[day]?.[slot] || 0);
        const adjustedCount = isAllowed ? count : count + 5; // Penalize non-preferred dates
        
        if (adjustedCount < minCount) {
          minCount = adjustedCount;
          bestDay = day;
          bestSlot = slot;
        }
      }
    }

    // Track collection day
    if (stop.type === 'collection') {
      collectionDayMap.set(stop.dependency_group, bestDay);
    }

    // Update counts
    if (!daySlotCounts[bestDay]) daySlotCounts[bestDay] = {};
    daySlotCounts[bestDay][bestSlot] = (daySlotCounts[bestDay][bestSlot] || 0) + 1;

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
      date_match: dateMatch,
    });
  }

  return assignments;
}
