

## Bulk CSV Order Upload

### Overview
Add a new page where authenticated users can upload a CSV file containing multiple orders, preview them in a table, validate them, and submit them all at once. Accessible from the main navigation.

### How It Works
1. User downloads a CSV template with the required columns
2. User fills in order data (sender/receiver details, bike info, etc.)
3. User uploads the CSV on the bulk upload page
4. System parses and validates each row, showing errors inline
5. User reviews the parsed orders in a table, fixes any issues
6. User clicks "Submit All" to create orders one-by-one via the existing `createOrder` service
7. Progress bar shows creation status; summary of successes/failures at the end

### CSV Template Columns
```text
sender_name, sender_email, sender_phone, sender_street, sender_city, sender_postcode,
receiver_name, receiver_email, receiver_phone, receiver_street, receiver_city, receiver_postcode,
bike_brand, bike_model, bike_type, bike_value, customer_order_number, delivery_instructions
```

### Changes

**1. New page: `src/pages/BulkOrderUpload.tsx`**
- CSV file input with drag-and-drop
- "Download Template" button that generates a blank CSV with headers
- Parse CSV using `FileReader` + simple CSV parser
- Validation per row: required fields (names, emails, phones in +44 format, postcodes), bike_type against known types
- Preview table showing all parsed rows with inline error highlighting (red cells for invalid fields)
- Row-level checkboxes to include/exclude rows
- "Submit Orders" button that iterates through valid rows, calling `createOrder` for each
- Progress indicator and results summary (created count, failed count with error details)

**2. New service: `src/services/bulkOrderService.ts`**
- `parseOrderCSV(content: string)`: Parse CSV into typed row objects
- `validateOrderRow(row)`: Validate each row, return errors array
- `createBulkOrders(rows, userId)`: Loop through rows, call existing `createOrder`, collect results
- Template CSV content string for download

**3. Route: `src/App.tsx`**
- Add `/bulk-upload` route under `ProtectedRoute`

**4. Navigation: `src/components/Layout.tsx`**
- Add "Bulk Upload" link in sidebar/nav for authenticated users

### Technical Details
- Reuses existing `createOrder` from `orderService.ts` (no new API endpoint needed)
- Phone validation matches existing `+44` format rules
- Bike type validated against `BIKE_TYPE_BY_ID` mapping from `bikePricing.ts`
- Orders created sequentially with a small delay to avoid rate limiting
- Each row generates its own tracking number via existing `generateTrackingNumber`
- Emails (sender confirmation, receiver notification) fire per order as they do today

