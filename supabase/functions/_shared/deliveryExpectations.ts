/**
 * Customer-facing expectations on typical time frames.
 *
 * Used by every proactive update email and the milestone emails so customers
 * always know what "normal" looks like and stop chasing us for updates.
 *
 * Keep the remote-area list here — it is the single source of truth.
 */

export const STANDARD_TIMEFRAME_TEXT =
  "We typically collect within 2-4 working days of dates being agreed, and deliver within 2-4 working days of collection.";

export const REMOTE_TIMEFRAME_TEXT =
  "Because this journey covers a more remote area, please allow a little longer than our usual 2-4 working days.";

/**
 * Outward-code prefixes for areas that routinely take longer than the standard
 * window: Cornwall and Devon, the Lake District and far north west, Scotland
 * (especially Highlands and islands), mid and west Wales, Northern Ireland and
 * the Isle of Wight / other islands.
 */
export const REMOTE_AREA_PREFIXES: string[] = [
  // Cornwall & Devon
  "TR", "PL", "EX", "TQ",
  // Lake District / far north west & north east
  "LA", "CA", "TD", "NE48", "NE47", "NE49",
  // Wales (mid & west)
  "SY", "LL", "SA", "LD", "AB31",
  // Scotland
  "AB", "DD", "DG", "EH", "FK", "G", "HS", "IV", "KA", "KW", "KY", "ML", "PA", "PH", "ZE",
  // Northern Ireland
  "BT",
  // Isle of Wight / Isle of Man / Channel Islands / Scilly
  "PO3", "PO4", "IM", "GY", "JE",
];

const normalisePostcode = (postcode?: string | null): string =>
  (postcode || "").toUpperCase().replace(/\s+/g, "");

/** Outward code, e.g. "TR11 2AB" -> "TR11". */
const outwardCode = (postcode: string): string => {
  const p = normalisePostcode(postcode);
  if (p.length <= 4) return p;
  return p.slice(0, p.length - 3);
};

export function isRemoteAreaPostcode(postcode?: string | null): boolean {
  const outward = outwardCode(postcode || "");
  if (!outward) return false;

  // Longer prefixes (with digits) must match the start of the outward code.
  for (const prefix of REMOTE_AREA_PREFIXES) {
    if (/\d/.test(prefix)) {
      if (outward.startsWith(prefix)) return true;
    }
  }

  // Letter-only prefixes must match the alphabetic part of the outward code exactly.
  const letters = outward.replace(/[^A-Z]/g, "");
  return REMOTE_AREA_PREFIXES.some((prefix) => !/\d/.test(prefix) && letters === prefix);
}

export interface ExpectationInput {
  senderPostcode?: string | null;
  receiverPostcode?: string | null;
  isNorthernIreland?: boolean | null;
}

export function isRemoteJourney(input: ExpectationInput): boolean {
  if (input.isNorthernIreland) return true;
  return (
    isRemoteAreaPostcode(input.senderPostcode) ||
    isRemoteAreaPostcode(input.receiverPostcode)
  );
}

/** Plain-text expectations note. */
export function expectationsText(input: ExpectationInput): string {
  return isRemoteJourney(input)
    ? `${STANDARD_TIMEFRAME_TEXT} ${REMOTE_TIMEFRAME_TEXT}`
    : STANDARD_TIMEFRAME_TEXT;
}

/** HTML expectations note, styled as a soft info panel. */
export function expectationsHtml(input: ExpectationInput): string {
  return `
    <div style="background-color:#eef4ff;border-left:4px solid #4a65d5;padding:12px 16px;border-radius:5px;margin:20px 0;">
      <p style="margin:0;font-size:14px;line-height:1.6;color:#1f2937;">
        <strong>Typical time frames:</strong> ${expectationsText(input)}
      </p>
    </div>
  `;
}

/** Convenience wrapper that reads the postcodes straight off an order row. */
export function expectationsForOrder(order: any): ExpectationInput {
  return {
    senderPostcode: order?.sender?.address?.zipCode || order?.sender?.address?.postcode,
    receiverPostcode: order?.receiver?.address?.zipCode || order?.receiver?.address?.postcode,
    isNorthernIreland: order?.is_northern_ireland,
  };
}
