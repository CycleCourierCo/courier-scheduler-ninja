import * as Sentry from "@sentry/react";
import { CreateOrderFormData } from "@/types/order";
import { createOrder } from "@/services/orderService";
import { BIKE_TYPE_BY_ID } from "@/constants/bikePricing";
import * as XLSX from "xlsx";

const VALID_BIKE_TYPES = Object.values(BIKE_TYPE_BY_ID);

// Dealer spreadsheet column mapping
const DEALER_COLUMN_MAP: Record<string, string> = {
  "order number": "order_number",
  "dealer name": "receiver_name",
  "street address": "receiver_street",
  "city": "receiver_city",
  "postcode": "receiver_postcode",
  "email": "receiver_email",
  "telephone": "receiver_phone",
  "brand": "bike_brand",
  "model": "bike_model",
  "size": "bike_size",
  "type": "bike_type",
};

// Map dealer "Type" values to system bike types
const DEALER_TYPE_MAP: Record<string, string> = {
  frame: "Wheelset/Frameset",
  bike: "Non-Electric - Mountain Bike",
  ebike: "Electric Bike - Under 25kg",
  "e-bike": "Electric Bike - Under 25kg",
  "electric bike": "Electric Bike - Under 25kg",
  "kids bike": "Kids Bikes",
  bmx: "BMX Bikes",
  folding: "Folding Bikes",
};

export const CSV_TEMPLATE_HEADERS = [
  "sender_name", "sender_email", "sender_phone",
  "sender_street", "sender_city", "sender_postcode",
  "receiver_name", "receiver_email", "receiver_phone",
  "receiver_street", "receiver_city", "receiver_postcode",
  "bike_brand", "bike_model", "bike_type", "bike_value",
  "customer_order_number", "delivery_instructions",
];

export interface ParsedOrderRow {
  rowIndex: number;
  data: Record<string, string>;
  errors: RowError[];
  included: boolean;
}

export interface GroupedOrder {
  orderNumber: string;
  receiverData: Record<string, string>;
  bikes: Array<{ brand: string; model: string; type: string; size?: string; value?: string }>;
  errors: RowError[];
  included: boolean;
  sourceRowIndices: number[];
}

export interface RowError {
  field: string;
  message: string;
}

export interface BulkCreateResult {
  orderNumber: string;
  rowIndex: number;
  success: boolean;
  orderId?: string;
  trackingNumber?: string;
  error?: string;
}

