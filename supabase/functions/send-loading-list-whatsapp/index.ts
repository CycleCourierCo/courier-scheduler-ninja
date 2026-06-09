import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { requireAdminAuth, createAuthErrorResponse } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
    hasBeenCollected?: boolean;
  }[];
  driverPhoneNumbers?: Record<string, string>;
  driverEmails?: Record<string, string>;
  loaderPhoneNumber?: string;
  loaderEmail?: string;
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
      !b.isInStorage &&
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
    return b.hasBeenCollected &&
      b.collectionDriverName === driverName &&
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

// HTML Email template builders
function buildManagementEmailHtml(
  date: string,
  bikesFromDepot: LoadingListRequest['bikesNeedingLoading'],
  bikesToDepot: LoadingListRequest['bikesNeedingLoading'],
  allDrivers: Set<string>
): string {
  const fromDepotByDriver = bikesFromDepot.reduce((acc, bike) => {
    const driver = bike.deliveryDriverName || 'Unassigned';
    if (!acc[driver]) acc[driver] = [];
    acc[driver].push(bike);
    return acc;
  }, {} as Record<string, typeof bikesFromDepot>);

  const toDepotByDriver = bikesToDepot.reduce((acc, bike) => {
    const driver = bike.collectionDriverName || 'Unknown';
    if (!acc[driver]) acc[driver] = [];
    acc[driver].push(bike);
    return acc;
  }, {} as Record<string, typeof bikesToDepot>);

  let fromDepotHtml = '';
  for (const [driverName, bikes] of Object.entries(fromDepotByDriver)) {
    fromDepotHtml += `
      <div style="margin-bottom: 16px;">
        <div style="font-weight: bold; color: #1a1a1a; margin-bottom: 8px;">👨‍💼 ${driverName} (${bikes.length})</div>
        ${bikes.map((bike, i) => {
          const location = bike.storageAllocations.map(a => `Bay ${a.bay}${a.position}`).join(', ');
          return `
            <div style="background: #f8f8f8; padding: 8px 12px; border-radius: 4px; margin-bottom: 4px; font-size: 14px;">
              <div><strong>${i + 1}. ${bike.bikeBrand} ${bike.bikeModel}</strong></div>
              <div style="color: #666;">📍 ${location}</div>
              <div style="color: #666;">📦 ${bike.receiver.name}</div>
              <div style="color: #666;">🔢 ${bike.trackingNumber}</div>
              ${bike.bikeQuantity > 1 ? `<div style="color: #666;">🚲 Quantity: ${bike.bikeQuantity} bikes</div>` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  let toDepotHtml = '';
  for (const [driverName, bikes] of Object.entries(toDepotByDriver)) {
    toDepotHtml += `
      <div style="margin-bottom: 16px;">
        <div style="font-weight: bold; color: #1a1a1a; margin-bottom: 8px;">👨‍💼 ${driverName} bringing in (${bikes.length})</div>
        ${bikes.map((bike, i) => {
          let reason = '';
          if (!bike.deliveryDriverName || bike.deliveryDriverName === 'Unassigned Driver') {
            reason = '⚠️ No delivery driver';
          } else if (bike.scheduledDeliveryDate) {
            const deliveryDate = new Date(bike.scheduledDeliveryDate).toLocaleDateString('en-GB');
            reason = `📅 Delivery: ${deliveryDate}`;
          }
          return `
            <div style="background: #f8f8f8; padding: 8px 12px; border-radius: 4px; margin-bottom: 4px; font-size: 14px;">
              <div><strong>${i + 1}. ${bike.bikeBrand} ${bike.bikeModel}</strong></div>
              <div style="color: #666;">📦 ${bike.receiver.name}</div>
              <div style="color: #666;">🔢 ${bike.trackingNumber}</div>
              ${reason ? `<div style="color: #c45500;">${reason}</div>` : ''}
              ${bike.bikeQuantity > 1 ? `<div style="color: #666;">🚲 Quantity: ${bike.bikeQuantity} bikes</div>` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
      <div style="background: #1a1a1a; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h1 style="margin: 0; font-size: 24px;">🚛 LOADING LIST - MANAGEMENT OVERVIEW</h1>
        <p style="margin: 10px 0 0; font-size: 16px;">📅 Date: ${date}</p>
      </div>
      
      <div style="background: #e8f5e9; border: 2px solid #4caf50; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <h2 style="margin: 0 0 12px; color: #2e7d32; font-size: 18px;">📤 FROM DEPOT → DRIVERS (${bikesFromDepot.length} bikes)</h2>
        <p style="margin: 0 0 16px; color: #666; font-size: 14px;">Bikes in storage going OUT today</p>
        ${fromDepotHtml || '<p style="color: #666;">No bikes going out from depot</p>'}
      </div>

      <div style="background: #fff3e0; border: 2px solid #ff9800; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <h2 style="margin: 0 0 12px; color: #e65100; font-size: 18px;">📥 TO DEPOT ← DRIVERS (${bikesToDepot.length} bikes)</h2>
        <p style="margin: 0 0 16px; color: #666; font-size: 14px;">Bikes collected that need to come IN</p>
        ${toDepotHtml || '<p style="color: #666;">No bikes coming to depot</p>'}
      </div>

      <div style="background: #f5f5f5; border-radius: 8px; padding: 16px;">
        <h2 style="margin: 0 0 12px; color: #1a1a1a; font-size: 18px;">📊 SUMMARY</h2>
        <ul style="margin: 0; padding-left: 20px; color: #333;">
          <li>Outbound: ${bikesFromDepot.length} bikes leaving depot</li>
          <li>Inbound: ${bikesToDepot.length} bikes coming to depot</li>
          <li>Total drivers: ${allDrivers.size}</li>
        </ul>
      </div>

      <p style="margin-top: 20px; color: #999; font-size: 12px; text-align: center;">
        Sent by Cycle Courier Co. Loading System
      </p>
    </body>
    </html>
  `;
}

function buildDriverEmailHtml(
  driverName: string,
  categories: ReturnType<typeof categorizeBikesForDriver>,
  date: string
): string {
  const sections: string[] = [];

  if (categories.bikesToKeep.length > 0) {
    sections.push(`
      <div style="background: #e3f2fd; border: 2px solid #2196f3; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
        <h3 style="margin: 0 0 12px; color: #1565c0;">🔒 BIKES YOU NEED TO KEEP (${categories.bikesToKeep.length})</h3>
        <p style="margin: 0 0 12px; color: #666; font-size: 14px;">You collected these and will deliver them</p>
        ${categories.bikesToKeep.map((bike, i) => `
          <div style="background: white; padding: 8px 12px; border-radius: 4px; margin-bottom: 4px; font-size: 14px;">
            <div><strong>${i + 1}. ${bike.bikeBrand} ${bike.bikeModel}</strong></div>
            <div style="color: #666;">📦 ${bike.receiver.name}</div>
            <div style="color: #666;">🔢 ${bike.trackingNumber}</div>
            ${bike.bikeQuantity > 1 ? `<div style="color: #666;">🚲 Quantity: ${bike.bikeQuantity}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `);
  }

  if (Object.keys(categories.bikesByRecipient).length > 0) {
    let recipientHtml = '';
    for (const [recipientDriver, bikes] of Object.entries(categories.bikesByRecipient)) {
      recipientHtml += `
        <div style="margin-bottom: 12px;">
          <div style="font-weight: bold; margin-bottom: 8px;">📦 Give to ${recipientDriver} (${bikes.length} bike${bikes.length > 1 ? 's' : ''})</div>
          ${bikes.map((bike, i) => `
            <div style="background: white; padding: 8px 12px; border-radius: 4px; margin-bottom: 4px; font-size: 14px;">
              <div><strong>${i + 1}. ${bike.bikeBrand} ${bike.bikeModel}</strong></div>
              <div style="color: #666;">📦 ${bike.receiver.name}</div>
              <div style="color: #666;">🔢 ${bike.trackingNumber}</div>
            </div>
          `).join('')}
        </div>
      `;
    }
    sections.push(`
      <div style="background: #fce4ec; border: 2px solid #e91e63; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
        <h3 style="margin: 0 0 12px; color: #c2185b;">🤝 BIKES TO GIVE TO OTHER DRIVERS</h3>
        ${recipientHtml}
      </div>
    `);
  }

  if (Object.keys(categories.bikesByProvider).length > 0) {
    let providerHtml = '';
    for (const [providerName, bikes] of Object.entries(categories.bikesByProvider)) {
      providerHtml += `
        <div style="margin-bottom: 12px;">
          <div style="font-weight: bold; margin-bottom: 8px;">📦 Receive from ${providerName} (${bikes.length} bike${bikes.length > 1 ? 's' : ''})</div>
          ${bikes.map((bike, i) => `
            <div style="background: white; padding: 8px 12px; border-radius: 4px; margin-bottom: 4px; font-size: 14px;">
              <div><strong>${i + 1}. ${bike.bikeBrand} ${bike.bikeModel}</strong></div>
              <div style="color: #666;">📦 ${bike.receiver.name}</div>
              <div style="color: #666;">🔢 ${bike.trackingNumber}</div>
            </div>
          `).join('')}
        </div>
      `;
    }
    sections.push(`
      <div style="background: #f3e5f5; border: 2px solid #9c27b0; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
        <h3 style="margin: 0 0 12px; color: #7b1fa2;">📥 BIKES TO RECEIVE FROM OTHER DRIVERS</h3>
        ${providerHtml}
      </div>
    `);
  }

  if (categories.bikesToCollect.length > 0) {
    sections.push(`
      <div style="background: #e8f5e9; border: 2px solid #4caf50; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
        <h3 style="margin: 0 0 12px; color: #2e7d32;">🏢 BIKES TO COLLECT FROM DEPOT (${categories.bikesToCollect.length})</h3>
        ${categories.bikesToCollect.map((bike, i) => {
          const location = bike.storageAllocations.map(a => `Bay ${a.bay}${a.position}`).join(', ');
          return `
            <div style="background: white; padding: 8px 12px; border-radius: 4px; margin-bottom: 4px; font-size: 14px;">
              <div><strong>${i + 1}. ${bike.bikeBrand} ${bike.bikeModel}</strong></div>
              <div style="color: #666;">📍 ${location}</div>
              <div style="color: #666;">📦 ${bike.receiver.name}</div>
              <div style="color: #666;">🔢 ${bike.trackingNumber}</div>
              ${bike.bikeQuantity > 1 ? `<div style="color: #666;">🚲 Quantity: ${bike.bikeQuantity}</div>` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `);
  }

  if (categories.bikesToDeposit.length > 0) {
    sections.push(`
      <div style="background: #fff3e0; border: 2px solid #ff9800; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
        <h3 style="margin: 0 0 12px; color: #e65100;">📥 BIKES TO PUT INTO DEPOT (${categories.bikesToDeposit.length})</h3>
        <p style="margin: 0 0 12px; color: #666; font-size: 14px;">Drop these at the depot - not going out today</p>
        ${categories.bikesToDeposit.map((bike, i) => `
          <div style="background: white; padding: 8px 12px; border-radius: 4px; margin-bottom: 4px; font-size: 14px;">
            <div><strong>${i + 1}. ${bike.bikeBrand} ${bike.bikeModel}</strong></div>
            <div style="color: #666;">📦 ${bike.receiver.name}</div>
            <div style="color: #666;">🔢 ${bike.trackingNumber}</div>
            ${bike.bikeQuantity > 1 ? `<div style="color: #666;">🚲 Quantity: ${bike.bikeQuantity}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `);
  }

  if (sections.length === 0) {
    return '';
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
      <div style="background: #1a1a1a; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h1 style="margin: 0; font-size: 24px;">🚛 YOUR LOADING LIST</h1>
        <p style="margin: 10px 0 0; font-size: 16px;">📅 Date: ${date}</p>
        <p style="margin: 5px 0 0; font-size: 16px;">👨‍💼 ${driverName}</p>
      </div>
      
      ${sections.join('')}

      <p style="margin-top: 20px; color: #999; font-size: 12px; text-align: center;">
        Sent by Cycle Courier Co. Loading System
      </p>
    </body>
    </html>
  `;
}
// Build a bay-grouped breakdown of bikes coming OUT of storage today.
// Returns both plain-text (for WhatsApp) and HTML (for email).
function buildBayBreakdown(bikesFromDepot: LoadingListRequest['bikesNeedingLoading'], date: string): { text: string; html: string } {
  // Flatten: one entry per allocation (a bike may occupy multiple positions)
  type Row = { bay: string; position: number; bike: typeof bikesFromDepot[number] };
  const rows: Row[] = [];
  for (const bike of bikesFromDepot) {
    for (const alloc of (bike.storageAllocations || [])) {
      rows.push({ bay: alloc.bay, position: alloc.position, bike });
    }
  }
  if (rows.length === 0) return { text: '', html: '' };

  // Group by bay
  const byBay: Record<string, Row[]> = {};
  for (const r of rows) {
    if (!byBay[r.bay]) byBay[r.bay] = [];
    byBay[r.bay].push(r);
  }

  const bayOrder = ['A', 'B', 'C', 'D'];
  const bayKeys = Object.keys(byBay).sort((a, b) => {
    const ai = bayOrder.indexOf(a);
    const bi = bayOrder.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  const bayEmoji: Record<string, string> = { A: '🅰️', B: '🅱️', C: '🇨', D: '🇩' };

  let text = `🗄️ BAY BREAKDOWN - BIKES OUT TODAY\n\n📅 Date: ${date}\n\n`;
  let htmlSections = '';
  let totalBikes = 0;

  for (const bay of bayKeys) {
    const list = byBay[bay].sort((a, b) => a.position - b.position);
    totalBikes += list.length;
    const emoji = bayEmoji[bay] || '📦';

    text += `${emoji} BAY ${bay} (${list.length})\n`;
    text += '━━━━━━━━━━━━━━━━━━━━\n\n';

    let htmlRows = '';
    list.forEach((r, idx) => {
      const driver = r.bike.deliveryDriverName || 'Unassigned';
      const brandModel = `${r.bike.bikeBrand} ${r.bike.bikeModel}`.trim();
      text += `${idx + 1}. ${brandModel}\n`;
      text += `   📍 ${r.bay}${r.position}\n`;
      text += `   📦 ${r.bike.receiver.name}\n`;
      text += `   🔢 ${r.bike.trackingNumber}\n`;
      text += `   👨‍💼 ${driver}\n`;
      if (r.bike.bikeQuantity && r.bike.bikeQuantity > 1) {
        text += `   🚲 Quantity: ${r.bike.bikeQuantity} bikes\n`;
      }
      text += '\n';

      htmlRows += `
        <tr>
          <td style="padding: 6px 8px; font-weight: 600; white-space: nowrap;">${r.bay}${r.position}</td>
          <td style="padding: 6px 8px; white-space: nowrap;">${r.bike.trackingNumber}</td>
          <td style="padding: 6px 8px;">${brandModel}</td>
          <td style="padding: 6px 8px;">${r.bike.receiver.name}</td>
          <td style="padding: 6px 8px; color: #555;">${driver}</td>
        </tr>`;
    });
    text += '━━━━━━━━━━━━━━━━━━━━\n\n';

    htmlSections += `
      <h3 style="margin: 16px 0 6px; color: #1a1a1a;">${emoji} Bay ${bay} <span style="color:#666;font-weight:400;">(${list.length})</span></h3>
      <table style="width:100%; border-collapse: collapse; font-size: 13px;">
        <thead>
          <tr style="background:#f5f5f5; text-align:left;">
            <th style="padding:6px 8px;">Position</th>
            <th style="padding:6px 8px;">Tracking</th>
            <th style="padding:6px 8px;">Bike</th>
            <th style="padding:6px 8px;">Customer</th>
            <th style="padding:6px 8px;">Driver</th>
          </tr>
        </thead>
        <tbody>${htmlRows}</tbody>
      </table>`;
  }

  text += `📊 SUMMARY\n`;
  text += `• Total bikes out: ${totalBikes}\n`;
  text += `• Bays in use: ${bayKeys.length}\n`;

  const html = `
    <div style="margin-top: 24px; padding: 16px; border: 1px solid #e5e5e5; border-radius: 8px; background: #fafafa;">
      <h2 style="margin: 0 0 8px; font-size: 18px;">🗄️ Bay Breakdown - Bikes Out Today</h2>
      <p style="margin: 0 0 8px; color:#555; font-size: 13px;">Grouped by bay, sorted by position. Date: ${date}</p>
      ${htmlSections}
      <p style="margin: 12px 0 0; font-size: 13px; color:#333;"><strong>Total bikes out:</strong> ${totalBikes} · <strong>Bays in use:</strong> ${bayKeys.length}</p>
    </div>`;

  return { text, html };
}



// Helper to send a SendZen session text message
async function sendSendZenMessage(sendzenApiKey: string, toNumber: string, messageBody: string): Promise<{ ok: boolean; data: any }> {
  const cleanPhone = toNumber.replace(/[^\d]/g, '');
  const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`;
  
  try {
    const response = await fetch('https://api.sendzen.io/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendzenApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: "441217980767",
        to: formattedPhone,
        type: "text",
        text: {
          body: messageBody,
          preview_url: false
        }
      }),
    });

    const data = await response.json();
    return { ok: response.ok, data };
  } catch (error: any) {
    console.error(`SendZen send error to ${toNumber}:`, error);
    return { ok: false, data: { error: error.message } };
  }
}

// Split a long message into chunks <= maxLen, preferring safe boundaries.
function splitMessage(message: string, maxLen = 3900): string[] {
  if (message.length <= maxLen) return [message];
  const chunks: string[] = [];
  let remaining = message;
  while (remaining.length > maxLen) {
    let slice = remaining.slice(0, maxLen);
    let cut = slice.lastIndexOf('\n━');
    if (cut < maxLen * 0.5) cut = slice.lastIndexOf('\n\n');
    if (cut < maxLen * 0.5) cut = slice.lastIndexOf('\n');
    if (cut <= 0) cut = maxLen;
    chunks.push(remaining.slice(0, cut).trimEnd());
    remaining = remaining.slice(cut).trimStart();
  }
  if (remaining.length) chunks.push(remaining);
  return chunks;
}

// Send a (possibly long) WhatsApp message in chunks, tagged (i/N).
async function sendChunkedWhatsApp(
  sendzenApiKey: string,
  toNumber: string,
  message: string,
  label: string
): Promise<{ ok: boolean; results: any[] }> {
  const chunks = splitMessage(message);
  const results: any[] = [];
  let allOk = true;
  for (let i = 0; i < chunks.length; i++) {
    const tag = chunks.length > 1 ? `(${i + 1}/${chunks.length}) ` : '';
    const body = `${tag}${chunks[i]}`;
    const res = await sendSendZenMessage(sendzenApiKey, toNumber, body);
    console.log(`${label} WhatsApp chunk ${i + 1}/${chunks.length} response:`, res.data);
    if (!res.ok) {
      allOk = false;
      console.error(`${label} WhatsApp chunk ${i + 1}/${chunks.length} error:`, JSON.stringify(res.data));
    }
    results.push(res.data);
  }
  return { ok: allOk, results };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Require admin authentication
  const authResult = await requireAdminAuth(req);
  if (!authResult.success) {
    return createAuthErrorResponse(authResult.error!, authResult.status!);
  }
  console.log('Authenticated admin:', authResult.userId);

  try {
    const { date, bikesNeedingLoading, driverPhoneNumbers = {}, driverEmails = {}, loaderPhoneNumber, loaderEmail }: LoadingListRequest = await req.json();

    console.log('Sending loading list for date:', date);
    console.log('Bikes needing loading:', bikesNeedingLoading);
    console.log('Driver phone numbers:', driverPhoneNumbers);
    console.log('Driver emails:', driverEmails);
    console.log('Loader phone:', loaderPhoneNumber);
    console.log('Loader email:', loaderEmail);

    // Get API credentials
    const sendzenApiKey = Deno.env.get('SENDZEN_API_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!sendzenApiKey) {
      console.error('Missing SendZen API key');
      return new Response(
        JSON.stringify({ error: 'WhatsApp API not configured' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // Initialize Resend if API key is available
    const resend = resendApiKey ? new Resend(resendApiKey) : null;

    // Get all unique drivers
    const allDrivers = new Set<string>();
    bikesNeedingLoading.forEach(bike => {
      if (bike.collectionDriverName) allDrivers.add(bike.collectionDriverName);
      if (bike.deliveryDriverName && bike.deliveryDriverName !== 'Unassigned Driver') {
        allDrivers.add(bike.deliveryDriverName);
      }
    });

    console.log('All drivers:', Array.from(allDrivers));

    // Helper functions for management message categorization
    const getBikesFromDepot = (bikes: LoadingListRequest['bikesNeedingLoading'], loadingDate: string) => {
      const normalizedDate = normalizeDateToYYYYMMDD(loadingDate);
      return bikes.filter(b => {
        const bikeDate = b.scheduledDeliveryDate ? normalizeDateToYYYYMMDD(b.scheduledDeliveryDate) : null;
        return b.isInStorage && bikeDate === normalizedDate;
      });
    };

    const getBikesToDepot = (bikes: LoadingListRequest['bikesNeedingLoading'], loadingDate: string) => {
      const normalizedDate = normalizeDateToYYYYMMDD(loadingDate);
      return bikes.filter(b => {
        const bikeDate = b.scheduledDeliveryDate ? normalizeDateToYYYYMMDD(b.scheduledDeliveryDate) : null;
        return b.hasBeenCollected && 
               !b.isInStorage && 
               (
                 !b.deliveryDriverName ||
                 b.deliveryDriverName === 'Unassigned Driver' ||
                 !bikeDate ||
                 bikeDate !== normalizedDate
               );
      });
    };

    // Build management WhatsApp message
    let managementMessage = `🚛 LOADING LIST - MANAGEMENT OVERVIEW\n\n📅 Date: ${date}\n\n`;

    const bikesFromDepot = getBikesFromDepot(bikesNeedingLoading, date);
    managementMessage += `📤 FROM DEPOT → DRIVERS (${bikesFromDepot.length} bikes)\n`;
    managementMessage += `Bikes in storage going OUT today\n\n`;

    const fromDepotByDriver = bikesFromDepot.reduce((acc, bike) => {
      const driver = bike.deliveryDriverName || 'Unassigned';
      if (!acc[driver]) acc[driver] = [];
      acc[driver].push(bike);
      return acc;
    }, {} as Record<string, typeof bikesFromDepot>);

    for (const [driverName, bikes] of Object.entries(fromDepotByDriver)) {
      managementMessage += `👨‍💼 ${driverName} (${bikes.length})\n`;
      bikes.forEach((bike, i) => {
        const location = bike.storageAllocations.map(a => `Bay ${a.bay}${a.position}`).join(', ');
        managementMessage += `${i+1}. ${bike.bikeBrand} ${bike.bikeModel}\n`;
        managementMessage += `   📍 ${location}\n`;
        managementMessage += `   📦 ${bike.receiver.name}\n`;
        managementMessage += `   🔢 ${bike.trackingNumber}\n`;
        if (bike.bikeQuantity > 1) {
          managementMessage += `   🚲 Quantity: ${bike.bikeQuantity} bikes\n`;
        }
        managementMessage += '\n';
      });
    }
    managementMessage += '━━━━━━━━━━━━━━━━━━━━\n\n';

    const bikesToDepot = getBikesToDepot(bikesNeedingLoading, date);
    managementMessage += `📥 TO DEPOT ← DRIVERS (${bikesToDepot.length} bikes)\n`;
    managementMessage += `Bikes collected that need to come IN\n\n`;

    const toDepotByDriver = bikesToDepot.reduce((acc, bike) => {
      const driver = bike.collectionDriverName || 'Unknown';
      if (!acc[driver]) acc[driver] = [];
      acc[driver].push(bike);
      return acc;
    }, {} as Record<string, typeof bikesToDepot>);

    for (const [driverName, bikes] of Object.entries(toDepotByDriver)) {
      managementMessage += `👨‍💼 ${driverName} bringing in (${bikes.length})\n`;
      bikes.forEach((bike, i) => {
        let reason = '';
        if (!bike.deliveryDriverName || bike.deliveryDriverName === 'Unassigned Driver') {
          reason = '⚠️ No delivery driver';
        } else if (bike.scheduledDeliveryDate) {
          const deliveryDate = new Date(bike.scheduledDeliveryDate).toLocaleDateString('en-GB');
          reason = `📅 Delivery: ${deliveryDate}`;
        }
        managementMessage += `${i+1}. ${bike.bikeBrand} ${bike.bikeModel}\n`;
        managementMessage += `   📦 ${bike.receiver.name}\n`;
        managementMessage += `   🔢 ${bike.trackingNumber}\n`;
        if (reason) managementMessage += `   ${reason}\n`;
        if (bike.bikeQuantity > 1) {
          managementMessage += `   🚲 Quantity: ${bike.bikeQuantity} bikes\n`;
        }
        managementMessage += '\n';
      });
    }
    managementMessage += '━━━━━━━━━━━━━━━━━━━━\n\n';

    managementMessage += `📊 SUMMARY\n`;
    managementMessage += `• Outbound: ${bikesFromDepot.length} bikes leaving depot\n`;
    managementMessage += `• Inbound: ${bikesToDepot.length} bikes coming to depot\n`;
    managementMessage += `• Total drivers: ${allDrivers.size}\n`;

    console.log('Formatted management message:', managementMessage);

    const managementPhone = '+441217980767';
    const managementEmail = 'Info@cyclecourierco.com';
    const results: any[] = [];

    // === WHATSAPP: Send to management via SendZen (chunked) ===
    const mgmtWhatsApp = await sendChunkedWhatsApp(sendzenApiKey, managementPhone, managementMessage, 'Management');
    results.push({ recipient: 'management', channel: 'whatsapp', phone: managementPhone, result: mgmtWhatsApp.results });

    // === EMAIL: Send to management ===
    let managementEmailSent = false;
    if (resend) {
      try {
        const managementEmailHtml = buildManagementEmailHtml(date, bikesFromDepot, bikesToDepot, allDrivers);
        const emailResult = await resend.emails.send({
          from: "Ccc@notification.cyclecourierco.com",
          to: managementEmail,
          subject: `Loading List - ${date}`,
          html: managementEmailHtml,
          reply_to: "Info@cyclecourierco.com"
        });
        console.log('Management email sent:', emailResult);
        results.push({ recipient: 'management', channel: 'email', to: managementEmail, result: emailResult });
        managementEmailSent = true;
      } catch (emailError: any) {
        console.error('Error sending management email:', emailError);
        results.push({ recipient: 'management', channel: 'email', to: managementEmail, error: emailError.message });
      }
    } else {
      console.log('Resend API key not configured, skipping management email');
    }

    // === WHATSAPP + EMAIL: Send to loader (management overview + bay breakdown) ===
    let loaderWhatsAppSent = false;
    let loaderEmailSent = false;

    const bayBreakdown = buildBayBreakdown(bikesFromDepot);

    if (loaderPhoneNumber && loaderPhoneNumber.trim()) {
      console.log('Sending loading list to loader WhatsApp:', loaderPhoneNumber);
      // 1) Management overview (chunked)
      const loaderOverview = await sendChunkedWhatsApp(sendzenApiKey, loaderPhoneNumber, managementMessage, 'Loader overview');
      results.push({ recipient: 'loader', channel: 'whatsapp', phone: loaderPhoneNumber, result: loaderOverview.results });
      loaderWhatsAppSent = loaderOverview.ok;

      // 2) Bay breakdown as a separate message (chunked), only if non-empty
      if (bayBreakdown.text && bayBreakdown.text.trim()) {
        const loaderBays = await sendChunkedWhatsApp(sendzenApiKey, loaderPhoneNumber, bayBreakdown.text, 'Loader bay breakdown');
        results.push({ recipient: 'loader', channel: 'whatsapp-bays', phone: loaderPhoneNumber, result: loaderBays.results });
        loaderWhatsAppSent = loaderWhatsAppSent && loaderBays.ok;
      }
    }

    if (resend && loaderEmail && loaderEmail.trim()) {
      try {
        const baseHtml = buildManagementEmailHtml(date, bikesFromDepot, bikesToDepot, allDrivers);
        // Inject bay breakdown before closing </body> if present, otherwise append.
        const loaderEmailHtml = bayBreakdown.html
          ? (baseHtml.includes('</body>')
              ? baseHtml.replace('</body>', `${bayBreakdown.html}\n</body>`)
              : `${baseHtml}\n${bayBreakdown.html}`)
          : baseHtml;
        const emailResult = await resend.emails.send({
          from: "Ccc@notification.cyclecourierco.com",
          to: loaderEmail,
          subject: `Loading List - ${date}`,
          html: loaderEmailHtml,
          reply_to: "Info@cyclecourierco.com"
        });
        console.log('Loader email sent:', emailResult);
        results.push({ recipient: 'loader', channel: 'email', to: loaderEmail, result: emailResult });
        loaderEmailSent = true;
      } catch (emailError: any) {
        console.error('Error sending loader email:', emailError);
        results.push({ recipient: 'loader', channel: 'email', to: loaderEmail, error: emailError.message });
      }
    }


    // === Send to individual drivers (and also forward to loader) ===
    let driverWhatsAppsSent = 0;
    let driverEmailsSent = 0;
    let loaderDriverListsSent = 0;
    
    for (const driverName of allDrivers) {
      const categories = categorizeBikesForDriver(driverName, bikesNeedingLoading, date);
      const driverMessage = buildDriverMessage(driverName, categories, date);
      
      if (!driverMessage) {
        console.log(`No bikes for driver ${driverName}, skipping`);
        continue;
      }

      // WhatsApp to driver via SendZen
      const driverPhone = driverPhoneNumbers[driverName];
      if (driverPhone && driverPhone.trim()) {
        console.log(`Sending WhatsApp to ${driverName}:`, driverMessage);
        const driverWhatsApp = await sendSendZenMessage(sendzenApiKey, driverPhone, driverMessage);
        console.log(`Driver ${driverName} WhatsApp response:`, driverWhatsApp.data);
        results.push({ recipient: driverName, channel: 'whatsapp', phone: driverPhone, result: driverWhatsApp.data });
        
        if (driverWhatsApp.ok) {
          driverWhatsAppsSent++;
        } else {
          console.error(`Failed to send WhatsApp to driver ${driverName}:`, driverWhatsApp.data);
        }
      }

      // Email to driver
      const driverEmail = driverEmails[driverName];
      if (resend && driverEmail && driverEmail.trim()) {
        try {
          const driverEmailHtml = buildDriverEmailHtml(driverName, categories, date);
          if (driverEmailHtml) {
            console.log(`Sending email to ${driverName} at ${driverEmail}`);
            const emailResult = await resend.emails.send({
              from: "Ccc@notification.cyclecourierco.com",
              to: driverEmail,
              subject: `Your Loading List - ${date}`,
              html: driverEmailHtml,
              reply_to: "Info@cyclecourierco.com"
            });
            console.log(`Driver ${driverName} email sent:`, emailResult);
            results.push({ recipient: driverName, channel: 'email', to: driverEmail, result: emailResult });
            driverEmailsSent++;
          }
        } catch (emailError: any) {
          console.error(`Error sending email to driver ${driverName}:`, emailError);
          results.push({ recipient: driverName, channel: 'email', to: driverEmail, error: emailError.message });
        }
      }

      // === Forward individual driver list to loader (exclude "Unassigned Driver") ===
      if (driverName.toLowerCase() !== 'unassigned driver') {
        // WhatsApp to loader
        if (loaderPhoneNumber && loaderPhoneNumber.trim()) {
          try {
            const loaderDriverWhatsApp = await sendSendZenMessage(sendzenApiKey, loaderPhoneNumber, driverMessage);
            console.log(`Loader received ${driverName}'s list via WhatsApp:`, loaderDriverWhatsApp.data);
            results.push({ recipient: `loader-for-${driverName}`, channel: 'whatsapp', phone: loaderPhoneNumber, result: loaderDriverWhatsApp.data });
            if (loaderDriverWhatsApp.ok) loaderDriverListsSent++;
          } catch (err: any) {
            console.error(`Error forwarding ${driverName}'s list to loader WhatsApp:`, err);
            results.push({ recipient: `loader-for-${driverName}`, channel: 'whatsapp', phone: loaderPhoneNumber, error: err.message });
          }
        }

        // Email to loader
        if (resend && loaderEmail && loaderEmail.trim()) {
          try {
            const driverEmailHtml = buildDriverEmailHtml(driverName, categories, date);
            if (driverEmailHtml) {
              const emailResult = await resend.emails.send({
                from: "Ccc@notification.cyclecourierco.com",
                to: loaderEmail,
                subject: `Loading List for ${driverName} - ${date}`,
                html: driverEmailHtml,
                reply_to: "Info@cyclecourierco.com"
              });
              console.log(`Loader received ${driverName}'s list via email:`, emailResult);
              results.push({ recipient: `loader-for-${driverName}`, channel: 'email', to: loaderEmail, result: emailResult });
            }
          } catch (emailError: any) {
            console.error(`Error forwarding ${driverName}'s list to loader email:`, emailError);
            results.push({ recipient: `loader-for-${driverName}`, channel: 'email', to: loaderEmail, error: emailError.message });
          }
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
        whatsapp: {
          management: { sent: mgmtWhatsApp.ok },
          loader: { sent: loaderWhatsAppSent, phone: loaderPhoneNumber || null },
          drivers: { count: allDrivers.size, sent: driverWhatsAppsSent }
        },
        email: {
          management: { sent: managementEmailSent, to: managementEmail },
          loader: { sent: loaderEmailSent, to: loaderEmail || null },
          drivers: { count: Object.keys(driverEmails).filter(k => driverEmails[k]?.trim()).length, sent: driverEmailsSent }
        }
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
        error: error.message || 'Failed to send loading list'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);
