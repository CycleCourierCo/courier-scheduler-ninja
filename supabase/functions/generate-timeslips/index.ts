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

interface JobInfo {
  orderId: string;
  trackingNumber: string;
  address: string;
  postcode: string;
  lat: number | null;
  lng: number | null;
  confirmedAt: string;
  bikeQuantity: number;
}

interface DriverJobs {
  driverName: string;
  jobs: JobInfo[];
}

interface DatabaseQueryResponse {
  date: string;
  collections: DriverJobs[];
  deliveries: DriverJobs[];
  totalCollections: number;
  totalDeliveries: number;
}

interface JobLocation {
  lat: number;
  lng: number;
  type: 'pickup' | 'delivery';
  address: string;
  postcode: string;
  confirmedAt: string;
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
    console.log('Data source: Database (collection_confirmation_sent_at, delivery_confirmation_sent_at)');

    // Query database for completed jobs on this date
    const { data: databaseData, error: dbError } = await supabaseClient.functions.invoke(
      'query-database-completed-jobs',
      {
        body: { date }
      }
    );

    if (dbError) {
      console.error('❌ Error querying database:', dbError);
      throw dbError;
    }

    const queryResult = databaseData as DatabaseQueryResponse;

    if (!queryResult || (queryResult.totalCollections === 0 && queryResult.totalDeliveries === 0)) {
      console.log('⚠️ No completed jobs found in database for this date');
      
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
          message: 'No completed jobs found for this date',
          count: 0,
          timeslips: []
        }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    console.log(`📊 Database query result: ${queryResult.totalCollections} collections, ${queryResult.totalDeliveries} deliveries`);

    // Build a map of all unique driver names with their jobs
    const driverJobsMap: Map<string, { collections: JobInfo[], deliveries: JobInfo[] }> = new Map();

    // Add collections
    for (const driverData of queryResult.collections) {
      if (!driverJobsMap.has(driverData.driverName)) {
        driverJobsMap.set(driverData.driverName, { collections: [], deliveries: [] });
      }
      driverJobsMap.get(driverData.driverName)!.collections = driverData.jobs;
    }

    // Add deliveries
    for (const driverData of queryResult.deliveries) {
      if (!driverJobsMap.has(driverData.driverName)) {
        driverJobsMap.set(driverData.driverName, { collections: [], deliveries: [] });
      }
      driverJobsMap.get(driverData.driverName)!.deliveries = driverData.jobs;
    }

    console.log(`📋 Unique drivers found: ${driverJobsMap.size}`);

    const createdTimeslips = [];
    const warnings: string[] = [];
    const depotCoords = "52.4707965,-1.8749747"; // Depot coordinates

