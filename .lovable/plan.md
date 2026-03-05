

## Plan: Add Invoice Creation for Inspected & Serviced Bikes

### Overview
Add a "Create Invoice" button on the Inspected & Serviced tab that creates a QuickBooks invoice for approved repair costs, then displays the invoice number on the card for both admin and customer views.

### Changes

**1. Database Migration**
Add invoice tracking columns to `bicycle_inspections`:
- `invoice_number` (text, nullable)
- `invoice_id` (text, nullable) — QuickBooks invoice ID
- `invoice_url` (text, nullable) — link to QuickBooks invoice

**2. New Edge Function: `create-inspection-invoice`**
- Accepts `inspectionId` in request body
- Authenticates user, verifies admin role
- Fetches the inspection + approved issues (status = 'approved' or 'repaired') with their `estimated_cost`
- Fetches the order's `user_id` to get the customer's email from `profiles`
- Gets valid QuickBooks token, finds the customer in QBO by email
- Looks up a QuickBooks product called "Bike Repair" (or similar — needs to exist in QBO)
- Creates line items from each approved issue (description + estimated_cost)
- Creates the invoice in QuickBooks
- Updates `bicycle_inspections` with the `invoice_number`, `invoice_id`, `invoice_url`
- Returns the invoice details

**3. Frontend: `src/pages/BicycleInspections.tsx`**
- Add a mutation calling `create-inspection-invoice`
- On the inspection card, when `inspection.status === 'repaired'` and the inspection has approved issues with costs:
  - If no `invoice_number` yet: show "Create Invoice" button (admin only)
  - If `invoice_number` exists: show the invoice number as a badge/link (visible to both admin and customer)
- The invoice number display also appears for inspected bikes that have an invoice

**4. Config: `supabase/config.toml`**
- Add `[functions.create-inspection-invoice]` with `verify_jwt = false`

### Technical Details
- The edge function reuses the same QuickBooks token management pattern (refresh, etc.) from the existing `create-quickbooks-invoice`
- Approved issues sum: only issues with `status = 'approved'` or `status = 'repaired'` and non-null `estimated_cost` are included
- The QuickBooks product for repair line items will be looked up by name "Bike Repair" — this product must exist in QuickBooks
- VAT tax code lookup follows the same pattern as the existing invoice function
- No changes to RLS needed — admin already has full access to `bicycle_inspections` updates

