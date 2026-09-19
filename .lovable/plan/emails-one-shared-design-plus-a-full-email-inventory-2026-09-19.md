# Emails: one shared design, plus a full email inventory

Two deliverables:

1. **`docs/EMAIL_INVENTORY.md`** — documentation only. Every email the system sends, with who gets it, what triggers it, what content it carries, and what a wireframe needs to cover. This is what you hand to design.
2. **A single shared email design**, matching the portal (Overpass type, motorway-blue accent, flat surfaces, 6px radius, tarmac/daylight neutrals), applied to every email — customer, partner, internal and announcement.

No wording, recipient, trigger, timing or business rule changes. Only appearance changes, apart from one deliberate exception noted below.

## Current state

Emails are hand-written HTML strings spread across roughly 20 places. Each one repeats inline styles, so they drift: Arial everywhere, an old indigo `#4a65d5` button colour, 5px radii, grey `#f7f7f7` panels, no consistent header, footer or company details, and several with no branding at all. Internal reports, timeslips, loading lists, invoice batches and announcements each have their own look.

## Part 1 — the inventory document

Grouped by audience, each entry listing: name, trigger, recipients, subject, the fields shown, links/buttons, attachments, and whether it's transactional or internal.

- **Customer — order journey:** order created (sender), delivery notification (receiver), collection availability request, delivery availability request, sender dates confirmed, receiver dates confirmed, planning your collection, collection booked, delivery booked, collected/safely with us, on its way to buyer, delivered (sender and receiver versions with review links), missed collection, missed delivery, generic update, order cancelled.
- **Customer — Northern Ireland / ferry:** reached the ferry port, crossed the ferry, partner collection date confirmed and updated.
- **Customer — Box / Foam My Bike:** bike being boxed, boxed bike collected, buyer-facing variants.
- **Customer — workshop:** on the way to our service centre, repairs need approval, optional repairs offer, repairs confirmed, repairs declined, returning to seller, walk-in inspection approval link, inspection report delivery.
- **Customer — account:** business registration received, account approved, application status/decline.
- **Billing:** QuickBooks invoice delivery, inspection/service invoices, receiver repair invoice, guaranteed-delivery and build/box invoices, weekly invoice batch report.
- **Partner:** City Air ferry booking and updates, NI partner label requests.
- **Internal/staff:** daily ops report, customer-updates digest, parts to order, weekly driver/van/workshop reports, route report, timeslips, loading lists, new registration needs approval, task assigned, repairs-declined alerts, missing-invoice alerts.
- **Announcements:** ad-hoc and scheduled broadcasts.

For each I also note the shape a wireframe needs: header, one headline, a short body, an optional detail panel (tracking number, bike, dates, addresses), zero or one primary action, optional secondary links, footer.

## Part 2 — the shared design

- A single email layout helper used by every sender: branded header with the company name, white content card on a light background, headline, body, optional detail rows, one primary button style, secondary link style, status pill, and a footer with company details and a tracking link where relevant.
- Portal colours and type reused as email-safe literal values (inline CSS, table-based, tested-safe for Outlook and Gmail). Emails cannot read the portal's CSS variables, so values are mirrored in one place and kept in sync there.
- Every existing sender is switched to build its content through that helper instead of its own markup. Subjects, recipients and text stay as they are.
- Internal reports keep their denser tables but inherit the same header, footer, type and colours.
- Light-only, 600px wide, images optional, plain-text alternatives preserved where they already exist.

### Deliberate exception

A few emails currently carry no branding at all (some internal and partner ones). Those gain the standard header and footer — that's a visible change, and the intended one.

## Technical notes

- New shared module for edge functions (`supabase/functions/_shared/emailLayout.ts`) and a mirrored front-end helper for the senders in `src/services`, both driven by one token table so the two cannot diverge.
- Touched senders include `send-email`, `send-order-updates`, `send-inspection-approval`, `send-repair-offer`, `finalise-public-repair-offer`, `notify-repairs-declined`, `reject-repairs-return-to-seller`, `send-ferry-partner-notification`, `ni-partner-label-upload`, `create-*-invoice`, `weekly-invoice-batch`, `generate-timeslips`, `send-loading-list-whatsapp` (email path), `send-internal-reports`, `send-route-report`, `send-task-assignment-email`, `process-scheduled-announcements`, `create-business-user`, `orders`, plus `src/services/emailService.ts`, `src/lib/sendOrderUpdateEmail.ts` and `src/utils/announcementEmailTemplate.ts`.
- Affected edge functions are redeployed; typecheck and build are run.
- Existing send-deduplication, claim logic, Resend queueing, reply-to and sender domain are untouched.

## Order of work

1. Write `docs/EMAIL_INVENTORY.md` and share it for the wireframes.
2. Build the shared layout and convert the customer order-journey emails first.
3. Convert workshop, NI/partner, account and billing emails.
4. Convert internal reports and announcements.
