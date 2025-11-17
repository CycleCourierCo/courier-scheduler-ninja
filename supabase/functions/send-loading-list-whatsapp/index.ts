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
    collectionDriverName?: string;
    deliveryDriverName?: string;
    isInStorage: boolean;
    scheduledDeliveryDate?: string;
  }[];
  driverPhoneNumbers?: Record<string, string>;
}

function normalizeDateToYYYYMMDD(dateString: string): string {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function categorizeBikesForDriver(
  driverName: string,
  allBikes: LoadingListRequest['bikesNeedingLoading'],
  loadingDate: string
) {
  // Normalize loading date to YYYY-MM-DD
  const normalizedLoadingDate = normalizeDateToYYYYMMDD(loadingDate);
  
  console.log(`Categorizing bikes for ${driverName}, loading date: ${normalizedLoadingDate}`);
  
  const bikesToKeep = allBikes.filter(b => {
    const bikeDate = b.scheduledDeliveryDate ? normalizeDateToYYYYMMDD(b.scheduledDeliveryDate) : null;
    return b.collectionDriverName === driverName &&
      b.deliveryDriverName === driverName &&
      !b.isInStorage &&
      bikeDate === normalizedLoadingDate;
  });

  const bikesToGiveAway = allBikes.filter(b => {
    const bikeDate = b.scheduledDeliveryDate ? normalizeDateToYYYYMMDD(b.scheduledDeliveryDate) : null;
    return b.collectionDriverName === driverName &&
      b.deliveryDriverName &&
      b.deliveryDriverName !== driverName &&
      b.deliveryDriverName !== 'Unassigned Driver' &&
      bikeDate === normalizedLoadingDate;
  });

  const bikesByRecipient = bikesToGiveAway.reduce((acc, bike) => {
    const recipient = bike.deliveryDriverName!;
    if (!acc[recipient]) acc[recipient] = [];
    acc[recipient].push(bike);
    return acc;
  }, {} as Record<string, typeof bikesToGiveAway>);

  const bikesToReceive = allBikes.filter(b => {
    const bikeDate = b.scheduledDeliveryDate ? normalizeDateToYYYYMMDD(b.scheduledDeliveryDate) : null;
    return b.deliveryDriverName === driverName &&
      b.collectionDriverName &&
      b.collectionDriverName !== driverName &&
      !b.isInStorage &&
      bikeDate === normalizedLoadingDate;
  });

  const bikesByProvider = bikesToReceive.reduce((acc, bike) => {
    const provider = bike.collectionDriverName!;
    if (!acc[provider]) acc[provider] = [];
    acc[provider].push(bike);
    return acc;
  }, {} as Record<string, typeof bikesToReceive>);

  const bikesToCollect = allBikes.filter(b => {
    const bikeDate = b.scheduledDeliveryDate ? normalizeDateToYYYYMMDD(b.scheduledDeliveryDate) : null;
    return b.isInStorage &&
      b.deliveryDriverName === driverName &&
      bikeDate === normalizedLoadingDate;
  });

  const bikesToDeposit = allBikes.filter(b => {
    const bikeDate = b.scheduledDeliveryDate ? normalizeDateToYYYYMMDD(b.scheduledDeliveryDate) : null;
    return b.collectionDriverName === driverName &&
      (
        !b.deliveryDriverName ||
        b.deliveryDriverName === 'Unassigned Driver' ||
        (bikeDate && bikeDate !== normalizedLoadingDate)
      );
  });
  
  console.log(`${driverName} categories:`, {
    keep: bikesToKeep.length,
    giveAway: Object.keys(bikesByRecipient).length,
    receive: Object.keys(bikesByProvider).length,
    collect: bikesToCollect.length,
    deposit: bikesToDeposit.length
  });

  return {
    bikesToKeep,
    bikesByRecipient,
    bikesByProvider,
    bikesToCollect,
    bikesToDeposit
  };
}

function formatBikeEntry(bike: any, index: number, showLocation: boolean = true): string {
  let message = `${index + 1}. ${bike.bikeBrand} ${bike.bikeModel}\n`;
  
  if (showLocation) {
    let location = '';
    if (bike.isInStorage) {
      location = bike.storageAllocations.map((a: any) => `Bay ${a.bay}${a.position}`).join(', ');
    } else if (bike.collectionDriverName) {
      location = `With ${bike.collectionDriverName}`;
    } else {
      location = 'Awaiting collection';
    }
    message += `   📍 Location: ${location}\n`;
  }
  
  message += `   📦 Customer: ${bike.receiver.name}\n`;
  message += `   🔢 Tracking: ${bike.trackingNumber}\n`;
  
  if (bike.bikeQuantity > 1) {
    message += `   🚲 Quantity: ${bike.bikeQuantity} bikes\n`;
  }
  
  return message + '\n';
}

function buildDriverMessage(
  driverName: string,
  categories: ReturnType<typeof categorizeBikesForDriver>,
  date: string
): string {
  let message = `🚛 YOUR LOADING LIST\n\n📅 Date: ${date}\n\n👨‍💼 ${driverName}\n\n`;
  
  if (categories.bikesToKeep.length > 0) {
    message += `🔒 BIKES YOU NEED TO KEEP (${categories.bikesToKeep.length})\n`;
    message += `You collected these and will deliver them\n\n`;
    categories.bikesToKeep.forEach((bike, i) => {
      message += formatBikeEntry(bike, i, false);
    });
    message += '---\n\n';
  }
  
  if (Object.keys(categories.bikesByRecipient).length > 0) {
    message += `🤝 BIKES TO GIVE TO OTHER DRIVERS\n\n`;
    for (const [recipientDriver, bikes] of Object.entries(categories.bikesByRecipient)) {
      message += `📦 Give to ${recipientDriver} (${bikes.length} bike${bikes.length > 1 ? 's' : ''})\n`;
      bikes.forEach((bike, i) => {
        message += formatBikeEntry(bike, i, false);
      });
      message += '\n';
    }
    message += '---\n\n';
  }
  
  if (Object.keys(categories.bikesByProvider).length > 0) {
    message += `📥 BIKES TO RECEIVE FROM OTHER DRIVERS\n\n`;
    for (const [providerName, bikes] of Object.entries(categories.bikesByProvider)) {
      message += `📦 Receive from ${providerName} (${bikes.length} bike${bikes.length > 1 ? 's' : ''})\n`;
      bikes.forEach((bike, i) => {
        message += formatBikeEntry(bike, i, false);
      });
      message += '\n';
    }
    message += '---\n\n';
  }
  
  if (categories.bikesToCollect.length > 0) {
    message += `🏢 BIKES TO COLLECT FROM DEPOT (${categories.bikesToCollect.length})\n\n`;
    categories.bikesToCollect.forEach((bike, i) => {
      message += formatBikeEntry(bike, i, true);
    });
    message += '---\n\n';
  }
  
  if (categories.bikesToDeposit.length > 0) {
    message += `📥 BIKES TO PUT INTO DEPOT (${categories.bikesToDeposit.length})\n`;
    message += `Drop these at the depot - not going out today\n\n`;
    categories.bikesToDeposit.forEach((bike, i) => {
      message += formatBikeEntry(bike, i, false);
    });
    message += '---\n\n';
  }
  
  if (categories.bikesToKeep.length === 0 &&
      Object.keys(categories.bikesByRecipient).length === 0 &&
      Object.keys(categories.bikesByProvider).length === 0 &&
      categories.bikesToCollect.length === 0 &&
      categories.bikesToDeposit.length === 0) {
    return '';
  }
  
  return message;
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

    // Get all unique drivers
    const allDrivers = new Set<string>();
    bikesNeedingLoading.forEach(bike => {
      if (bike.collectionDriverName) allDrivers.add(bike.collectionDriverName);
      if (bike.deliveryDriverName && bike.deliveryDriverName !== 'Unassigned Driver') {
        allDrivers.add(bike.deliveryDriverName);
      }
    });

    console.log('All drivers:', Array.from(allDrivers));

    // Create management overview (grouped by delivery driver)
    const bikesByDriver = bikesNeedingLoading.reduce((acc, bike) => {
      const driver = bike.deliveryDriverName || 'Unassigned Driver';
      if (!acc[driver]) {
        acc[driver] = [];
      }
      acc[driver].push(bike);
      return acc;
    }, {} as Record<string, typeof bikesNeedingLoading>);

    let managementMessage = `🚛 LOADING LIST - MANAGEMENT OVERVIEW\n\n📅 Date: ${date}\n\n`;

    for (const [driverName, driverBikes] of Object.entries(bikesByDriver)) {
      managementMessage += `👨‍💼 ${driverName}\n`;
      
      driverBikes.forEach((bike, index) => {
        const bikeNumber = index + 1;
        
        let location = '';
        if (bike.isInStorage) {
          location = bike.storageAllocations.map(alloc => `Bay ${alloc.bay}${alloc.position}`).join(', ');
        } else {
          if (bike.collectionDriverName) {
            location = `With ${bike.collectionDriverName}`;
          } else {
            location = 'Awaiting collection';
          }
        }
        
        managementMessage += `${bikeNumber}. ${bike.bikeBrand} ${bike.bikeModel}\n`;
        managementMessage += `   📍 Location: ${location}\n`;
        managementMessage += `   📦 Customer: ${bike.receiver.name}\n`;
        managementMessage += `   🔢 Tracking: ${bike.trackingNumber}\n`;
        
        if (bike.bikeQuantity > 1) {
          managementMessage += `   🚲 Quantity: ${bike.bikeQuantity} bikes\n`;
        }
        managementMessage += '\n';
      });
      
      managementMessage += '---\n\n';
    }

    console.log('Formatted management message:', managementMessage);

    const managementPhone = '+441217980767';
    const results = [];

    // Send to management
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
        text: managementMessage
      }),
    });

    const managementResult = await managementResponse.json();
    console.log('Management WhatsApp response:', managementResult);
    results.push({ recipient: 'management', phone: managementPhone, result: managementResult });

    if (!managementResponse.ok) {
      throw new Error(`Management WhatsApp API error: ${JSON.stringify(managementResult)}`);
    }

    // Send to individual drivers with new 4-section format
    let driverMessagesSent = 0;
    for (const driverName of allDrivers) {
      const driverPhone = driverPhoneNumbers[driverName];
      
      if (driverPhone && driverPhone.trim()) {
        const categories = categorizeBikesForDriver(driverName, bikesNeedingLoading, date);
        const driverMessage = buildDriverMessage(driverName, categories, date);
        
        if (driverMessage) {
          console.log(`Sending to ${driverName}:`, driverMessage);
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
          driverMessagesSent++;

          if (!driverResponse.ok) {
            console.error(`Failed to send to driver ${driverName}:`, driverResult);
          }
        } else {
          console.log(`No bikes for driver ${driverName}, skipping message`);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Loading list sent successfully',
        results,
        driversCount: allDrivers.size,
        totalBikes: bikesNeedingLoading.length,
        sentToDrivers: driverMessagesSent
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