export interface UserProfileData {
  name: string;
  email: string;
  phone: string;
  address_line_1: string;
  city: string;
  county?: string;
  address_line_2?: string;
  postal_code: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

export function downloadCSVTemplate() {
  const csvContent = CSV_TEMPLATE_HEADERS.join(",") + "\n";
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "bulk_order_template.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

function normalizePhone(phone: string): string {
  const stripped = phone.replace(/[\s\-\(\)]/g, "");
  if (stripped.startsWith("+44")) return stripped;
  if (stripped.startsWith("0")) return "+44" + stripped.substring(1);
  return stripped;
}

function mapDealerType(rawType: string): string {
  const lower = rawType.toLowerCase().trim();
  if (DEALER_TYPE_MAP[lower]) return DEALER_TYPE_MAP[lower];
  // Try matching against known bike types
  const match = VALID_BIKE_TYPES.find((t) => t.toLowerCase() === lower);
  if (match) return match;
  return "Non-Electric - Mountain Bike"; // default fallback
}

function isDealerFormat(headers: string[]): boolean {
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());
  return lowerHeaders.includes("order number") && lowerHeaders.includes("dealer name");
}

function mapDealerHeaders(headers: string[]): string[] {
  return headers.map((h) => {
    const lower = h.toLowerCase().trim();
    return DEALER_COLUMN_MAP[lower] || lower.replace(/\s+/g, "_");
  });
}

export function parseFile(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });

          if (jsonRows.length === 0) { resolve([]); return; }

          const originalHeaders = Object.keys(jsonRows[0]);
          const isDealerFmt = isDealerFormat(originalHeaders);
          const mappedHeaders = isDealerFmt ? mapDealerHeaders(originalHeaders) : originalHeaders;

          const rows = jsonRows.map((row) => {
            const mapped: Record<string, string> = {};
            originalHeaders.forEach((origKey, idx) => {
              mapped[mappedHeaders[idx]] = String(row[origKey] ?? "").trim();
            });
            return mapped;
          });
          resolve(rows);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) { resolve([]); return; }

        // Find the actual header row by scanning for known column names
        const knownHeaders = ["order number", "dealer name", "sender_name", "receiver_name", "bike_brand"];
        let headerLineIdx = 0;
        for (let i = 0; i < Math.min(lines.length, 10); i++) {
          const lower = lines[i].toLowerCase();
          if (knownHeaders.some((kh) => lower.includes(kh))) {
            headerLineIdx = i;
            break;
          }
        }

        let rawHeaders = parseCSVLine(lines[headerLineIdx]);

        // Strip empty leading columns
        let emptyLeadingCols = 0;
        while (emptyLeadingCols < rawHeaders.length && rawHeaders[emptyLeadingCols].trim() === "") {
          emptyLeadingCols++;
        }
        if (emptyLeadingCols > 0) {
          rawHeaders = rawHeaders.slice(emptyLeadingCols);
        }

        const isDealerFmt = isDealerFormat(rawHeaders);
        const headers = isDealerFmt
          ? mapDealerHeaders(rawHeaders)
          : rawHeaders.map((h) => h.trim().toLowerCase());

        const rows: Record<string, string>[] = [];
        for (let i = headerLineIdx + 1; i < lines.length; i++) {
          let values = parseCSVLine(lines[i]);
          if (emptyLeadingCols > 0) {
            values = values.slice(emptyLeadingCols);
          }
          const data: Record<string, string> = {};
          headers.forEach((header, idx) => {
            data[header] = (values[idx] || "").trim();
          });
          // Skip rows where all values are empty
          if (Object.values(data).every((v) => v === "")) continue;
          rows.push(data);
        }
        resolve(rows);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    }
  });
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current); current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

export function groupRowsByOrderNumber(rows: Record<string, string>[]): GroupedOrder[] {
  const groups = new Map<string, { rows: Record<string, string>[]; indices: number[] }>();

  rows.forEach((row, idx) => {
    const orderNum = row.order_number || row.customer_order_number || `single_${idx + 1}`;
    if (!groups.has(orderNum)) {
      groups.set(orderNum, { rows: [], indices: [] });
    }
    groups.get(orderNum)!.rows.push(row);
    groups.get(orderNum)!.indices.push(idx + 1);
  });

  const grouped: GroupedOrder[] = [];
  for (const [orderNumber, { rows: groupRows, indices }] of groups) {
    const first = groupRows[0];

    const bikes = groupRows.map((r) => {
      const rawType = r.bike_type || "Bike";
      const model = r.bike_size ? `${r.bike_model} (${r.bike_size})` : r.bike_model;
      return {
        brand: r.bike_brand || "",
        model: model || "",
        type: mapDealerType(rawType),
        size: r.bike_size || undefined,
        value: r.bike_value || "",
      };
    });

    const errors = validateGroupedOrder(first, bikes, orderNumber);
    grouped.push({
      orderNumber: orderNumber.startsWith("single_") ? "" : orderNumber,
      receiverData: first,
      bikes,
      errors,
      included: errors.length === 0,
      sourceRowIndices: indices,
    });
  }

  return grouped;
}

