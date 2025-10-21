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
    collectionDriverName?: string; // Driver who collected this bike
    deliveryDriverName?: string; // Driver who should deliver this bike
    isInStorage: boolean;
  }[];
  driverPhoneNumbers?: Record<string, string>; // Optional driver phone numbers
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { date, bikesNeedingLoading, driverPhoneNumbers = {} }: LoadingListRequest = await req.json();

    console.log('Sending loading list for date:', date);
    console.log('Bikes needing loading:', bikesNeedingLoading);
    console.log('Driver phone numbers:', driverPhoneNumbers);

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

    // Group bikes by delivery driver for organization
    const bikesByDriver = bikesNeedingLoading.reduce((acc, bike) => {
      const driver = bike.deliveryDriverName || 'Unassigned Driver';
      if (!acc[driver]) {
        acc[driver] = [];
      }
      acc[driver].push(bike);
      return acc;
    }, {} as Record<string, typeof bikesNeedingLoading>);

    console.log('Bikes grouped by driver:', bikesByDriver);

    // Management phone number (always gets the list)
    const managementPhone = '+441217980767';
    const results = [];

    // Create the loading list message
    let message = `🚛 LOADING LIST\n\n📅 Date: ${date}\n\n`;

    for (const [driverName, driverBikes] of Object.entries(bikesByDriver)) {
      message += `👨‍💼 ${driverName}\n`;
      
      driverBikes.forEach((bike, index) => {
        const bikeNumber = index + 1;
        
        // Determine current location of the bike
        let location = '';
        if (bike.isInStorage) {
          // Bike is in storage unit
          location = bike.storageAllocations.map(alloc => `Bay ${alloc.bay}${alloc.position}`).join(', ');
        } else {
          // Bike is not in storage - show who has it (collection driver)
          if (bike.collectionDriverName) {
            location = `With ${bike.collectionDriverName}`;
          } else {
            // Collection hasn't happened yet or driver not assigned
            location = 'Awaiting collection';
          }
        }
        
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

    // Send to management (always)
    const managementCleanPhone = managementPhone.replace(/[^\d]/g, '');
    const managementResponse = await fetch('https://api.p.2chat.io/open/whatsapp/send-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-API-Key': apiKey,
      },
      body: JSON.stringify({
        to_number: `+${managementCleanPhone}`,
        from_number: fromNumber,
        text: message
      }),
    });

    const managementResult = await managementResponse.json();
    console.log('Management WhatsApp response:', managementResult);
    results.push({ recipient: 'management', phone: managementPhone, result: managementResult });

    if (!managementResponse.ok) {
      throw new Error(`Management WhatsApp API error: ${JSON.stringify(managementResult)}`);
    }

    // Send to individual drivers (if phone numbers provided)
    for (const [driverName, driverBikes] of Object.entries(bikesByDriver)) {
      const driverPhone = driverPhoneNumbers[driverName];
      
      if (driverPhone && driverPhone.trim()) {
        // Create driver-specific message
        let driverMessage = `🚛 YOUR LOADING LIST\n\n📅 Date: ${date}\n\n👨‍💼 ${driverName}\n`;
        
        driverBikes.forEach((bike, index) => {
          const bikeNumber = index + 1;
          
          let location = '';
          if (bike.isInStorage) {
            location = bike.storageAllocations.map(alloc => `Bay ${alloc.bay}${alloc.position}`).join(', ');
          } else {
            // Bike is not in storage - show who has it (collection driver)
            if (bike.collectionDriverName) {
              location = `With ${bike.collectionDriverName}`;
            } else {
              // Collection hasn't happened yet or driver not assigned
              location = 'Awaiting collection';
            }
          }
          
          driverMessage += `${bikeNumber}. ${bike.bikeBrand} ${bike.bikeModel}\n`;
          driverMessage += `   📍 Location: ${location}\n`;
          driverMessage += `   📦 Customer: ${bike.receiver.name}\n`;
          driverMessage += `   🔢 Tracking: ${bike.trackingNumber}\n`;
          
          if (bike.bikeQuantity > 1) {
            driverMessage += `   🚲 Quantity: ${bike.bikeQuantity} bikes\n`;
          }
          driverMessage += '\n';
        });

        const driverCleanPhone = driverPhone.replace(/[^\d]/g, '');
        const driverResponse = await fetch('https://api.p.2chat.io/open/whatsapp/send-message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-API-Key': apiKey,
          },
          body: JSON.stringify({
            to_number: `+${driverCleanPhone}`,
            from_number: fromNumber,
            text: driverMessage
          }),
        });

        const driverResult = await driverResponse.json();
        console.log(`Driver ${driverName} WhatsApp response:`, driverResult);
        results.push({ recipient: driverName, phone: driverPhone, result: driverResult });

        if (!driverResponse.ok) {
          console.error(`Failed to send to driver ${driverName}:`, driverResult);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Loading list sent successfully',
        results,
        driversCount: Object.keys(bikesByDriver).length,
        totalBikes: bikesNeedingLoading.length,
        sentToDrivers: Object.values(driverPhoneNumbers).filter(phone => phone && phone.trim()).length
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