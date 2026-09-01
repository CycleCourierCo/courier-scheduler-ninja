# Ferry partner emails: correct details and clear direction

## What's wrong today

Two paths send Northern Ireland emails to the ferry partner, and they disagree:

- The shared edge-function template (`supabase/functions/_shared/ferryPartnerEmail.ts`) already picks the sender for inbound (NI → mainland) jobs. It is used by the orders API/Shopify path and the manual resend button.
- The portal path (`src/services/emailService.ts`) does not. It CCs the ferry partner on the receiver notification and always prints the **receiver** block with the wording "This bicycle will be delivered to the ferry port for onward transport to Northern Ireland" — so an NI → England job sends the ferry partner the wrong (mainland) address and the wrong direction.
- The availability and confirmed-dates emails (also routed to the ferry partner for NI orders) carry no direction wording at all.

## What we'll change

1. **Portal receiver email** — make the NI block direction-aware:
   - England → NI: keep the NI receiver's name, address, phone, email (onward delivery booking).
   - NI → England: show the **NI sender's** collection details instead, with wording that the ferry partner collects in Northern Ireland and hands the bike to us in Manchester.

2. **Direction label on every NI email** — add a single, consistent line near the top of each NI email:
   - `Direction: NI to England` (inbound)
   - `Direction: England to NI` (outbound)

   Applied to the ferry partner booking email, the portal receiver notification when NI, and the availability/confirmed-dates emails that go to the ferry contact.

3. **Subjects** — prefix the ferry partner booking email subject with the direction, e.g. `NI to England — collection booking CCC1234...` / `England to NI — delivery booking CCC1234...`, so the ferry partner can tell direction from the inbox list.

## Technical notes

- Direction resolved with the existing helpers: `getNiDirection` (`src/utils/niDelivery.ts`) on the frontend, `niDirectionOf` / `resolveNiDirection` (`supabase/functions/_shared/northernIreland.ts`) in edge functions — no new detection logic and no schema change.
- Files touched: `supabase/functions/_shared/ferryPartnerEmail.ts` (direction line + subject), `src/services/emailService.ts` (NI block chooses sender vs receiver, plus direction line in the receiver, availability and dates emails).
- Wording uses "England" for the mainland side as requested, matching how the user describes it.
- Edge functions that import the shared template are redeployed automatically; existing sent emails are unaffected.

## Out of scope

- No change to the ferry surcharge, foam pipeline, Shipday stop substitution, or WhatsApp routing.
