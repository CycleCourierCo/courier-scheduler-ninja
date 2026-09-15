# Ferry status on delivery jobs: show "Not collected from ferry partner"

## What

On Job Scheduling, an inbound Northern Ireland bike that has crossed the ferry but is still sitting with the ferry partner shows a green "Crossed ferry - ready" badge on the **delivery** job to the customer. That reads as if the bike is with us and ready to go out, when in fact it still needs collecting from the partner.

That "ready" wording belongs only on the **collection** job from the ferry partner.

## Change

For inbound NI bikes that have crossed the ferry but not yet been collected from the partner:

- **Collection job (from the ferry partner)** — unchanged: green "Crossed ferry - ready to collect (date)".
- **Delivery job (to the customer)** — now shows an amber warning badge "Not collected from ferry partner" instead of the green ready badge.

Once the bike has actually been collected from the partner, the delivery job goes green as it does today ("Crossed ferry - with us"). Bikes still in NI keep the red "In NI - not crossed" badge on both legs.

Nothing else changes: no database changes, no change to which jobs appear or can be routed, no emails.

## Technical details

- `src/components/scheduling/RouteBuilder.tsx`, `getNiInboundBadge` (~line 195): in the `status === 'crossed_ferry'` branch, split by leg — `pickup` keeps the green `Crossed ferry - ready to collect${crossedLabel}`; `delivery` returns text `Not collected from ferry partner${crossedLabel}` with an amber colour class (`bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300`), same `Ship` icon.
- Both grouped and ungrouped job cards (lines ~688 and ~810) already pass the leg, so no call-site changes.

## Verify

- Typecheck passes.
- An inbound NI order at `crossed_ferry`: collection job shows green "ready to collect", delivery job shows amber "Not collected from ferry partner".
- The same order at `collected_from_partner` shows green on both legs.
