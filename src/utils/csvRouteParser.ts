import { OrderData } from "@/pages/JobScheduling";
import { needsCollectionLeg, needsDeliveryLeg } from "@/components/scheduling/heatJobPoints";
import { getLegContact, isFerryLeg } from "@/utils/niDelivery";
import { CITY_AIR_EXPRESS } from "@/constants/depot";

export interface CSVRow {
  sequence: number;
  name: string;
  address: string;
}

export interface MatchCandidate {
  order: OrderData;
  jobType: 'pickup' | 'delivery';
  matchType: 'exact' | 'fuzzy' | 'address';
  confidence: number;
  /** This leg already has a booked date — shown, but never the default pick */
  alreadyScheduled?: boolean;
}

export interface MatchResult {
  csvRow: CSVRow;
  matchedOrder: OrderData | null;
  matchType: 'exact' | 'fuzzy' | 'address' | 'none';
  jobType: 'pickup' | 'delivery' | null;
  confidence: number;
  /** All plausible order/leg candidates for this row, best first */
  candidates: MatchCandidate[];
}

// Depot addresses to exclude from matching
const DEPOT_PATTERNS = [
  'lawden road',
  'b100ad',
  'b10 0ad',
  'pickup location',
  'back to pick up location'
];

/**
 * Parse CSV content into rows
 */
export const parseCSV = (content: string): CSVRow[] => {
  const lines = content.split('\n').filter(line => line.trim());
  
  // Skip header row
  const dataLines = lines.slice(1);
  
  const rows: CSVRow[] = [];
  
  for (const line of dataLines) {
    // Handle CSV with quoted values containing commas
    const matches = line.match(/(?:^|,)("(?:[^"]*(?:""[^"]*)*)"|[^,]*)/g);
    
    if (!matches || matches.length < 3) continue;
    
    const cleanValue = (val: string) => {
      // Remove leading comma and quotes
      return val.replace(/^,/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim();
    };
    
    const sequence = parseInt(cleanValue(matches[0]));
    const name = cleanValue(matches[1]);
    const address = cleanValue(matches[2]);
    
    if (isNaN(sequence)) continue;
    
    rows.push({ sequence, name, address });
  }
  
  return rows;
};

/**
 * Check if a row is a depot location
 */
export const isDepotRow = (row: CSVRow): boolean => {
  const lowerAddress = row.address.toLowerCase();
  const lowerName = row.name.toLowerCase();
  
  return DEPOT_PATTERNS.some(pattern => 
    lowerAddress.includes(pattern) || lowerName.includes(pattern)
  );
};

/**
 * Normalize a name for comparison
 */
const normalizeName = (name: string): string => {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
};

/**
 * Calculate Levenshtein distance for fuzzy matching
 */
const levenshteinDistance = (str1: string, str2: string): number => {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j - 1] + 1,
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1
        );
      }
    }
  }
  
  return dp[m][n];
};

/**
 * Calculate similarity score (0-1) between two strings
 */
const stringSimilarity = (str1: string, str2: string): number => {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
};

/**
 * Extract postcode from address string
 */
const extractPostcode = (address: string): string | null => {
  // UK postcode pattern
  const postcodeMatch = address.match(/[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}/i);
  return postcodeMatch ? postcodeMatch[0].toUpperCase().replace(/\s/g, '') : null;
};

/** Names a Northern Ireland ferry hand-off stop can appear under in a route file */
const FERRY_NAME_ALIASES = [CITY_AIR_EXPRESS.name, CITY_AIR_EXPRESS.displayName].map(normalizeName);
const FERRY_POSTCODE = extractPostcode(CITY_AIR_EXPRESS.address.zipCode);

/**
 * Score a route row against the stop a driver actually visits for this leg.
 * For Northern Ireland orders that stop is the ferry hand-off point, not the
 * customer's own address.
 */
const scoreLeg = (
  order: OrderData,
  type: 'pickup' | 'delivery',
  normalizedCSVName: string,
  csvPostcode: string | null
): { confidence: number; matchType: 'exact' | 'fuzzy' | 'address' | 'none' } => {
  const ferry = isFerryLeg(order, type);
  const contact: any = ferry
    ? getLegContact(order, type)
    : (type === 'pickup' ? order.sender : order.receiver);

  const names = ferry ? FERRY_NAME_ALIASES : [normalizeName(contact?.name || '')];
  const legPostcode = ferry
    ? FERRY_POSTCODE
    : extractPostcode(
        `${contact?.address?.street || ''} ${contact?.address?.city || ''} ${contact?.address?.zipCode || ''}`
      );

  let confidence = 0;
  let matchType: 'exact' | 'fuzzy' | 'address' | 'none' = 'none';

  for (const name of names) {
    if (!name) continue;
    if (name === normalizedCSVName) {
      if (1.0 > confidence) { confidence = 1.0; matchType = 'exact'; }
      continue;
    }
    if (name.includes(normalizedCSVName) || normalizedCSVName.includes(name)) {
      if (0.85 > confidence) { confidence = 0.85; matchType = 'fuzzy'; }
      continue;
    }
    const similarity = stringSimilarity(name, normalizedCSVName);
    if (similarity > 0.7 && similarity * 0.8 > confidence) {
      confidence = similarity * 0.8;
      matchType = 'fuzzy';
    }
  }

  const postcodeMatches = !!(csvPostcode && legPostcode && legPostcode === csvPostcode);

  if (confidence > 0 && postcodeMatches) {
    confidence = Math.min(1.0, confidence + 0.15);
  }

  // Address-only match when the name tells us nothing
  if (confidence === 0 && postcodeMatches) {
    confidence = 0.6;
    matchType = 'address';
  }

  return { confidence, matchType };
};

