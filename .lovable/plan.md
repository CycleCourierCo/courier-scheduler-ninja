# Fix NI surcharge VAT handling on invoices

Keep the current behaviour (surcharge rolled into the bike's line item, no separate line) — just add the **net** £100 instead of the VAT-inclusive £120, since QuickBooks lines are net and VAT is applied on top via the tax code.

## Changes

1. `supabase/functions/_shared/northernIreland.ts`
   - Add `export const NI_SURCHARGE_NET = 100;` alongside the existing gross `NI_SURCHARGE_PER_BIKE = 120` (gross stays for customer-facing emails/UI).

2. `supabase/functions/create-quickbooks-invoice/index.ts`
   - Import `NI_SURCHARGE_NET` and use it for the unit price: `product.price + NI_SURCHARGE_NET`.
   - Update the line description to `- Northern Ireland (incl. £100 NI surcharge)` so it reads consistently with the net line amount.

## Result

- A £60 non-electric bike to NI invoices at £160 net → £192 inc. VAT, i.e. £120 inc. VAT of surcharge, matching the pricing page.
- Applies automatically to all three paths (Create All, individual customer, weekly cron), since they all call `create-quickbooks-invoice`.
- No frontend or database changes.
