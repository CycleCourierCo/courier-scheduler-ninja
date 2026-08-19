# Fix Guaranteed Delivery: delete error + invoice failure

Both issues are confirmed from the code and the edge function logs.

## 1. Removing the guarantee fails

The remove action writes `guaranteed_delivery_amount: null`, but that column is `NOT NULL DEFAULT 0` — hence "null value in column ... violates not-null constraint".

Fix: reset the amount to `0` instead of `null` when clearing (keep the other fields nulled). Also clear the public invoice URL field, which the current reset misses.

## 2. "Guarantee saved, but invoice failed"

Edge function log for this order:

```text
QuickBooks customer creation failed: Invalid String... Element contains invalid characters. \t Aron Williams (element: DisplayName)
```

The receiver's stored name contains a tab/control character, and QuickBooks rejects it on customer creation.

Fix: sanitise the party name and email before using them in QuickBooks lookups and customer creation — strip control characters (tab/newline), collapse repeated spaces, and trim. Use the cleaned name for both the `DisplayName` query and the create payload, and for the invoice description. Apply the same sanitising to address fields and phone.

Additionally, surface the real reason better: when customer creation fails, include the QuickBooks message in the returned error so the toast is actionable rather than generic.

## Technical notes

- `src/services/orderService.ts` — `clearGuaranteedDelivery`: `guaranteed_delivery_amount: 0`, add `guaranteed_delivery_invoice_public_url: null`.
- `supabase/functions/create-guaranteed-delivery-invoice/index.ts` — add a `sanitiseQbString` helper (remove `[\u0000-\u001F\u007F]`, collapse whitespace, trim) applied to name/email/address/phone; propagate QuickBooks fault message in thrown error.
- No database migration needed.