/**
 * Match a single CSV row to orders
 */
const matchRowToOrder = (
  row: CSVRow, 
  orders: OrderData[],
  usedOrderIds: Set<string>
): MatchResult => {
  const normalizedCSVName = normalizeName(row.name);
  const csvPostcode = extractPostcode(row.address);
  
  const candidates: MatchCandidate[] = [];
  
  for (const order of orders) {
    const pickup = scoreLeg(order, 'pickup', normalizedCSVName, csvPostcode);
    const delivery = scoreLeg(order, 'delivery', normalizedCSVName, csvPostcode);

    // Record plausible candidates, but only for legs that still need driving.
    // Collected bikes, Box My Bike deliveries and completed/cancelled orders are
    // dropped so they no longer compete with live work.
    if (pickup.confidence > 0 && pickup.matchType !== 'none' && needsCollectionLeg(order)) {
      candidates.push({
        order,
        jobType: 'pickup',
        matchType: pickup.matchType,
        confidence: pickup.confidence,
        alreadyScheduled: !!order.scheduled_pickup_date,
      });
    }
    if (delivery.confidence > 0 && delivery.matchType !== 'none' && needsDeliveryLeg(order)) {
      candidates.push({
        order,
        jobType: 'delivery',
        matchType: delivery.matchType,
        confidence: delivery.confidence,
        alreadyScheduled: !!order.scheduled_delivery_date,
      });
    }
  }
  
  // Outstanding, unbooked legs first; already-booked legs sink to the bottom
  candidates.sort((a, b) => {
    if (!!a.alreadyScheduled !== !!b.alreadyScheduled) return a.alreadyScheduled ? 1 : -1;
    return b.confidence - a.confidence;
  });
  
  // Default selection = best candidate whose leg isn't already used by an earlier row
  const best = candidates.find(c => !usedOrderIds.has(`${c.order.id}-${c.jobType}`));
  
  return {
    csvRow: row,
    matchedOrder: best?.order ?? null,
    matchType: best?.matchType ?? 'none',
    jobType: best?.jobType ?? null,
    confidence: best?.confidence ?? 0,
    candidates,
  };
};

/**
 * Match all CSV rows to orders
 */
export const matchCSVToOrders = (csvRows: CSVRow[], orders: OrderData[]): MatchResult[] => {
  const results: MatchResult[] = [];
  const usedOrderIds = new Set<string>();
  
  // Filter out depot rows
  const jobRows = csvRows.filter(row => !isDepotRow(row));
  
  // Match in sequence order
  for (const row of jobRows) {
    const match = matchRowToOrder(row, orders, usedOrderIds);
    
    if (match.matchedOrder && match.jobType) {
      usedOrderIds.add(`${match.matchedOrder.id}-${match.jobType}`);
    }
    
    results.push(match);
  }
  
  return results;
};

/**
 * Get statistics about match results
 */
export const getMatchStats = (results: MatchResult[]) => {
  const total = results.length;
  const matched = results.filter(r => r.matchedOrder !== null).length;
  const exact = results.filter(r => r.matchType === 'exact').length;
  const fuzzy = results.filter(r => r.matchType === 'fuzzy').length;
  const address = results.filter(r => r.matchType === 'address').length;
  const unmatched = results.filter(r => r.matchType === 'none').length;
  
  return { total, matched, exact, fuzzy, address, unmatched };
};

/**
 * Route analysis result interface
 */
export interface RouteAnalysis {
  fileName: string;
  totalMatched: number;
  viableJobs: number;
  collections: number;
  viableCollections: number;
  deliveries: number;
  viableDeliveries: number;
  issues: {
    notCollected: number;
    collectionWrongDate: number;
    deliveryWrongDate: number;
  };
  matchResults: MatchResult[];
  viableMatchResults: MatchResult[];
}

/**
 * Check if a date array contains the target date or is empty (any date)
 */
