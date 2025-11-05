import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { Resend } from 'npm:resend@4.0.0';

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
  order_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { date }: GenerateTimeslipsRequest = await req.json();
    
    console.log('=== GENERATE TIMESLIPS STARTED ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Request date:', date);
    console.log('Triggered by:', req.headers.get('user-agent') || 'unknown');

    // Query Shipday for completed orders on this date
    const { data: shipdayData, error: shipdayError } = await supabaseClient.functions.invoke(
      'query-shipday-completed-orders',
      {
        body: { date }
      }
    );

    if (shipdayError) {
      console.error('❌ Error querying Shipday:', shipdayError);
      throw shipdayError;
    }

    if (!shipdayData || !shipdayData.drivers || shipdayData.drivers.length === 0) {
      console.log('⚠️ No completed orders found in Shipday for this date');
      
      // Log the run
      await supabaseClient.from('timeslip_generation_logs').insert({
        run_date: date,
        status: 'success',
        timeslips_created: 0,
        drivers_processed: 0,
        execution_duration_ms: Date.now() - startTime
      });
      
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

    const totalOrderCount = shipdayData.drivers.reduce((sum: number, d: any) => sum + d.orders.length, 0);
    console.log(`📊 Shipday query result: ${shipdayData.drivers.length} drivers, ${totalOrderCount} total orders`);

    const createdTimeslips = [];
    const warnings: string[] = [];
    const depotCoords = "52.4707965,-1.8749747"; // Depot coordinates

    // Process each driver's orders
    for (let index = 0; index < shipdayData.drivers.length; index++) {
      const driverData = shipdayData.drivers[index];
      const driverName = driverData.driverName;
      const orders: ShipdayOrder[] = driverData.orders;

      console.log(`\n[Driver ${index + 1}/${shipdayData.drivers.length}] Processing: ${driverName}`);
      console.log(`  └─ ${orders.length} orders to process`);

      // Find driver ONLY by Shipday carrier ID (no name fallback)
      const carrierId = orders[0]?.carrier?.id;
      let driver = null;

      if (!carrierId) {
        const warning = `No carrier ID found for driver: ${driverName}`;
        console.warn(`  ⚠️ ${warning}`);
        warnings.push(warning);
        continue;
      }

      console.log(`  └─ Looking up driver by Shipday Carrier ID: ${carrierId}`);

      const { data: driverByShipdayId, error: driverLookupError } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('shipday_driver_id', carrierId.toString())
        .eq('role', 'driver')
        .limit(1);

      if (driverLookupError) {
        const warning = `Database error looking up driver ${carrierId}: ${driverLookupError.message}`;
        console.error(`  ❌ ${warning}`);
        warnings.push(warning);
        continue;
      }

      if (driverByShipdayId && driverByShipdayId.length > 0) {
        driver = driverByShipdayId[0];
        console.log(`  ✅ Found driver: ${driver.name} (DB ID: ${driver.id.substring(0, 8)}...)`);
      } else {
        const warning = `Driver not found in database with Shipday ID: ${carrierId} (Shipday name: ${driverName})`;
        console.warn(`  ⚠️ ${warning}`);
        warnings.push(warning);
        continue;
      }

      // Extract all stops from orders and calculate total jobs
      const allStops: JobLocation[] = [];
      const orderIdsForJobs: string[] = [];
      
      orders.forEach(order => {
        // Track order ID for job calculation (use orderId which matches shipday_pickup_id/delivery_id)
        if (order.orderId) {
          orderIdsForJobs.push(order.orderId.toString());
        }
        
        // Add pickup stop
        if (order.pickup && order.pickup.lat && order.pickup.lng) {
          allStops.push({
            lat: order.pickup.lat,
            lng: order.pickup.lng,
            type: 'pickup',
            address: order.pickup.formattedAddress || order.pickup.address,
            deliveryTime: order.deliveryTime,
            order_id: order.orderNumber || ''
          });
        }
        
        // Add delivery stop
        if (order.delivery && order.delivery.lat && order.delivery.lng) {
          allStops.push({
            lat: order.delivery.lat,
            lng: order.delivery.lng,
            type: 'delivery',
            address: order.delivery.formattedAddress || order.delivery.address,
            deliveryTime: order.deliveryTime,
            order_id: order.orderNumber || ''
          });
        }
      });
      
      // Calculate total jobs (sum of bike_quantity from orders table)
      let totalJobs = 0;
      if (orderIdsForJobs.length > 0) {
        const { data: orderData, error: orderError } = await supabaseClient
          .from('orders')
          .select('bike_quantity, shipday_pickup_id, shipday_delivery_id')
          .or(`shipday_pickup_id.in.(${orderIdsForJobs.join(',')}),shipday_delivery_id.in.(${orderIdsForJobs.join(',')})`);
        
        if (!orderError && orderData) {
          totalJobs = orderData.reduce((sum, order) => sum + (order.bike_quantity || 1), 0);
          console.log(`  └─ Total jobs (bike_quantity sum): ${totalJobs} from ${orderData.length} orders`);
        } else {
          console.warn(`  ⚠️ Could not calculate total_jobs, will be NULL: ${orderError?.message || 'No data'}`);
        }
      }

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
          total_jobs: totalJobs > 0 ? totalJobs : null,
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
        const warning = `Database error creating timeslip for ${driverName}: ${timeslipError.message}`;
        console.error(`  ❌ ${warning}`);
        warnings.push(warning);
        continue;
      }

      createdTimeslips.push(timeslip);
      const totalPay = timeslip.total_pay || 0;
      console.log(`  ✅ Created/updated draft timeslip:`);
      console.log(`     - Stops: ${totalStops}, Stop Hours: ${stopHours.toFixed(2)}h`);
      console.log(`     - Total Pay: £${totalPay.toFixed(2)}`);
    }

    // Send email notification
    console.log('\n📧 Sending email notification...');
    const executionTime = Date.now() - startTime;
    const status = createdTimeslips.length > 0 ? (warnings.length > 0 ? 'partial' : 'success') : 'failed';
    
    try {
      const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
      
      // Fetch driver details for the email
      const driverDetails = createdTimeslips.length > 0 ? await Promise.all(
        createdTimeslips.map(async (timeslip) => {
          const { data: driver } = await supabaseClient
            .from('profiles')
            .select('name')
            .eq('id', timeslip.driver_id)
            .single();
          
          return {
            name: driver?.name || 'Unknown Driver',
            stops: timeslip.total_stops,
            stopHours: timeslip.stop_hours,
            totalPay: timeslip.total_pay
          };
        })
      ) : [];

      // Determine email subject based on outcome
      let subject = '';
      if (createdTimeslips.length === 0 && shipdayData.drivers.length > 0) {
        subject = `❌ Timeslip Generation Failed - ${date}`;
      } else if (warnings.length > 0) {
        subject = `⚠️ Timeslips Generated - ${date} (${createdTimeslips.length} created, ${warnings.length} warnings)`;
      } else {
        subject = `✅ Timeslips Generated - ${date} (${createdTimeslips.length} timeslips)`;
      }

      const emailHtml = `
        <h2>Timeslip Generation Report - ${date}</h2>
        <p><strong>Execution Time:</strong> ${new Date().toISOString()}</p>
        <p><strong>Duration:</strong> ${(executionTime / 1000).toFixed(2)}s</p>
        <p><strong>Status:</strong> ${status.toUpperCase()}</p>
        
        <hr />
        
        <h3>📊 Summary:</h3>
        <ul>
          <li><strong>Drivers with orders:</strong> ${shipdayData.drivers.length}</li>
          <li><strong>Total orders processed:</strong> ${totalOrderCount}</li>
          <li><strong>Timeslips created:</strong> ${createdTimeslips.length}</li>
        </ul>
        
        ${createdTimeslips.length > 0 ? `
          <h3>✅ Created Timeslips:</h3>
          <ul>
            ${driverDetails.map(d => `<li><strong>${d.name}:</strong> ${d.stops} stops, ${d.stopHours.toFixed(2)}h, £${d.totalPay.toFixed(2)}</li>`).join('\n')}
          </ul>
        ` : ''}
        
        ${warnings.length > 0 ? `
          <h3>⚠️ Warnings (${warnings.length}):</h3>
          <ul>
            ${warnings.map(w => `<li>${w}</li>`).join('\n')}
          </ul>
        ` : ''}
        
        ${createdTimeslips.length === 0 && shipdayData.drivers.length > 0 ? `
          <h3>🚨 Alert: No Timeslips Created</h3>
          <p>The system found ${shipdayData.drivers.length} drivers with orders, but created 0 timeslips.</p>
          <p><strong>Possible Issues:</strong></p>
          <ul>
            <li>Driver Shipday IDs don't match database profiles</li>
            <li>Database connection issues</li>
            <li>Data validation failures</li>
          </ul>
          <p>Please check the <a href="https://supabase.com/dashboard/project/axigtrmaxhetyfzjjdve/functions/generate-timeslips/logs">edge function logs</a> for details.</p>
        ` : ''}
        
        <hr />
        <p><small>View all timeslips in your <a href="https://cyclecourier.lovable.app/driver-timeslips">dashboard</a></small></p>
      `;

      await resend.emails.send({
        from: 'Cycle Courier <onboarding@resend.dev>',
        to: ['info@cyclecourierco.com'],
        subject: subject,
        html: emailHtml,
      });

      console.log('  ✅ Email notification sent to info@cyclecourierco.com');
    } catch (emailError: any) {
      console.error('  ❌ Failed to send email notification:', emailError.message);
      warnings.push(`Email notification failed: ${emailError.message}`);
    }
    
    // Log the run to database
    console.log('\n💾 Logging run to database...');
    try {
      await supabaseClient.from('timeslip_generation_logs').insert({
        run_date: date,
        status: status,
        timeslips_created: createdTimeslips.length,
        drivers_processed: shipdayData.drivers.length,
        warnings: warnings.length > 0 ? warnings : null,
        execution_duration_ms: executionTime
      });
      console.log('  ✅ Run logged successfully');
    } catch (logError: any) {
      console.error('  ⚠️ Failed to log run:', logError.message);
    }

    console.log('\n=== GENERATE TIMESLIPS COMPLETED ===');
    console.log(`✅ Created: ${createdTimeslips.length} timeslips`);
    console.log(`⚠️  Warnings: ${warnings.length}`);
    console.log(`⏱️  Execution time: ${executionTime}ms`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Generated ${createdTimeslips.length} draft timeslip${createdTimeslips.length !== 1 ? 's' : ''}`,
        count: createdTimeslips.length,
        timeslips: createdTimeslips,
        warnings: warnings,
        executionTime: executionTime
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );

  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    console.error('\n=== GENERATE TIMESLIPS FAILED ===');
    console.error('❌ Error:', error.message);
    console.error('⏱️  Execution time:', executionTime, 'ms');
    console.error('Stack:', error.stack);
    
    // Try to log the failure
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      await supabaseClient.from('timeslip_generation_logs').insert({
        run_date: new Date().toISOString().split('T')[0],
        status: 'failed',
        timeslips_created: 0,
        drivers_processed: 0,
        error_message: error.message,
        execution_duration_ms: executionTime
      });
    } catch (logError) {
      console.error('Failed to log error to database:', logError);
    }
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to generate timeslips',
        details: error.stack,
        executionTime: executionTime
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );
  }
};

serve(handler);
