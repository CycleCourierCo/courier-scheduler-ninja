## Goal

Add a button below the "Inspect and Service" enable button on the order detail page that retrospectively creates a QuickBooks invoice for the "Bike Inspection & Service" charge — useful when inspection was enabled after the order's normal invoice was already generated. Uses the same line-item format as the bulk invoice flow.

## Changes

### 1. New edge function: `supabase/functions/create-inspection-service-invoice/index.ts`

Mirrors `create-inspection-invoice` (auth + admin check + QB token refresh + customer lookup + VAT tax code + Net 7 terms) but:

- Accepts `{ orderId }`.
- Loads the order (`tracking_number`, `customer_order_number`, `bike_brand`, `bike_model`, `sender`, `receiver`, `user_id`, `created_at`, `needs_inspection`).
- Rejects if `needs_inspection !== true`.
- Looks up customer in QB via billing email (`accounts_email || email`).
- Looks up the `Bike Inspection & Service` product by exact name (same lookup as bulk invoice).
- Builds a single line item using the **same description format** as `create-quickbooks-invoice` lines 521–528 and 558–572:
  `{tracking_number} (Order #{customer_order_number}) - {brand} {model} - {senderName} → {receiverName}`
  with `Qty: 1`, `UnitPrice: product.price`, `ServiceDate: order.created_at`, and VAT tax code.
- Posts the invoice to QuickBooks with `SalesTermRef` Net 7 and `TxnDate = today`.
- Returns `{ invoiceNumber, invoiceId, invoiceUrl, totalAmount }`.
- No DB writes (the order has no inspection-service invoice column; we just create it in QB). Logs the result.

### 2. Service helper: `src/services/inspectionService.ts`

Add `createInspectionServiceInvoice(orderId: string)` that invokes the new edge function via `supabase.functions.invoke`.

### 3. UI: `src/components/order-detail/ItemDetails.tsx`

When `order.needsInspection === true` and user is admin, render an additional outline `Button` directly below the existing inspection block:

- Label: "Create Inspection Invoice" with `Receipt` icon.
- Loading state `isCreatingInvoice`.
- On click → call `createInspectionServiceInvoice(order.id)`, then `toast.success("Inspection invoice created: {invoiceNumber}")` with action to open `invoiceUrl`. On failure show `toast.error`.

No DB schema changes, no RLS changes, no changes to the existing bulk invoice or inspection-issues invoice flow.