const isDateAvailable = (dateArray: string[] | null | undefined, targetDate: Date | undefined): boolean => {
  // If no target date filter, everything is available
  if (!targetDate) return true;
  
  // If date array is empty or null, it means "any date" which is available
  if (!dateArray || dateArray.length === 0) return true;
  
  // Check if target date is in the array
  const targetDateStr = targetDate.toISOString().split('T')[0];
  return dateArray.some(date => {
    const dateStr = new Date(date).toISOString().split('T')[0];
    return dateStr === targetDateStr;
  });
};

/**
 * Analyze route viability based on collection status and date availability
 */
export const analyzeRouteViability = (
  matchResults: MatchResult[],
  targetDate: Date | undefined,
  fileName: string
): RouteAnalysis => {
  const matched = matchResults.filter(r => r.matchedOrder !== null);
  const collections = matched.filter(r => r.jobType === 'pickup');
  const deliveries = matched.filter(r => r.jobType === 'delivery');
  
  // Build a set of order IDs that have a pickup in this route (for same-route collection check)
  const pickupOrderIds = new Set<string>();
  const pickupSequences = new Map<string, number>();
  
  matched.forEach(r => {
    if (r.jobType === 'pickup' && r.matchedOrder) {
      pickupOrderIds.add(r.matchedOrder.id);
      pickupSequences.set(r.matchedOrder.id, r.csvRow.sequence);
    }
  });
  
  let viableCollections = 0;
  let viableDeliveries = 0;
  let notCollected = 0;
  let collectionWrongDate = 0;
  let deliveryWrongDate = 0;
  
  const viableMatchResults: MatchResult[] = [];
  
  for (const result of matched) {
    const order = result.matchedOrder!;
    
    if (result.jobType === 'pickup') {
      // Collection is viable if pickup_date is empty or contains target date
      const pickupDates = order.pickup_date as string[] | null;
      const dateAvailable = isDateAvailable(pickupDates, targetDate);
      
      if (dateAvailable) {
        viableCollections++;
        viableMatchResults.push(result);
      } else {
        collectionWrongDate++;
      }
    } else if (result.jobType === 'delivery') {
      // Delivery is viable if:
      // 1. order_collected === true OR there's a pickup earlier in this route
      // 2. AND delivery_date is empty or contains target date
      
      const isCollected = order.order_collected === true;
      const hasPickupInRoute = pickupOrderIds.has(order.id);
      const pickupSequence = pickupSequences.get(order.id);
      const deliverySequence = result.csvRow.sequence;
      const isPickupBeforeDelivery = hasPickupInRoute && pickupSequence !== undefined && pickupSequence < deliverySequence;
      
      const collectionOk = isCollected || isPickupBeforeDelivery;
      
      const deliveryDates = order.delivery_date as string[] | null;
      const dateAvailable = isDateAvailable(deliveryDates, targetDate);
      
      if (collectionOk && dateAvailable) {
        viableDeliveries++;
        viableMatchResults.push(result);
      } else {
        if (!collectionOk) {
          notCollected++;
        }
        if (!dateAvailable) {
          deliveryWrongDate++;
        }
      }
    }
  }
  
  return {
    fileName,
    totalMatched: matched.length,
    viableJobs: viableCollections + viableDeliveries,
    collections: collections.length,
    viableCollections,
    deliveries: deliveries.length,
    viableDeliveries,
    issues: {
      notCollected,
      collectionWrongDate,
      deliveryWrongDate,
    },
    matchResults,
    viableMatchResults,
  };
};

/**
 * Collection status of a delivery candidate, relative to this CSV route
 */
export type DeliveryCollectionStatus =
  | { kind: 'collected' }
  | { kind: 'on_route_before'; sequence: number }
  | { kind: 'on_route_after'; sequence: number }
  | { kind: 'scheduled'; date: string }
  | { kind: 'not_collected' };

/**
 * Work out whether a bike for a delivery has been collected, is scheduled to be
 * collected, or is being collected on this same route (before or after the drop).
 */
export const getDeliveryCollectionStatus = (
  order: OrderData,
  deliverySequence: number,
  pickupSequenceByOrderId: Map<string, number>
): DeliveryCollectionStatus => {
  if (order.order_collected === true) return { kind: 'collected' };

  const pickupSeq = pickupSequenceByOrderId.get(order.id);
  if (pickupSeq !== undefined) {
    return pickupSeq < deliverySequence
      ? { kind: 'on_route_before', sequence: pickupSeq }
      : { kind: 'on_route_after', sequence: pickupSeq };
  }

  const scheduled = (order as any).scheduled_pickup_date as string | null | undefined;
  if (scheduled) return { kind: 'scheduled', date: scheduled };

  // Customer availability days are not a booked collection - treat as not collected
  return { kind: 'not_collected' };
};
