import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { requireAdminOrCronAuth, createAuthErrorResponse } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QueryRequest {
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

interface SenderReceiver {
  name?: string;
  email?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
    lat?: number;
    lon?: number;
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Require admin or cron authentication
  const authResult = await requireAdminOrCronAuth(req);
  if (!authResult.success) {
    return createAuthErrorResponse(authResult.error!, authResult.status!);
  }
  console.log(`Authorized via: ${authResult.authType}`, {
    timestamp: new Date().toISOString(),
  });

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { date }: QueryRequest = await req.json();
    
    console.log('=== QUERY DATABASE COMPLETED JOBS ===');
    console.log('Target date:', date);

    // Query collections: orders where collection was confirmed on target date
    // Using AT TIME ZONE to handle UK timezone properly
    const { data: collectionsData, error: collectionsError } = await supabaseClient
      .from('orders')
      .select('id, tracking_number, sender, collection_driver_name, collection_confirmation_sent_at, bike_quantity')
      .not('collection_confirmation_sent_at', 'is', null)
      .not('collection_driver_name', 'is', null);

    if (collectionsError) {
      console.error('❌ Error querying collections:', collectionsError);
      throw collectionsError;
    }

    // Query deliveries: orders where delivery was confirmed on target date
    const { data: deliveriesData, error: deliveriesError } = await supabaseClient
      .from('orders')
      .select('id, tracking_number, receiver, delivery_driver_name, delivery_confirmation_sent_at, bike_quantity')
      .not('delivery_confirmation_sent_at', 'is', null)
      .not('delivery_driver_name', 'is', null);

    if (deliveriesError) {
      console.error('❌ Error querying deliveries:', deliveriesError);
      throw deliveriesError;
    }

    console.log(`📊 Raw query results: ${collectionsData?.length || 0} collections, ${deliveriesData?.length || 0} deliveries`);

    // Filter collections to target date (in UK timezone)
    const targetDate = new Date(date + 'T00:00:00Z');
    const collectionsOnDate = (collectionsData || []).filter(order => {
      if (!order.collection_confirmation_sent_at) return false;
      const confirmDate = new Date(order.collection_confirmation_sent_at);
      // Convert to UK date string and compare
      const ukDateStr = confirmDate.toLocaleDateString('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' });
      const targetDateStr = targetDate.toLocaleDateString('en-GB', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' });
      return ukDateStr === targetDateStr;
    });

    // Filter deliveries to target date (in UK timezone)
    const deliveriesOnDate = (deliveriesData || []).filter(order => {
      if (!order.delivery_confirmation_sent_at) return false;
      const confirmDate = new Date(order.delivery_confirmation_sent_at);
      const ukDateStr = confirmDate.toLocaleDateString('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' });
      const targetDateStr = targetDate.toLocaleDateString('en-GB', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' });
      return ukDateStr === targetDateStr;
    });

    console.log(`📅 Filtered to target date: ${collectionsOnDate.length} collections, ${deliveriesOnDate.length} deliveries`);

    // Group collections by driver name
    const collectionsByDriver: Map<string, JobInfo[]> = new Map();
    for (const order of collectionsOnDate) {
      const driverName = order.collection_driver_name as string;
      const sender = order.sender as SenderReceiver;
      
      if (!collectionsByDriver.has(driverName)) {
        collectionsByDriver.set(driverName, []);
      }
      
      const address = sender?.address;
      const fullAddress = address 
        ? [address.street, address.city, address.state, address.postal_code].filter(Boolean).join(', ')
        : 'Unknown address';
      
      collectionsByDriver.get(driverName)!.push({
        orderId: order.id,
        trackingNumber: order.tracking_number || '',
        address: fullAddress,
        postcode: address?.postal_code || '',
        lat: address?.lat || null,
        lng: address?.lon || null,
        confirmedAt: order.collection_confirmation_sent_at,
        bikeQuantity: order.bike_quantity || 1
      });
    }

    // Group deliveries by driver name
    const deliveriesByDriver: Map<string, JobInfo[]> = new Map();
    for (const order of deliveriesOnDate) {
      const driverName = order.delivery_driver_name as string;
      const receiver = order.receiver as SenderReceiver;
      
      if (!deliveriesByDriver.has(driverName)) {
        deliveriesByDriver.set(driverName, []);
      }
      
      const address = receiver?.address;
      const fullAddress = address 
        ? [address.street, address.city, address.state, address.postal_code].filter(Boolean).join(', ')
        : 'Unknown address';
      
      deliveriesByDriver.get(driverName)!.push({
        orderId: order.id,
        trackingNumber: order.tracking_number || '',
        address: fullAddress,
        postcode: address?.postal_code || '',
        lat: address?.lat || null,
        lng: address?.lon || null,
        confirmedAt: order.delivery_confirmation_sent_at,
        bikeQuantity: order.bike_quantity || 1
      });
    }

    // Convert maps to arrays
    const collections: DriverJobs[] = Array.from(collectionsByDriver.entries()).map(([driverName, jobs]) => ({
      driverName,
      jobs
    }));

    const deliveries: DriverJobs[] = Array.from(deliveriesByDriver.entries()).map(([driverName, jobs]) => ({
      driverName,
      jobs
    }));

    // Log driver summaries
    console.log('\n📦 Collections by driver:');
    for (const driver of collections) {
      console.log(`  - ${driver.driverName}: ${driver.jobs.length} jobs`);
    }
    
    console.log('\n🚚 Deliveries by driver:');
    for (const driver of deliveries) {
      console.log(`  - ${driver.driverName}: ${driver.jobs.length} jobs`);
    }

    const response = {
      date,
      collections,
      deliveries,
      totalCollections: collectionsOnDate.length,
      totalDeliveries: deliveriesOnDate.length
    };

    console.log('\n=== QUERY COMPLETED ===');
    console.log(`Total: ${collectionsOnDate.length} collections, ${deliveriesOnDate.length} deliveries`);

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );

  } catch (error: any) {
    console.error('=== QUERY FAILED ===');
    console.error('❌ Error:', error.message);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to query completed jobs'
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );
  }
};

serve(handler);
