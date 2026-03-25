import { CreateOrderFormData } from "@/types/order";
import { createOrder } from "@/services/orderService";
import { BIKE_TYPE_BY_ID } from "@/constants/bikePricing";

const VALID_BIKE_TYPES = Object.values(BIKE_TYPE_BY_ID);

export const CSV_TEMPLATE_HEADERS = [
  "sender_name",
  "sender_email",
  "sender_phone",
  "sender_street",
  "sender_city",
  "sender_postcode",
  "receiver_name",
  "receiver_email",
  "receiver_phone",
  "receiver_street",
  "receiver_city",
  "receiver_postcode",
  "bike_brand",
  "bike_model",
  "bike_type",
  "bike_value",
  "customer_order_number",
  "delivery_instructions",
];

export interface ParsedOrderRow {
  rowIndex: number;
  data: Record<string, string>;
  errors: RowError[];
  included: boolean;
}

export interface RowError {
  field: string;
  message: string;
}

export interface BulkCreateResult {
  rowIndex: number;
  success: boolean;
  orderId?: string;
  trackingNumber?: string;
  error?: string;
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

export function parseOrderCSV(content: string): ParsedOrderRow[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());

  const rows: ParsedOrderRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const data: Record<string, string> = {};
    headers.forEach((header, idx) => {
      data[header] = (values[idx] || "").trim();
    });

    const errors = validateOrderRow(data);
    rows.push({
      rowIndex: i,
      data,
      errors,
      included: errors.length === 0,
    });
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

export function validateOrderRow(data: Record<string, string>): RowError[] {
  const errors: RowError[] = [];

  const required: [string, string][] = [
    ["sender_name", "Sender name"],
    ["sender_email", "Sender email"],
    ["sender_phone", "Sender phone"],
    ["sender_street", "Sender street"],
    ["sender_city", "Sender city"],
    ["sender_postcode", "Sender postcode"],
    ["receiver_name", "Receiver name"],
    ["receiver_email", "Receiver email"],
    ["receiver_phone", "Receiver phone"],
    ["receiver_street", "Receiver street"],
    ["receiver_city", "Receiver city"],
    ["receiver_postcode", "Receiver postcode"],
    ["bike_brand", "Bike brand"],
    ["bike_model", "Bike model"],
    ["bike_type", "Bike type"],
  ];

  for (const [field, label] of required) {
    if (!data[field]) {
      errors.push({ field, message: `${label} is required` });
    }
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (data.sender_email && !emailRegex.test(data.sender_email)) {
    errors.push({ field: "sender_email", message: "Invalid email format" });
  }
  if (data.receiver_email && !emailRegex.test(data.receiver_email)) {
    errors.push({ field: "receiver_email", message: "Invalid email format" });
  }

  // Phone validation - must start with +44 or 0
  const phoneRegex = /^(\+44|0)\d{9,11}$/;
  if (data.sender_phone && !phoneRegex.test(data.sender_phone.replace(/\s/g, ""))) {
    errors.push({ field: "sender_phone", message: "Phone must be +44 or 0 format" });
  }
  if (data.receiver_phone && !phoneRegex.test(data.receiver_phone.replace(/\s/g, ""))) {
    errors.push({ field: "receiver_phone", message: "Phone must be +44 or 0 format" });
  }

  // Bike type validation
  if (data.bike_type && !VALID_BIKE_TYPES.some((t) => t.toLowerCase() === data.bike_type.toLowerCase())) {
    errors.push({ field: "bike_type", message: `Unknown bike type. Valid: ${VALID_BIKE_TYPES.join(", ")}` });
  }

  // Bike value validation (optional but must be numeric)
  if (data.bike_value && isNaN(parseFloat(data.bike_value))) {
    errors.push({ field: "bike_value", message: "Bike value must be a number" });
  }

  return errors;
}

function rowToFormData(data: Record<string, string>): CreateOrderFormData {
  // Find the correct casing for bike type
  const matchedType = VALID_BIKE_TYPES.find((t) => t.toLowerCase() === data.bike_type.toLowerCase()) || data.bike_type;

  return {
    sender: {
      name: data.sender_name,
      email: data.sender_email,
      phone: data.sender_phone,
      address: {
        street: data.sender_street,
        city: data.sender_city,
        state: "",
        zipCode: data.sender_postcode,
        country: "United Kingdom",
      },
    },
    receiver: {
      name: data.receiver_name,
      email: data.receiver_email,
      phone: data.receiver_phone,
      address: {
        street: data.receiver_street,
        city: data.receiver_city,
        state: "",
        zipCode: data.receiver_postcode,
        country: "United Kingdom",
      },
    },
    bikeQuantity: 1,
    bikes: [
      {
        brand: data.bike_brand,
        model: data.bike_model,
        type: matchedType,
        value: data.bike_value || undefined,
      },
    ],
    customerOrderNumber: data.customer_order_number || undefined,
    needsPaymentOnCollection: false,
    isBikeSwap: false,
    isEbayOrder: false,
    deliveryInstructions: data.delivery_instructions || undefined,
    needsInspection: false,
    bikeBrand: data.bike_brand,
    bikeModel: data.bike_model,
    bikeType: matchedType,
  };
}

export async function createBulkOrders(
  rows: ParsedOrderRow[],
  onProgress: (result: BulkCreateResult) => void
): Promise<BulkCreateResult[]> {
  const results: BulkCreateResult[] = [];
  const includedRows = rows.filter((r) => r.included && r.errors.length === 0);

  for (const row of includedRows) {
    try {
      const formData = rowToFormData(row.data);
      const order = await createOrder(formData);

      const result: BulkCreateResult = {
        rowIndex: row.rowIndex,
        success: true,
        orderId: order.id,
        trackingNumber: order.trackingNumber,
      };
      results.push(result);
      onProgress(result);

      // Small delay to avoid overwhelming the server
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (error) {
      const result: BulkCreateResult = {
        rowIndex: row.rowIndex,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
      results.push(result);
      onProgress(result);
    }
  }

  return results;
}
