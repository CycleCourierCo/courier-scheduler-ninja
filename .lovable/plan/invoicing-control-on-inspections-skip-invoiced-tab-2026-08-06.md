# Invoicing control on inspections: skip + Invoiced tab

## What you get

1. **"No invoice needed" action** on any inspection card that is eligible for invoicing. Admin clicks it, optionally types a short reason (e.g. "goodwill", "covered under warranty", "internal bike"), and the job is marked as deliberately not invoiced. The Create Invoice button is then replaced by a "Not invoiced" badge with the reason and who marked it.
2. **Undo** — an admin can clear the skip so the job becomes invoiceable again.
3. **New "Invoiced" tab** listing every inspection that has been invoiced (shows invoice number, amount and the QuickBooks link) plus the ones marked as not-invoiced, so nothing sits in limbo. The tab badge counts both, and each card carries either an "Invoiced" or "Not invoiced" badge.
4. **Inspected & Serviced tab is cleaned up** — once a bike is invoiced or marked not-invoiced it moves out of that tab and into Invoiced, so the workshop list only shows what still needs a billing decision.

The tab is admin/manager-only, matching how the Pricing tab is already gated.

## Technical detail

**Database migration** on `public.bicycle_inspections`:
- `invoice_skipped_at timestamptz`
- `invoice_skipped_by_id uuid`
- `invoice_skipped_by_name text`
- `invoice_skip_reason text`

No new table, so existing grants and RLS policies carry over unchanged.

**`src/services/inspectionService.ts`**
- `markInvoiceNotNeeded(inspectionId, reason, user)` — sets the four skip fields.
- `clearInvoiceSkip(inspectionId)` — nulls them.
- Fetches already select `*` from `bicycle_inspections`, so the new fields flow through to the page with no query change.

**`src/pages/BicycleInspections.tsx`**
- Derived list: `invoiced = filteredInspections.filter(i => i.inspection?.invoice_number || i.inspection?.invoice_skipped_at)`.
- `inspectedAndServiced` gains `&& !invoice_number && !invoice_skipped_at`.
- New `TabsTrigger`/`TabsContent` for `value="invoiced"`, gated on `canManageInspections`.
- `canCreateInvoice` gains `&& !inspection?.invoice_skipped_at`.
- Card footer: alongside Create Invoice, a "No invoice needed" button opening a small reason dialog; when skipped, render the badge + reason + "Make invoiceable again" for admins.
