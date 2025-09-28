import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QueryRequest {
  date: string; // Format: YYYY-MM-DD
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

interface DriverOrders {
  driverName: string;
  orders: ShipdayOrder[];
  totalOrders: number;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { date }: QueryRequest = await req.json();

    console.log('Querying Shipday for completed orders on date:', date);

    // Get API credentials from environment
    const apiKey = Deno.env.get('SHIPDAY_API_KEY');

    if (!apiKey) {
      console.error('Missing Shipday API key');
      return new Response(
        JSON.stringify({ error: 'Shipday API not configured' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // Create request body for Shipday API
    // Note: startTime/endTime filter by order placement time, not delivery time
    // So we'll use a wider range and filter by deliveryTime in JavaScript
    const requestBody = {
      orderStatus: "ALREADY_DELIVERED",
      startTime: "2020-01-01T00:00:00Z", // Use wide range since we'll filter by deliveryTime
      endTime: "2030-12-31T23:59:59Z",
      startCursor: 1,
      endCursor: 1000 // Increase to get more orders
    };

    console.log('Shipday API request body:', requestBody);

    // Query Shipday API
    const shipdayResponse = await fetch('https://api.shipday.com/orders/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${apiKey}`
      },
      body: JSON.stringify(requestBody),
    });

    console.log('Shipday API response status:', shipdayResponse.status);
    console.log('Shipday API response headers:', Object.fromEntries(shipdayResponse.headers.entries()));

    if (!shipdayResponse.ok) {
      const errorText = await shipdayResponse.text();
      console.error('Shipday API error response:', errorText);
      throw new Error(`Shipday API error (${shipdayResponse.status}): ${errorText}`);
    }

    // Check if response has content before parsing
    const responseText = await shipdayResponse.text();
    console.log('Shipday API response text:', responseText);
    
    let shipdayData;
    if (!responseText || responseText.trim() === '') {
      console.log('Empty response from Shipday API');
      shipdayData = [];
    } else {
      try {
        shipdayData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse Shipday response as JSON:', parseError);
        throw new Error(`Invalid JSON response from Shipday: ${responseText}`);
      }
    }

    console.log('Parsed Shipday data:', shipdayData);

    // Filter orders by the specific delivery date 
    const targetDate = date; // Format: YYYY-MM-DD
    console.log(`Filtering orders for target date: ${targetDate}`);
    console.log(`Total orders returned from Shipday: ${shipdayData.length}`);
    
    const filteredOrders = shipdayData.filter((order: ShipdayOrder) => {
      // Check if order has delivery time and was actually delivered
      if (!order.deliveryTime) {
        console.log(`Order ${order.orderId}: No deliveryTime`);
        return false;
      }
      
      if (order.status !== 'ALREADY_DELIVERED') {
        console.log(`Order ${order.orderId}: Status is ${order.status}, not ALREADY_DELIVERED`);
        return false;
      }
      
      // Extract date from deliveryTime (should be in ISO format like "2025-09-24T14:30:00Z")
      const deliveryDateTime = new Date(order.deliveryTime);
      const deliveryDate = deliveryDateTime.toISOString().split('T')[0]; // Get YYYY-MM-DD
      const isCorrectDate = deliveryDate === targetDate;
      
      // Check if carrier/driver exists
      const hasDriver = order.carrier && order.carrier.name;
      const driverName = order.carrier?.name || 'No driver';
      
      console.log(`Order ${order.orderId}: deliveryTime=${order.deliveryTime}, extractedDate=${deliveryDate}, targetDate=${targetDate}, dateMatch=${isCorrectDate}, driver=${driverName}, status=${order.status}`);
      
      if (isCorrectDate && hasDriver) {
        console.log(`✓ Including order ${order.orderId} for driver ${driverName}`);
        return true;
      }
      
      return false;
    });

    console.log(`Filtered ${filteredOrders.length} orders for date ${targetDate}`);
    
    // Log summary by driver
    const driverSummary: Record<string, number> = {};
    filteredOrders.forEach((order: ShipdayOrder) => {
      const driverName = order.carrier.name;
      if (!driverSummary[driverName]) driverSummary[driverName] = 0;
      driverSummary[driverName]++;
    });
    console.log('Orders per driver:', driverSummary);

    // Group orders by driver name
    const driverOrdersMap = new Map<string, ShipdayOrder[]>();
    
    filteredOrders.forEach((order: ShipdayOrder) => {
      const driverName = order.carrier?.name;
      if (driverName) {
        if (!driverOrdersMap.has(driverName)) {
          driverOrdersMap.set(driverName, []);
        }
        driverOrdersMap.get(driverName)!.push(order);
      }
    });

    // Convert to array format
    const driversWithOrders: DriverOrders[] = Array.from(driverOrdersMap.entries()).map(
      ([driverName, orders]) => ({
        driverName,
        orders,
        totalOrders: orders.length
      })
    );

    console.log(`Found ${driversWithOrders.length} drivers with completed orders`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        date,
        drivers: driversWithOrders,
        totalOrdersFound: filteredOrders.length
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error('Error in query-shipday-completed-orders function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to query Shipday orders',
        details: error 
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);