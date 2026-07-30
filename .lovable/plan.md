## Goal
Show Northern Ireland pricing on the Delivery Pricing page, alongside the existing Scotland card.

## What exists today
- `src/pages/PricingPage.tsx` renders: standard bike-type prices (from `pricingData`, all shown as "£X + VAT"), a "Scotland — prices coming soon" card, and an Additional Services card.
- `src/utils/northernIreland.ts` defines `NI_SURCHARGE_PER_BIKE = 120`. That figure is the **VAT-inclusive** surcharge, i.e. **£100 + VAT**.

## Change
Add a **Northern Ireland** card between the Standard Delivery Prices card and the Scotland card:
- Title with map-pin icon: "Northern Ireland".
- Row: "Surcharge per bike (on top of standard price)" → "£100 + VAT" (£120 inc. VAT), matching the ex-VAT convention used everywhere else on the page.
- Short explanatory line: NI deliveries are collected in mainland England & Wales, handed over at the ferry port and completed by our onward ferry partner; delivery date confirmed after ferry hand-off.
- A worked example: "Non-Electric Bike to NI: £60 + £100 = £160 + VAT".

## Technical notes
- Presentation-only change to `src/pages/PricingPage.tsx`.
- Derive the displayed net figure from `NI_SURCHARGE_PER_BIKE` (gross) divided by 1.2 so it stays in sync with the pricing constant; keep the gross value visible as "(£120 inc. VAT)".
- Use existing shadcn `Card`/`Badge` and semantic tokens only — no hardcoded colour utilities.
- No backend or pricing-logic changes; the £120 gross surcharge used in invoicing stays as-is.
