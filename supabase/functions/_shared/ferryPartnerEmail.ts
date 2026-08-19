/**
 * Ferry partner (City Air Express) booking notification.
 * Shared by the orders API/Shopify creation path and the manual resend function
 * so every route produces an identical email.
 */
import { CITY_AIR_EXPRESS, niDirectionOf } from './northernIreland.ts';

const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const formatAddress = (address?: Record<string, any> | null) =>
  [address?.street, address?.city, address?.state, address?.zipCode || address?.postcode, address?.country]
    .filter(Boolean)
    .join(', ');

export interface FerryPartnerEmailInput {
  sender?: Record<string, any> | null;
  receiver?: Record<string, any> | null;
  tracking_number?: string | null;
  bike_brand?: string | null;
  bike_model?: string | null;
  bike_quantity?: number | null;
  ni_direction?: string | null;
  is_northern_ireland?: boolean | null;
}

export function buildFerryPartnerEmail(order: FerryPartnerEmailInput) {
  const direction = niDirectionOf(order) || 'outbound';
  const inbound = direction === 'inbound';
  const party = inbound ? order.sender : order.receiver;
  const other = inbound ? order.receiver : order.sender;
  const trackingNumber = order.tracking_number || '';
  const bike = [order.bike_brand, order.bike_model].filter(Boolean).join(' ').trim() || 'Bicycle';
  const quantity = order.bike_quantity || 1;

  const heading = inbound
    ? 'Northern Ireland collection — please arrange the NI-side pickup'
    : 'Northern Ireland delivery — please arrange the onward transport';

  const partyLabel = inbound ? 'NI collection address' : 'NI delivery address';

  const subject = inbound
    ? `NI collection booking — ${trackingNumber}`
    : `NI delivery booking — ${trackingNumber}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>${esc(heading)}</h2>
      <p>The Cycle Courier Co. has a Northern Ireland job for you.</p>
      <div style="background-color: #f7f7f7; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p style="margin-top:0;"><strong>Tracking number:</strong> ${esc(trackingNumber)}</p>
        <p><strong>Item:</strong> ${esc(bike)}</p>
        <p style="margin-bottom:0;"><strong>Quantity:</strong> ${esc(quantity)}</p>
      </div>
      <div style="background-color: #fff4e5; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #f59e0b;">
        <p style="margin-top:0;"><strong>${esc(partyLabel)}</strong></p>
        <p><strong>Name:</strong> ${esc(party?.name)}</p>
        <p><strong>Address:</strong> ${esc(formatAddress(party?.address))}</p>
        <p><strong>Phone:</strong> ${esc(party?.phone)}</p>
        <p style="margin-bottom:0;"><strong>Email:</strong> ${esc(party?.email)}</p>
      </div>
      <p>
        ${inbound
          ? `Please collect from the address above in Northern Ireland and hand the item over to us at ${esc(CITY_AIR_EXPRESS.formatted)}. The onward mainland delivery is to ${esc(other?.name)} and is handled by us.`
          : `We will deliver the item to the ferry hand-off point at ${esc(CITY_AIR_EXPRESS.formatted)} for onward transport to the Northern Ireland address above. Collected from ${esc(other?.name)}.`}
      </p>
      <p>Any questions, just reply to this email.</p>
      <p>The Cycle Courier Co. Team</p>
    </div>
  `;

  return { to: CITY_AIR_EXPRESS.email, subject, html, direction };
}
