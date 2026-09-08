# Show the ferry partner label on the Foam My Bike cards

## What's wrong

There are two separate label slots on a Northern Ireland order:

- The label the ferry partner (City Air Express) uploads, either through their upload link or from the order page. Both save into the order's partner label slot.
- The label a customer or staff member uploads directly on the Foam My Bike card, which saves into a different slot.

The Foam My Bike card only ever looks at the second slot, so for the two orders below the label is visible on the order page but the card still says "No label uploaded yet":

- CCC754139939756PAUBT3 — partner label present, BFS453770
- CCC754657211881RICBT5 — partner label present, BFS453777

Both are outbound, currently at the "Pending foaming" stage. Because the card sees no label, the button that moves the bike on to the ferry hand-off is also blocked.

## The fix

On each Foam My Bike card:

1. If no foam label has been uploaded, fall back to the ferry partner's label and show a "View / print" button for it, labelled so staff can tell it came from the partner, with its upload date.
2. Show the BFS number on the card when there is one, matching how the inbound section already displays it.
3. Treat a partner label as satisfying the label requirement, so the stage can advance when a tracking link is present. The tracking-link requirement stays as it is.
4. Keep the existing upload / replace controls unchanged — a directly uploaded foam label still takes priority in the display.

## Technical notes

- `src/components/boxmybike/FoamMyBikeSection.tsx` already selects `ni_partner_label_url` and `ni_partner_label_uploaded_at` but never renders them; the card only reads `foam_label_url`.
- The two slots live in different storage buckets: `foam_label_url` in `box-my-bike-labels`, `ni_partner_label_url` in `foam-my-bike-labels` (as used by `NorthernIrelandEditor.tsx` and `InboundNiSection.tsx`). The viewer must sign against the correct bucket per source, still passing the URL through `toPublicFileUrl`.
- Update `showLabelSection` and `blockedAdvance` to consider either label source.
- Frontend/presentation only; no schema or edge function changes, no backfill needed.