    // Process each driver
    let driverIndex = 0;
    for (const [driverName, jobs] of driverJobsMap) {
      driverIndex++;
      console.log(`\n[Driver ${driverIndex}/${driverJobsMap.size}] Processing: ${driverName}`);
      console.log(`  └─ ${jobs.collections.length} collections, ${jobs.deliveries.length} deliveries`);

      // Look up driver by shipday_driver_name first, then by name
      let driver = null;
      
      // Try shipday_driver_name match
      const { data: driverByShipdayName, error: shipdayNameError } = await supabaseClient
        .from('profiles')
        .select('*')
        .ilike('shipday_driver_name', `%${driverName}%`)
        .eq('role', 'driver')
        .limit(1);

      if (shipdayNameError) {
        console.warn(`  ⚠️ Error looking up by shipday_driver_name: ${shipdayNameError.message}`);
      } else if (driverByShipdayName && driverByShipdayName.length > 0) {
        driver = driverByShipdayName[0];
        console.log(`  ✅ Found driver by shipday_driver_name: ${driver.name} (ID: ${driver.id.substring(0, 8)}...)`);
      }

      // Fallback: try name match
      if (!driver) {
        const { data: driverByName, error: nameError } = await supabaseClient
          .from('profiles')
          .select('*')
          .ilike('name', `%${driverName}%`)
          .eq('role', 'driver')
          .limit(1);

        if (nameError) {
          console.warn(`  ⚠️ Error looking up by name: ${nameError.message}`);
        } else if (driverByName && driverByName.length > 0) {
          driver = driverByName[0];
          console.log(`  ✅ Found driver by name: ${driver.name} (ID: ${driver.id.substring(0, 8)}...)`);
        }
      }

      if (!driver) {
        const warning = `Driver not found in database: ${driverName}`;
        console.warn(`  ⚠️ ${warning}`);
        warnings.push(warning);
        continue;
      }

      // Build all stops from collections and deliveries
      const allStops: JobLocation[] = [];

      // Add collection stops (pickup type)
      for (const job of jobs.collections) {
        if (job.lat && job.lng) {
          allStops.push({
            lat: job.lat,
            lng: job.lng,
            type: 'pickup',
            address: job.address,
            postcode: job.postcode,
            confirmedAt: job.confirmedAt,
            order_id: job.trackingNumber || job.orderId
          });
        }
      }

      // Add delivery stops
      for (const job of jobs.deliveries) {
        if (job.lat && job.lng) {
          allStops.push({
            lat: job.lat,
            lng: job.lng,
            type: 'delivery',
            address: job.address,
            postcode: job.postcode,
            confirmedAt: job.confirmedAt,
            order_id: job.trackingNumber || job.orderId
          });
        }
      }

      // Calculate total jobs (sum of bike_quantity from all jobs)
      const totalJobs = 
        jobs.collections.reduce((sum, job) => sum + job.bikeQuantity, 0) +
        jobs.deliveries.reduce((sum, job) => sum + job.bikeQuantity, 0);

      console.log(`  └─ Total jobs (bike_quantity sum): ${totalJobs}`);

      // Sort stops by confirmation time (chronological)
      allStops.sort((a, b) => new Date(a.confirmedAt).getTime() - new Date(b.confirmedAt).getTime());

      // Remove duplicate locations while preserving order
      const uniqueStops = allStops.filter((stop, index, self) => {
        const key = `${stop.lat.toFixed(5)},${stop.lng.toFixed(5)}`;
        const firstIndex = self.findIndex(s => `${s.lat.toFixed(5)},${s.lng.toFixed(5)}` === key);
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
        // Split into multiple routes of 10 stops each
        for (let i = 0; i < stopCoords.length; i += 10) {
          const chunk = stopCoords.slice(i, i + 10).join('|');
          routeLinks.push(
            `https://www.google.com/maps/dir/?api=1&origin=${depotCoords}&destination=${depotCoords}&waypoints=${chunk}&travelmode=driving`
          );
        }
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
          mileage: (driver.van_allowance || 0) > 0 ? 160 : null,
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
      console.log(`     - Collections: ${jobs.collections.length}, Deliveries: ${jobs.deliveries.length}`);
      console.log(`     - Stops: ${totalStops}, Stop Hours: ${stopHours.toFixed(2)}h`);
      console.log(`     - Total Jobs: ${totalJobs}, Total Pay: £${totalPay.toFixed(2)}`);
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
            totalJobs: timeslip.total_jobs,
            stopHours: timeslip.stop_hours,
            totalPay: timeslip.total_pay
          };
        })
      ) : [];

      // Determine email subject based on outcome
      let subject = '';
      if (createdTimeslips.length === 0 && driverJobsMap.size > 0) {
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
        <p><strong>Data Source:</strong> Database (collection/delivery confirmation timestamps)</p>
        
        <hr />
        
        <h3>📊 Summary:</h3>
        <ul>
          <li><strong>Total collections:</strong> ${queryResult.totalCollections}</li>
          <li><strong>Total deliveries:</strong> ${queryResult.totalDeliveries}</li>
          <li><strong>Unique drivers:</strong> ${driverJobsMap.size}</li>
          <li><strong>Timeslips created:</strong> ${createdTimeslips.length}</li>
        </ul>
        
        ${createdTimeslips.length > 0 ? `
          <h3>✅ Created Timeslips:</h3>
          <ul>
            ${driverDetails.map(d => `<li><strong>${d.name}:</strong> ${d.stops} stops, ${d.totalJobs || 0} jobs, ${d.stopHours.toFixed(2)}h, £${d.totalPay.toFixed(2)}</li>`).join('\n')}
          </ul>
        ` : ''}
        
        ${warnings.length > 0 ? `
          <h3>⚠️ Warnings (${warnings.length}):</h3>
          <ul>
            ${warnings.map(w => `<li>${w}</li>`).join('\n')}
          </ul>
        ` : ''}
        
        ${createdTimeslips.length === 0 && driverJobsMap.size > 0 ? `
          <h3>🚨 Alert: No Timeslips Created</h3>
          <p>The system found ${driverJobsMap.size} drivers with completed jobs, but created 0 timeslips.</p>
          <p><strong>Possible Issues:</strong></p>
          <ul>
            <li>Driver names don't match database profiles</li>
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
        drivers_processed: driverJobsMap.size,
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
