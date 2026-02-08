import { OrderData } from "@/pages/JobScheduling";

export interface CSVRow {
  sequence: number;
  name: string;
  address: string;
}

export interface MatchResult {
  csvRow: CSVRow;
  matchedOrder: OrderData | null;
  matchType: 'exact' | 'fuzzy' | 'address' | 'none';
  jobType: 'pickup' | 'delivery' | null;
  confidence: number;
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
  
  let bestMatch: MatchResult = {
    csvRow: row,
    matchedOrder: null,
    matchType: 'none',
    jobType: null,
    confidence: 0
  };
  
  for (const order of orders) {
    // Skip already matched orders for this job type
    const senderName = normalizeName(order.sender.name);
    const receiverName = normalizeName(order.receiver.name);
    
    // Check sender (pickup) match
    let senderConfidence = 0;
    let senderMatchType: 'exact' | 'fuzzy' | 'address' | 'none' = 'none';
    
    if (senderName === normalizedCSVName) {
      senderConfidence = 1.0;
      senderMatchType = 'exact';
    } else if (senderName.includes(normalizedCSVName) || normalizedCSVName.includes(senderName)) {
      senderConfidence = 0.85;
      senderMatchType = 'fuzzy';
    } else {
      const similarity = stringSimilarity(senderName, normalizedCSVName);
      if (similarity > 0.7) {
        senderConfidence = similarity * 0.8;
        senderMatchType = 'fuzzy';
      }
    }
    
    // Boost confidence if postcodes match
    if (senderConfidence > 0 && csvPostcode) {
      const senderPostcode = extractPostcode(
        `${order.sender.address.street} ${order.sender.address.city} ${order.sender.address.zipCode}`
      );
      if (senderPostcode && senderPostcode === csvPostcode) {
        senderConfidence = Math.min(1.0, senderConfidence + 0.15);
      }
    }
    
    // Check receiver (delivery) match
    let receiverConfidence = 0;
    let receiverMatchType: 'exact' | 'fuzzy' | 'address' | 'none' = 'none';
    
    if (receiverName === normalizedCSVName) {
      receiverConfidence = 1.0;
      receiverMatchType = 'exact';
    } else if (receiverName.includes(normalizedCSVName) || normalizedCSVName.includes(receiverName)) {
      receiverConfidence = 0.85;
      receiverMatchType = 'fuzzy';
    } else {
      const similarity = stringSimilarity(receiverName, normalizedCSVName);
      if (similarity > 0.7) {
        receiverConfidence = similarity * 0.8;
        receiverMatchType = 'fuzzy';
      }
    }
    
    // Boost confidence if postcodes match
    if (receiverConfidence > 0 && csvPostcode) {
      const receiverPostcode = extractPostcode(
        `${order.receiver.address.street} ${order.receiver.address.city} ${order.receiver.address.zipCode}`
      );
      if (receiverPostcode && receiverPostcode === csvPostcode) {
        receiverConfidence = Math.min(1.0, receiverConfidence + 0.15);
      }
    }
    
    // Check for address-only match if no name match
    if (senderConfidence === 0 && receiverConfidence === 0 && csvPostcode) {
      const senderPostcode = extractPostcode(
        `${order.sender.address.street} ${order.sender.address.city} ${order.sender.address.zipCode}`
      );
      const receiverPostcode = extractPostcode(
        `${order.receiver.address.street} ${order.receiver.address.city} ${order.receiver.address.zipCode}`
      );
      
      if (senderPostcode === csvPostcode && !usedOrderIds.has(`${order.id}-pickup`)) {
        senderConfidence = 0.6;
        senderMatchType = 'address';
      }
      if (receiverPostcode === csvPostcode && !usedOrderIds.has(`${order.id}-delivery`)) {
        receiverConfidence = 0.6;
        receiverMatchType = 'address';
      }
    }
    
    // Take the best match for this order
    if (senderConfidence > receiverConfidence && senderConfidence > bestMatch.confidence) {
      if (!usedOrderIds.has(`${order.id}-pickup`)) {
        bestMatch = {
          csvRow: row,
          matchedOrder: order,
          matchType: senderMatchType,
          jobType: 'pickup',
          confidence: senderConfidence
        };
      }
    } else if (receiverConfidence > bestMatch.confidence) {
      if (!usedOrderIds.has(`${order.id}-delivery`)) {
        bestMatch = {
          csvRow: row,
          matchedOrder: order,
          matchType: receiverMatchType,
          jobType: 'delivery',
          confidence: receiverConfidence
        };
      }
    }
  }
  
  return bestMatch;
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
