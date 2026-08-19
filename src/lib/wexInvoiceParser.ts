/**
 * Parser for WEX Europe Services (Esso) fuel invoices.
 *
 * The invoices are text based PDFs with a "Transaction detail" table:
 *
 * Trx Ref   Trx date  time   Site name and town   Vehicle ID  Odo  Product        Zone Quantity Unit price Net    VAT%  VAT   Gross
 * 00396732  09.08.26  09:21  365001RSS MOSELEY    KW65ULZ       5  Energy Diesel  CN   77.49    1.4304     110.84 20.00% 22.17 133.01
 *
 * Card subtotal rows look like:
 * 706405*********0100 KW65 ULZ   ESSO   Total card: 522.11  104.43  626.54
 */

export interface WexTransactionRow {
  trxReference: string;
  trxDate: string; // yyyy-MM-dd
  trxTime: string | null;
  siteName: string;
  rawVehicleId: string;
  normalisedReg: string;
  odometer: number | null;
  product: string;
  zone: string | null;
  quantityLitres: number;
  unitPrice: number | null;
  netAmount: number;
  vatRate: number | null;
  vatAmount: number;
  grossAmount: number;
}

export interface WexCardTotal {
  cardMask: string;
  cardLabel: string; // registration printed on the card line
  normalisedCardReg: string;
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
}

export interface WexInvoiceParseResult {
  supplier: string;
  accountNumber: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null; // yyyy-MM-dd
  dueDate: string | null;
  currency: string;
  netTotal: number | null;
  vatTotal: number | null;
  grossTotal: number | null;
  transactions: WexTransactionRow[];
  cardTotals: WexCardTotal[];
  warnings: string[];
}

export const normaliseReg = (value: string | null | undefined): string =>
  (value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const num = (value: string | null | undefined): number | null => {
  if (value == null) return null;
  const cleaned = value.replace(/[£,%\s]/g, "").replace(/,/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

/** Converts dd.mm.yy to yyyy-MM-dd. */
const toIsoDate = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const m = value.match(/^(\d{2})\.(\d{2})\.(\d{2,4})$/);
  if (!m) return null;
  const [, dd, mm, yy] = m;
  const year = yy.length === 4 ? Number(yy) : 2000 + Number(yy);
  return `${year}-${mm}-${dd}`;
};

const REG_SINGLE = /^[A-Z]{2}\d{2}[A-Z]{2,3}$/;
const REG_PREFIX = /^[A-Z]{2}\d{2}$/;
const REG_SUFFIX = /^[A-Z]{2,3}$/;

/** Levenshtein distance, used to suggest the closest fleet registration. */
export const editDistance = (a: string, b: string): number => {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = curr;
  }
  return prev[n];
};

/** Finds the closest registration in `candidates` within `maxDistance`. */
export const closestReg = (
  reg: string,
  candidates: string[],
  maxDistance = 2
): { reg: string; distance: number } | null => {
  let best: { reg: string; distance: number } | null = null;
  for (const candidate of candidates) {
    const distance = editDistance(reg, candidate);
    if (distance <= maxDistance && (!best || distance < best.distance)) {
      best = { reg: candidate, distance };
    }
  }
  return best;
};

const parseTransactionLine = (line: string): WexTransactionRow | null => {
  const tokens = line.trim().split(/\s+/);
  if (tokens.length < 12) return null;
  if (!/^\d{6,}$/.test(tokens[0])) return null;
  if (!/^\d{2}\.\d{2}\.\d{2}$/.test(tokens[1])) return null;

  const productIdx = tokens.findIndex((t, i) => i > 2 && /^Energy$/i.test(t));
  if (productIdx < 4) return null;

  const trxReference = tokens[0];
  const trxDate = toIsoDate(tokens[1]);
  if (!trxDate) return null;
  const hasTime = /^\d{2}:\d{2}$/.test(tokens[2]);
  const trxTime = hasTime ? tokens[2] : null;

  // Tail: quantity, unit price, net, vat rate, vat, gross (the "%" may be its own token)
  const tail = tokens.slice(productIdx + 1);
  const numeric: string[] = [];
  const productParts: string[] = ["Energy"];
  let zone: string | null = null;
  for (const token of tail) {
    if (token === "%") continue;
    if (/^-?[\d,]+\.?\d*%?$/.test(token)) {
      numeric.push(token);
    } else if (numeric.length === 0) {
      if (/^[A-Z]{2}$/.test(token) && productParts.length > 1) zone = token;
      else productParts.push(token);
    }
  }
  if (numeric.length < 6) return null;
  const [quantity, unitPrice, netAmount, vatRate, vatAmount, grossAmount] =
    numeric.slice(numeric.length - 6);

  // Between the time and the product: site name, vehicle id, odometer
  const middle = tokens.slice(hasTime ? 3 : 2, productIdx);
  if (middle.length < 2) return null;
  const odoToken = middle[middle.length - 1];
  const odometer = /^\d+$/.test(odoToken) ? Number(odoToken) : null;
  const beforeOdo = odometer == null ? middle : middle.slice(0, -1);
  if (!beforeOdo.length) return null;

  let regTokens: string[];
  const last = beforeOdo[beforeOdo.length - 1];
  const secondLast = beforeOdo[beforeOdo.length - 2];
  if (REG_SINGLE.test(last)) {
    regTokens = [last];
  } else if (secondLast && REG_PREFIX.test(secondLast) && REG_SUFFIX.test(last)) {
    regTokens = [secondLast, last];
  } else {
    regTokens = [last];
  }
  const rawVehicleId = regTokens.join(" ");
  const siteName = beforeOdo.slice(0, beforeOdo.length - regTokens.length).join(" ");

  return {
    trxReference,
    trxDate,
    trxTime,
    siteName,
    rawVehicleId,
    normalisedReg: normaliseReg(rawVehicleId),
    odometer,
    product: productParts.join(" "),
    zone,
    quantityLitres: num(quantity) ?? 0,
    unitPrice: num(unitPrice),
    netAmount: num(netAmount) ?? 0,
    vatRate: num(vatRate),
    vatAmount: num(vatAmount) ?? 0,
    grossAmount: num(grossAmount) ?? 0,
  };
};

const parseCardTotalLine = (line: string): WexCardTotal | null => {
  const m = line.match(
    /^([\d*]{10,})\s+([A-Z0-9 ]{5,10}?)\s{2,}.*?Total card:\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})/
  );
  if (!m) return null;
  const [, cardMask, cardLabel, net, vat, gross] = m;
  return {
    cardMask,
    cardLabel: cardLabel.trim(),
    normalisedCardReg: normaliseReg(cardLabel),
    netAmount: num(net) ?? 0,
    vatAmount: num(vat) ?? 0,
    grossAmount: num(gross) ?? 0,
  };
};

