## Goal

Remove the ferry company's name — and any "partner"/"Irish Sea carrier" phrasing — from everything shown in the UI and emails. Customer copy simply says the bike has reached the ferry port. Real contact details stay in the code so Shipday jobs and onward-booking emails keep working.

## Wording rules

- Customer emails/tracking: "Your bicycle has reached the ferry port and is awaiting transport to Northern Ireland." No company name, no "partner", no "carrier".
- Staff screens: show only the ferry hand-off address (Manchester) with a plain label like "Ferry hand-off", never a company name.

## Files to change

1. `**src/constants/depot.ts**` and `**supabase/functions/_shared/northernIreland.ts**`
  - Keep the real name/email/phone/address for routing and delivery, but add a neutral `displayName: "Ferry hand-off"` and strip the company name from code comments.
2. `**supabase/functions/send-email/index.ts**` (ferry-arrival email)
  - Reword: drop "handed over to our Irish Sea carrier" → "has reached the ferry port"; status line reads "Delivered to ferry port — awaiting transport to Northern Ireland".
3. `**src/services/emailService.ts**`
  - NI block in the receiver booking email: "This bicycle will be delivered to the ferry port for onward transport to Northern Ireland" (no company name).
  - Receiver availability + dates-confirmed emails: recipient display name becomes the neutral label instead of the company name; recipient addresses unchanged.
4. `**src/components/boxmybike/FoamMyBikeSection.tsx**`
  - "Ferry hand-off: {address}" only.
5. `**src/components/order-detail/NorthernIrelandEditor.tsx**`
  - Both copy blocks reworded to reference the Manchester ferry hand-off address, no company name; £120 surcharge wording kept.
6. `**src/utils/niDelivery.ts**` (+ the Route Builder / Job Map / Scheduling cards that render the leg contact)
  - NI delivery contact's displayed name becomes the neutral label; address, coordinates, phone and email unchanged.

## Left untouched

- `create-shipday-order` keeps the real name/phone/email on the Shipday job so drivers and the destination are correct.
- Email recipient addresses and the £120 NI surcharge logic.

After the edits I'll typecheck and redeploy the touched edge functions.