import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LoadingListRequest {
  date: string;
  bikesNeedingLoading: {
    id: string;
    receiver: {
      name: string;
    };
    bikeBrand: string;
    bikeModel: string;
    trackingNumber: string;
    bikeQuantity: number;
    storageAllocations: Array<{
      bay: string;
      position: number;
    }>;
    driverName?: string; // Driver who should load this bike
    isInStorage: boolean;
  }[];
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { date, bikesNeedingLoading }: LoadingListRequest = await req.json();

    console.log('Sending loading list for date:', date);
    console.log('Bikes needing loading:', bikesNeedingLoading);

    // Get API credentials from environment
    const apiKey = Deno.env.get('TWOCHAT_API_KEY');
    const fromNumber = Deno.env.get('TWOCHAT_FROM_NUMBER');

    if (!apiKey || !fromNumber) {
      console.error('Missing WhatsApp API credentials');
      return new Response(
        JSON.stringify({ error: 'WhatsApp API not configured' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // Group bikes by driver
    const bikesByDriver = bikesNeedingLoading.reduce((acc, bike) => {
      const driver = bike.driverName || 'Unassigned Driver';
      if (!acc[driver]) {
        acc[driver] = [];
      }
      acc[driver].push(bike);
      return acc;
    }, {} as Record<string, typeof bikesNeedingLoading>);

    console.log('Bikes grouped by driver:', bikesByDriver);

    // Send to management WhatsApp number
    const phoneNumber = '+441217980767';
    const cleanPhone = phoneNumber.replace(/[^\d]/g, '');

    // Create the loading list message
    let message = `🚛 LOADING LIST\n\n📅 Date: ${date}\n\n`;

    for (const [driverName, driverBikes] of Object.entries(bikesByDriver)) {
      message += `👨‍💼 ${driverName}\n`;
      
      driverBikes.forEach((bike, index) => {
        const bikeNumber = index + 1;
        const location = bike.isInStorage 
          ? bike.storageAllocations.map(alloc => `Bay ${alloc.bay}${alloc.position}`).join(', ')
          : `In ${driverName} van`;
        
        message += `${bikeNumber}. ${bike.bikeBrand} ${bike.bikeModel}\n`;
        message += `   📍 Location: ${location}\n`;
        message += `   📦 Customer: ${bike.receiver.name}\n`;
        message += `   🔢 Tracking: ${bike.trackingNumber}\n`;
        
        if (bike.bikeQuantity > 1) {
          message += `   🚲 Quantity: ${bike.bikeQuantity} bikes\n`;
        }
        message += '\n';
      });
      
      message += '---\n\n';
    }

    console.log('Formatted loading list message:', message);

    // Send WhatsApp message via 2Chat API
    const whatsappResponse = await fetch('https://api.p.2chat.io/open/whatsapp/send-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-API-Key': apiKey,
      },
      body: JSON.stringify({
        to_number: `+${cleanPhone}`,
        from_number: fromNumber,
        text: message
      }),
    });

    const whatsappResult = await whatsappResponse.json();
    console.log('WhatsApp API response:', whatsappResult);

    if (!whatsappResponse.ok) {
      throw new Error(`WhatsApp API error: ${JSON.stringify(whatsappResult)}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Loading list sent successfully',
        whatsappResult,
        driversCount: Object.keys(bikesByDriver).length,
        totalBikes: bikesNeedingLoading.length
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error('Error in send-loading-list-whatsapp function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to send loading list',
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