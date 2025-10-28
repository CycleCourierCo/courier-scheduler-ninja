import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateTimeslipsRequest {
  date: string; // YYYY-MM-DD format
}

interface ShipdayOrder {
  orderId: number;
  orderNumber: string;
  deliveryTime: string;
  carrier: {
    id: number;
    name: string;
    phone: string;
    email: string;
  };
  pickup: {
    id: number;
    name: string;
    address: string;
    formattedAddress: string;
    lat: number;
    lng: number;
  };
  delivery: {
    id: number;
    name: string;
    address: string;
    formattedAddress: string;
    lat: number;
    lng: number;
  };
  status: string;
}

interface JobLocation {
  lat: number;
  lng: number;
  type: 'pickup' | 'delivery';
  address: string;
  deliveryTime: string;
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

    // Query Shipday for completed orders on this date
    const { data: shipdayData, error: shipdayError } = await supabaseClient.functions.invoke(
      'query-shipday-completed-orders',
      {
        body: { date }
      }
    );

    if (shipdayError) {
      console.error('Error querying Shipday:', shipdayError);
      throw shipdayError;
    }

    if (!shipdayData || !shipdayData.drivers || shipdayData.drivers.length === 0) {
      console.log('No completed orders found in Shipday for this date');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No completed orders found for this date',
          count: 0,
          timeslips: []
        }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    console.log(`Found ${shipdayData.drivers.length} drivers with completed orders`);

    const createdTimeslips = [];
    const depotCoords = "52.4707965,-1.8749747"; // Depot coordinates

    // Process each driver's orders
    for (const driverData of shipdayData.drivers) {
      const driverName = driverData.driverName;
      const orders: ShipdayOrder[] = driverData.orders;

      console.log(`Processing ${orders.length} orders for driver: ${driverName}`);

      // Find driver ONLY by Shipday carrier ID (no name fallback)
      const carrierId = orders[0]?.carrier?.id;
      let driver = null;

      if (!carrierId) {
        console.warn(`No carrier ID found for driver: ${driverName}`);
        continue;
      }

      const { data: driverByShipdayId } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('shipday_driver_id', carrierId.toString())
        .eq('role', 'driver')
        .limit(1);

      if (driverByShipdayId && driverByShipdayId.length > 0) {
        driver = driverByShipdayId[0];
        console.log(`Found driver by Shipday ID ${carrierId}: ${driver.name}`);
      } else {
        console.warn(`Driver not found in database with Shipday ID: ${carrierId} (Shipday name: ${driverName})`);
        continue;
      }

      // Extract all stops from orders
      const allStops: JobLocation[] = [];
      
      orders.forEach(order => {
        // Add pickup stop
        if (order.pickup && order.pickup.lat && order.pickup.lng) {
          allStops.push({
            lat: order.pickup.lat,
            lng: order.pickup.lng,
            type: 'pickup',
            address: order.pickup.formattedAddress || order.pickup.address,
            deliveryTime: order.deliveryTime
          });
        }
        
        // Add delivery stop
        if (order.delivery && order.delivery.lat && order.delivery.lng) {
          allStops.push({
            lat: order.delivery.lat,
            lng: order.delivery.lng,
            type: 'delivery',
            address: order.delivery.formattedAddress || order.delivery.address,
            deliveryTime: order.deliveryTime
          });
        }
      });

      // Sort stops by delivery time (chronological)
      allStops.sort((a, b) => new Date(a.deliveryTime).getTime() - new Date(b.deliveryTime).getTime());

      // Remove duplicate locations while preserving order
      const uniqueStops = allStops.filter((stop, index, self) => {
        const key = `${stop.lat},${stop.lng}`;
        const firstIndex = self.findIndex(s => `${s.lat},${s.lng}` === key);
        return index === firstIndex;
      });

      // Calculate total stops excluding depot coordinates
      const totalStops = uniqueStops.filter(stop => {
        const coords = `${stop.lat},${stop.lng}`;
        return coords !== depotCoords;
      }).length;
      const stopHours = Math.round((totalStops * 10 / 60) * 100) / 100; // 10 mins per stop

      // Generate route links (handle 10+ stops by splitting)
      const routeLinks: string[] = [];
      const stopCoords = uniqueStops.map(s => `${s.lat},${s.lng}`);

      if (stopCoords.length > 10) {
        // Split into two routes
        const firstHalf = stopCoords.slice(0, 10).join('|');
        const secondHalf = stopCoords.slice(10).join('|');
        routeLinks.push(
          `https://www.google.com/maps/dir/?api=1&origin=${depotCoords}&destination=${depotCoords}&waypoints=${firstHalf}&travelmode=driving`,
          `https://www.google.com/maps/dir/?api=1&origin=${depotCoords}&destination=${depotCoords}&waypoints=${secondHalf}&travelmode=driving`
        );
      } else if (stopCoords.length > 0) {
        const waypoints = stopCoords.join('|');
        routeLinks.push(
          `https://www.google.com/maps/dir/?api=1&origin=${depotCoords}&destination=${depotCoords}&waypoints=${waypoints}&travelmode=driving`
        );
      }

      // Create or update timeslip (upsert on driver_id, date)
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
          job_locations: uniqueStops,
          custom_addons: [],
          custom_addon_hours: 0
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
      console.log(`Created/updated draft timeslip for ${driverName}: ${totalStops} stops, ${stopHours}h stop time`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Generated ${createdTimeslips.length} draft timeslip${createdTimeslips.length !== 1 ? 's' : ''}`,
        count: createdTimeslips.length,
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
