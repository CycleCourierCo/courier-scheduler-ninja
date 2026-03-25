

## Add Bulk Print Labels to Dashboard (User-Scoped)

### What it does
Adds a "Print Collection Labels" button to the Dashboard. The user picks a collection date, and it generates a multi-page 4x6 label PDF for **only their own orders** scheduled for collection on that date.

### Changes

**1. `src/services/orderService.ts`** -- Scope date query by user
- Add optional `userId` parameter to `getOrdersByScheduledDate`
- When provided, filter both pickup and delivery queries with `.eq("user_id", userId)`

**2. `src/utils/labelUtils.ts`** -- Add bulk generation function
- Add `generateBulkCollectionLabels(orders: Order[]): Promise<void>` that loops through orders, calling the same label layout logic already in `generateSingleOrderLabel` but into a single multi-page PDF

**3. `src/pages/Dashboard.tsx`** -- Add button + dialog
- Add state: `selectedDate`, `isLabelsDialogOpen`, `isGeneratingPDF`
- Add a `Printer` icon button near the header that opens a Dialog with a Calendar date picker and "Generate Labels" button
- Handler calls `getOrdersByScheduledDate(dateStr, user.id)` to fetch only the current user's orders
- Passes pickup orders to `generateBulkCollectionLabels` to produce the PDF
- Shows toast with label count or "no orders found" message

### Flow
```text
User clicks "Print Collection Labels"
  → Dialog opens with date picker
  → User selects date, clicks Generate
  → Fetches orders WHERE scheduled_pickup_date = date AND user_id = current user
  → Generates multi-page 4x6 PDF with all matching labels
  → Downloads PDF automatically
```