export const parseWexInvoiceText = (text: string): WexInvoiceParseResult => {
  const lines = text.split(/\r?\n/);
  const warnings: string[] = [];
  const transactions: WexTransactionRow[] = [];
  const cardTotals: WexCardTotal[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const trx = parseTransactionLine(line);
    if (trx) {
      transactions.push(trx);
      continue;
    }
    const card = parseCardTotalLine(line);
    if (card) cardTotals.push(card);
  }

  const summary = text.match(
    /(\d{6,})\s+(\d{2}\.\d{2}\.\d{2})\s+([A-Z]{2,4}\d{4,})\s+(\d{2}\.\d{2}\.\d{2})\s+([A-Z]{3})/
  );
  const totals = text.match(
    /INVOICE TOTAL\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})/i
  );

  if (!transactions.length) warnings.push("No fuel transactions could be read from this PDF.");
  if (!summary) warnings.push("Invoice number and dates could not be read from this PDF.");

  const netFromRows = transactions.reduce((sum, t) => sum + t.netAmount, 0);
  const netTotal = totals ? num(totals[1]) : null;
  if (netTotal != null && Math.abs(netTotal - netFromRows) > 0.05) {
    warnings.push(
      `Invoice net total (£${netTotal.toFixed(2)}) does not match the sum of the parsed rows (£${netFromRows.toFixed(2)}).`
    );
  }

  return {
    supplier: "WEX Europe Services",
    accountNumber: summary?.[1] ?? null,
    invoiceNumber: summary?.[3] ?? null,
    invoiceDate: toIsoDate(summary?.[2]),
    dueDate: toIsoDate(summary?.[4]),
    currency: summary?.[5] ?? "GBP",
    netTotal,
    vatTotal: totals ? num(totals[2]) : null,
    grossTotal: totals ? num(totals[3]) : null,
    transactions,
    cardTotals,
    warnings,
  };
};

export const LITRES_PER_UK_GALLON = 4.54609;

export const litresToGallons = (litres: number) => litres / LITRES_PER_UK_GALLON;

export const mpg = (miles: number, litres: number): number | null =>
  litres > 0 && miles > 0 ? miles / litresToGallons(litres) : null;

export const litresPer100Km = (miles: number, litres: number): number | null =>
  miles > 0 && litres > 0 ? (litres / (miles * 1.609344)) * 100 : null;
