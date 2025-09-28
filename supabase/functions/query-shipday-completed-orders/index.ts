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
    const requestBody = {
      status: "ALREADY_DELIVERED",
      // Add date filtering if the API supports it
      deliveredAfter: `${date}T00:00:00Z`,
      deliveredBefore: `${date}T23:59:59Z`
    };

    console.log('Shipday API request body:', requestBody);

    // Query Shipday API
    const shipdayResponse = await fetch('https://api.shipday.com/orders/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(apiKey + ':')}`
      },
      body: JSON.stringify(requestBody),
    });

    const shipdayData = await shipdayResponse.json();
    console.log('Shipday API response:', shipdayData);

    if (!shipdayResponse.ok) {
      throw new Error(`Shipday API error: ${JSON.stringify(shipdayData)}`);
    }

    // Filter orders by the specific date (in case API doesn't support date filtering perfectly)
    const targetDate = date;
    const filteredOrders = shipdayData.filter((order: ShipdayOrder) => {
      if (!order.deliveryTime) return false;
      const deliveryDate = order.deliveryTime.split('T')[0];
      return deliveryDate === targetDate;
    });

    console.log(`Filtered ${filteredOrders.length} orders for date ${targetDate}`);

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