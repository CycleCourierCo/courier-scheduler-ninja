# Implement ccc-email-design.md v1.0

Apply the uploaded email design system to the shared email layer and every sender. No wording, recipients, triggers, or business logic change — this is presentation only.

## Phase 1 — Core shell (changes every email at once)

All in `supabase/functions/_shared/emailLayout.ts`, mirrored in `src/utils/emailBrand.ts`:

1. **Token alignment** — `primary #0B61B1 → #0B5FB0`, `muted #5C6570 → #5B6470`, `border #D8DEE4 → #D9DFE5`; add `routeTint #E3EEF8` and the nine status tokens (`statusNeutral #6B7580`, `statusWaiting #F5B800` (ink text), `statusBooked #0B5FB0`, `statusTransit #6B4FBF`, `statusDone #1E7A46`, `statusFailed #C22F2E`, `statusNi #3F51B5`, `statusTrunk #0E7C8C`, `statusInspection #2B8CD8`).
2. **Dark-mode guards** — `color-scheme: light` on body (meta tags already present); ensure every coloured block sets explicit background + text colour.
3. **Preheader** — proper hidden preheader block with `&#847;&zwnj;&nbsp;` padding chain, driven by a new `preheader` option (falls back to subject).
4. **New components** in `emailUI`:
   - `stripMap(stages, currentIndex)` — table-cell journey row per §3.2 with the six lifecycle branches (Standard, Box My Bike, NI outbound, NI inbound, Scotland trunk, Workshop).
   - `statusPill(token, label)` — §3.4, always word + colour.
   - `chevron` shell flag — 6px `#F5B800` bar under the header for exceptions.
   - `button` upgraded to bulletproof table + Outlook VML fallback; add `secondaryButton` (white, blue border) for the review links.
   - `table(headers, rows)` and `totalsRow()` — §3.7 report tables, mono right-aligned figures.
   - `detailPanel(rows)` — §3.3 label/value panel, mono for tracking/postcode/timeslot, max six rows.
5. **Plain-text part** — generate a text alternative in the `send-email` wrapper (strip tags, keep links) and pass `text` alongside `html` to Resend for every send.
6. **Type scale** — headline 26/1.25/700, body 16/1.6, small 13px footer; shell body padding 32px.

## Phase 2 — Template-by-template (§5 of the spec)

Walk the senders and set shape, eyebrow, pill, strip map and button per the mapping tables:

- **Order journey** (`send-order-updates`): all collection/delivery/availability/booked/collected/in-transit/delivered emails get eyebrows (COLLECTION/DELIVERY), status pills, the correct strip-map branch, per-template preheaders. Missed collection/delivery and cancellation get the chevron bar with action-first button.
- **NI/ferry**: NI emails get NORTHERN IRELAND eyebrow, `statusNi` pills, NI branch strip map; the "date updated" email shows previous date struck through + new date.
- **Box/Foam My Bike**: BOXING eyebrow, Box branch strip map; courier tracking link demoted to secondary text link.
- **Workshop**: WORKSHOP eyebrow; repair-approval and offer emails get chevron + issue table with parts/labour totals row; inspection report gets the attachment-note block.
- **Account**: ACCOUNT eyebrow + pills (Under review / Approved / etc.).
- **Billing**: INVOICE eyebrow, document shape with attached-vs-linked stated; weekly batch report stays 760px with failures section only when non-empty.
- **Partner (City Air)**: FERRY PARTNER eyebrow, footer trimmed to company identity + contact (no review links), UPDATED pill with both dates on the change email.
- **Internal**: REPORT eyebrow at 760px, date-range line in mono, totals rows, empty sections omitted. Task-assigned stays shape 1 (TASK). Timeslips get attachment note.
- **Announcements**: shape 5 — subject as headline, typed body; unsubscribe link added to non-transactional footer.

## Files

- `supabase/functions/_shared/emailLayout.ts` (tokens, shell, components, plain-text)
- `src/utils/emailBrand.ts` (token mirror)
- ~15 sending functions, primarily: `send-order-updates`, `send-ferry-partner-notification`, `send-inspection-approval`, `send-repair-offer`, `notify-repairs-declined`, `reject-repairs-return-to-seller`, `send-task-assignment-email`, `send-internal-reports`, `weekly-invoice-batch`, `generate-timeslips`, `send-email`, `process-scheduled-announcements`, `create-business-user`, invoice functions, `shipday-webhook` (status emails)
- Deploy updated functions

## Out of scope

- Changing any email wording, subject lines, recipients, or when emails fire
- The §8 client test matrix (Gmail/Outlook/Apple Mail rendering) — needs real inbox testing on your side; I'll note it in the handoff

## Verification

- Typecheck + build
- Render spot-checks: generate sample HTML for one email of each of the five shapes and screenshot them (desktop + mobile width, light + forced-dark) via Playwright
- Confirm no unwrapped senders remain
