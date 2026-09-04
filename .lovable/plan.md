# Show the ferry badge on the City Air Express collection stop

Right now the ferry status badge only appears on delivery stops. The City Air Express hand-off job is a **collection** stop, so it shows no badge at all — which is exactly the stop where a driver needs to know whether the bike has actually crossed.

## Change

Show the ferry badge on the ferry hand-off collection stop of inbound Northern Ireland orders, with wording that suits collecting rather than delivering:

- `In NI - not crossed` (red) — bike is still in Northern Ireland or not yet collected there; nothing to collect at City Air Express yet.
- `Crossed ferry - ready to collect` (green) — crossed, safe to plan this collection. Shows the crossing date where we have it.
- `Collected from partner` (green) — already picked up from City Air Express.

Everything else stays the same: normal collections show no ferry badge, and delivery stops keep the badge they already have.

## Technical notes

- File: `src/components/scheduling/RouteBuilder.tsx`.
- `getNiInboundBadge(orderData)` gains a leg argument so it can return collection-side wording; keep the existing delivery wording untouched.
- Render it for pickup stops when `isFerryLeg(orderData, 'pickup')` (already imported from `@/utils/niDelivery`) at both call sites: the grouped-stop badge row (~line 678) and the single-stop badge row (~line 800).
- No data, query or edge function changes — `ni_direction`, `ni_inbound_status` and `ni_inbound_ferry_crossed_at` are already fetched.
- Verify with `bun run build`.