function validateGroupedOrder(
  receiver: Record<string, string>,
  bikes: Array<{ brand: string; model: string; type: string; value?: string }>,
  orderNumber: string
): RowError[] {
  const errors: RowError[] = [];

  if (!receiver.receiver_name) errors.push({ field: "receiver_name", message: "Receiver name is required" });
  if (!receiver.receiver_street) errors.push({ field: "receiver_street", message: "Receiver street is required" });
  if (!receiver.receiver_postcode) errors.push({ field: "receiver_postcode", message: "Receiver postcode is required" });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (receiver.receiver_email && !emailRegex.test(receiver.receiver_email)) {
    errors.push({ field: "receiver_email", message: "Invalid email format" });
  }

  bikes.forEach((bike, i) => {
    if (!bike.brand) errors.push({ field: `bike_${i}_brand`, message: `Bike ${i + 1}: brand is required` });
    if (!bike.value) errors.push({ field: `bike_${i}_value`, message: `Bike ${i + 1}: value is required` });
  });

  return errors;
}

export function validateProfileForSender(profile: any): string[] {
  const missing: string[] = [];
  if (!profile?.name) missing.push("name");
  if (!profile?.email) missing.push("email");
  if (!profile?.phone) missing.push("phone");
  if (!profile?.address_line_1) missing.push("address");
  return missing;
}

function buildSenderFromProfile(profile: UserProfileData) {
  let phone = profile.phone || "";
  if (phone && !phone.startsWith("+44")) {
    phone = phone.replace(/^0+/, "");
    phone = `+44${phone}`;
  }

  return {
    name: profile.name,
    email: profile.email,
    phone,
    address: {
      street: profile.address_line_1,
      city: profile.city || "",
      state: profile.county || profile.address_line_2 || "",
      zipCode: profile.postal_code || "",
      country: profile.country || "United Kingdom",
      lat: profile.latitude,
      lon: profile.longitude,
    },
  };
}

function groupedOrderToFormData(order: GroupedOrder, profile: UserProfileData): CreateOrderFormData {
  const r = order.receiverData;
  const phone = r.receiver_phone ? normalizePhone(r.receiver_phone) : "";

  return {
    sender: buildSenderFromProfile(profile),
    receiver: {
      name: r.receiver_name || "",
      email: r.receiver_email || "",
      phone,
      address: {
        street: r.receiver_street || "",
        city: r.receiver_city || "",
        state: "",
        zipCode: r.receiver_postcode || "",
        country: "United Kingdom",
      },
    },
    bikeQuantity: order.bikes.length,
    bikes: order.bikes.map((b) => ({
      brand: b.brand,
      model: b.model,
      type: b.type,
      value: b.value || undefined,
    })),
    customerOrderNumber: order.orderNumber || undefined,
    needsPaymentOnCollection: false,
    isBikeSwap: false,
    isEbayOrder: false,
    needsInspection: false,
    bikeBrand: order.bikes.length > 1 ? 'Multiple bikes' : (order.bikes[0]?.brand || ''),
    bikeModel: order.bikes.length > 1 ? `${order.bikes.length} bikes` : (order.bikes[0]?.model || ''),
    bikeType: order.bikes.length > 1 ? 'Multiple types' : (order.bikes[0]?.type || ''),
  };
}

export async function createBulkOrders(
  orders: GroupedOrder[],
  profile: UserProfileData,
  onProgress: (result: BulkCreateResult) => void
): Promise<BulkCreateResult[]> {
  const results: BulkCreateResult[] = [];
  const included = orders.filter((o) => o.included && o.errors.length === 0);

  for (const order of included) {
    try {
      const formData = groupedOrderToFormData(order, profile);
      const created = await createOrder(formData);

      const result: BulkCreateResult = {
        orderNumber: order.orderNumber,
        rowIndex: order.sourceRowIndices[0],
        success: true,
        orderId: created.id,
        trackingNumber: created.trackingNumber,
      };
      results.push(result);
      onProgress(result);

      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (error) {
      Sentry.captureException(error);
      const result: BulkCreateResult = {
        orderNumber: order.orderNumber,
        rowIndex: order.sourceRowIndices[0],
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
      results.push(result);
      onProgress(result);
    }
  }

  return results;
}
