# Allow label upload earlier on NI (Foam My Bike) orders

Today the shipping label + tracking link box on Foam My Bike cards only appears once a bike reaches "Foamed, ready for delivery". Labels often arrive before that, so staff/customers should be able to attach them sooner.

## Change

- Show the label & tracking link section from the first stage onward: **Pending collection**, **Pending foaming**, and **Foamed, ready for delivery** (plus any stage where a label or tracking link already exists, as now).
- Allow uploading, replacing, and viewing the label in those three stages (same permissions as today: the order owner or staff).
- Tracking link editing follows the same rule as label editing.
- Keep the existing guard: a bike still cannot be advanced past "Foamed, ready for delivery" to the ferry without both a label and a tracking link. The required-field asterisk stays only at the foamed-ready stage so earlier uploads are optional.
- No change to later stages (delivered to ferry / delivered in NI stay read-only).

## Technical notes

Single file: `src/components/boxmybike/FoamMyBikeSection.tsx`. Replace the `canEditLabel` / `showLabelSection` conditions (currently hardcoded to `stage === "foamed_ready"`) with a set of editable stages `["pending_collection", "pending_foaming", "foamed_ready"]`. `blockedAdvance` logic is left untouched.
