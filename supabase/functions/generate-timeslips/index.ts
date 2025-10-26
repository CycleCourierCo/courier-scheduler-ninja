import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateTimeslipsRequest {
  date: string; // YYYY-MM-DD format
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { date }: GenerateTimeslipsRequest = await req.json();
    
    console.log(`Generating timeslips for date: ${date}`);

    // Get all orders scheduled for this date (pickup or delivery)
    const { data: orders, error: ordersError } = await supabaseClient
      .from('orders')
      .select('*')
      .or(`scheduled_pickup_date.eq.${date},scheduled_delivery_date.eq.${date}`);

    if (ordersError) throw ordersError;

    console.log(`Found ${orders?.length || 0} orders for ${date}`);

    // Group orders by driver (extracted from tracking_events)
    const driverJobsMap = new Map<string, any[]>();

    for (const order of orders || []) {
      const trackingEvents = order.tracking_events || [];
      
      // Extract driver names from ORDER_ASSIGNED or ORDER_ACCEPTED_AND_STARTED events
      const pickupDriver = trackingEvents
        .filter((e: any) => 
          ['ORDER_ASSIGNED', 'ORDER_ACCEPTED_AND_STARTED'].includes(e.event_name) && 
          e.pickup_id
        )
        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]?.driver_name;

      const deliveryDriver = trackingEvents
        .filter((e: any) => 
          ['ORDER_ASSIGNED', 'ORDER_ACCEPTED_AND_STARTED'].includes(e.event_name) && 
          e.delivery_id
        )
        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]?.driver_name;

      // Add pickup job if scheduled for this date
      if (order.scheduled_pickup_date === date && pickupDriver) {
        if (!driverJobsMap.has(pickupDriver)) {
          driverJobsMap.set(pickupDriver, []);
        }
        driverJobsMap.get(pickupDriver)!.push({
          type: 'pickup',
          order_id: order.id,
          lat: order.sender?.address?.lat,
          lng: order.sender?.address?.lon,
          address: order.sender?.address,
          postcode: order.sender?.address?.postcode
        });
      }

      // Add delivery job if scheduled for this date
      if (order.scheduled_delivery_date === date && deliveryDriver) {
        if (!driverJobsMap.has(deliveryDriver)) {
          driverJobsMap.set(deliveryDriver, []);
        }
        driverJobsMap.get(deliveryDriver)!.push({
          type: 'delivery',
          order_id: order.id,
          lat: order.receiver?.address?.lat,
          lng: order.receiver?.address?.lon,
          address: order.receiver?.address,
          postcode: order.receiver?.address?.postcode
        });
      }
    }

    console.log(`Found jobs for ${driverJobsMap.size} drivers`);

    // Generate timeslips for each driver
    const createdTimeslips = [];

    for (const [driverName, jobs] of driverJobsMap.entries()) {
      // Find driver record by name
      const { data: driverRecords } = await supabaseClient
        .from('drivers')
        .select('*')
        .ilike('name', driverName)
        .limit(1);

      if (!driverRecords || driverRecords.length === 0) {
        console.warn(`Driver not found: ${driverName}`);
        continue;
      }

      const driver = driverRecords[0];

      // Calculate stops (unique locations)
      const uniqueStops = new Set();
      const jobLocations: any[] = [];
      
      jobs.forEach(job => {
        if (job.lat && job.lng) {
          const locationKey = `${job.lat},${job.lng}`;
          uniqueStops.add(locationKey);
          jobLocations.push({
            lat: job.lat,
            lng: job.lng,
            type: job.type,
            postcode: job.postcode,
            order_id: job.order_id
          });
        }
      });

      const totalStops = uniqueStops.size;
      const stopHours = Math.round((totalStops * 10 / 60) * 100) / 100; // 10 mins per stop

      // Generate route links
      const baseCoords = "52.4707965,-1.8749747"; // Depot coordinates
      const routeLinks: string[] = [];
      const stopArray = Array.from(uniqueStops);

      if (stopArray.length > 10) {
        const firstHalf = stopArray.slice(0, 10).join('|');
        const secondHalf = stopArray.slice(10).join('|');
        routeLinks.push(
          `https://www.google.com/maps/dir/?api=1&origin=${baseCoords}&destination=${baseCoords}&waypoints=${firstHalf}&travelmode=driving`,
          `https://www.google.com/maps/dir/?api=1&origin=${baseCoords}&destination=${baseCoords}&waypoints=${secondHalf}&travelmode=driving`
        );
      } else if (stopArray.length > 0) {
        const waypoints = stopArray.join('|');
        routeLinks.push(
          `https://www.google.com/maps/dir/?api=1&origin=${baseCoords}&destination=${baseCoords}&waypoints=${waypoints}&travelmode=driving`
        );
      }

      // Create or update timeslip
      const { data: timeslip, error: timeslipError } = await supabaseClient
        .from('timeslips')
        .upsert({
          driver_id: driver.id,
          date: date,
          status: 'draft',
          driving_hours: 6.00,
          stop_hours: stopHours,
          lunch_hours: 1.00,
          hourly_rate: driver.hourly_rate || 11.00,
          van_allowance: driver.uses_own_van ? (driver.van_allowance || 0.00) : 0.00,
          total_stops: totalStops,
          route_links: routeLinks,
          job_locations: jobLocations
        }, {
          onConflict: 'driver_id,date'
        })
        .select()
        .single();

      if (timeslipError) {
        console.error(`Error creating timeslip for ${driverName}:`, timeslipError);
        continue;
      }

      createdTimeslips.push(timeslip);
      console.log(`Created timeslip for ${driverName}: ${totalStops} stops, ${stopHours}h`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Generated ${createdTimeslips.length} timeslips`,
        timeslips: createdTimeslips
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );

  } catch (error: any) {
    console.error('Error generating timeslips:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to generate timeslips',
        details: error 
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );
  }
};

serve(handler);
