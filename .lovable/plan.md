# Inbound NI tracking + editable stage date/time

Two fixes for the Northern Ireland inbound flow.

## 1. Inbound NI steps don't show on tracking

The stage buttons do save the stage and its timestamp, and the tracking timeline already knows how to draw the inbound steps — but the order data handed to the timeline never carries the new NI fields, so nothing appears.

Two places drop them:

- The order-to-screen mapper (`src/services/orderServiceUtils.ts`) maps the foam fields but not `foam_crossed_to_ni_at`, `ni_inbound_status`, `ni_inbound_collected_at`, `ni_inbound_ferry_crossed_at`, `ni_inbound_received_at`, `ni_bfs_number`.
- The public tracking payload function (`_build_public_order_payload`) returns the older foam fields only, so the customer tracking page never receives the new ones either.

Fix both, so the same milestones show for staff on the order page and for customers on the tracking link:

```text
Collected in Northern Ireland
Crossed ferry to mainland
Received from our ferry partner
```

Plus the outbound "Crossed to Northern Ireland" step, which has the same missing-field problem.

## 2. Set the date and time for each step

Right now advancing a step stamps "now". Change it so staff can say when the step actually happened:

- Clicking a step's forward button opens a small confirm box with a date and time field, pre-filled with the current date and time — accept it, or set the real time (e.g. the ferry crossed last night).
- Already-stamped steps show their date and time with a small edit control, so a wrong time can be corrected without moving the order backwards.
- Applies to the Inbound NI stages and, for consistency, the outbound Foam My Bike stages.
- Future dates are rejected; the edited time is what the customer tracking timeline shows.

## Technical notes

- `src/services/orderServiceUtils.ts`: add camelCase mappings `foamCrossedToNiAt`, `niInboundStatus`, `niInboundCollectedAt`, `niInboundFerryCrossedAt`, `niInboundReceivedAt`, `niBfsNumber` (with `parseDate` for the timestamps), matching how the existing foam fields are handled.
- Migration: recreate `public._build_public_order_payload` adding `foam_crossed_to_ni_at`, `ni_direction` (already present), `ni_inbound_status`, `ni_inbound_collected_at`, `ni_inbound_ferry_crossed_at`, `ni_inbound_received_at`, and `ni_bfs_number` to the returned JSON. No new tables, no schema change beyond the function body.
- New shared component `src/components/boxmybike/StageDateTimeDialog.tsx` (datetime-local input, defaults to now, blocks future values) used by both `InboundNiSection.tsx` and `FoamMyBikeSection.tsx`; the stage mutations take an optional `occurredAt` and write it to the stage timestamp column instead of `new Date()`.
- `InboundNiSection.tsx` / `FoamMyBikeSection.tsx`: render each completed stage's timestamp on the card with an edit button that writes only the timestamp column.
- Verify with `bun run build` and a check of one inbound NI order's tracking page.
