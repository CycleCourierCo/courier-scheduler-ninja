# Roadmap

- [x] Replace label branding and layout with supplied thermal artwork
- [x] Verify sample single, multi-bike, long-address, compact-header and driver-separated PDFs; one-bit 203 dpi confirmed
- [x] Restore inspection, Box My Bike and Northern Ireland indicators on thermal labels
- [ ] Verify physical thermal print quality — requires user to print a sample at 100% on their printer

- [x] Include expired-date jobs in Generate Routes by default (toggle starts on)
- [x] Fix "Include expired jobs (n)" count — now counts only actually-expired jobs
- [x] Expiring Dates page: expired jobs now land in the Expired column
- [x] Expiring Dates page: Northern Ireland jobs excluded (either end in NI)

- [x] Expired-jobs button counts only genuinely expired open legs (21, not 71); optimiser decides expiry from actual dates; stale notes cleared; runs report "X of Y expired jobs planned"
- [x] Planner ticks reflect saved van days off; optimiser uses exactly the ticked vans
- [x] Use route no longer locks; locked-day notice with Unlock; locked vans not reused; weak loss-making vans dropped unless carrying must-go work; Sunday 4 Oct accidental locks released
- [x] Timeslot stop addresses: selectable/copyable + copy icon next to each address
- [x] Route Profitability: bike-type pricing on by default; special flat rates override; Matthew Coulthard £65 flat, £150 for big-bike jobs (use_large_bike_rate)
- [x] Route Profitability costs now use real fuel (net, from fuel invoices) + van maintenance, spread by each van's miles per month; flat 45p rate kept as an "estimate" toggle (off by default)
- [x] Revenue check table relabelled: "Invoiced (jobs on this page)" / "All transport invoiced in QuickBooks" + note explaining the gap
- [x] Analytics: predicted end-of-period dashed lines on Inspections Booked vs Completed, Orders Created, and Orders Completed charts
- [x] Workshop chasing: overdue limits, parts ordered/arrived, overdue filter, chase button, daily digest + mechanic lists (Mon–Fri)
- [x] Dashboard task list: scrolls, sized to four whole tasks (phone and desktop)
- [x] Bay assign/move/clear on Loading page update in place — no full page reload or scroll jump (2026-10-11)
- [x] Mechanic Clock: each day's timeslip lists work done (inspections, repairs, Box/Foam My Bike) with standard minutes per item, totals vs clocked hours, and a required clock-out explanation when the gap exceeds 30 min; admins see the explanation and work summary on the timeslips tab
- [x] Ireland page added to the admin menu (Operations, after Trunk Runs) — it was only reachable by mechanics, loaders and dealers before (2026-10-11)
- [x] Timeslips page: renamed from "Driver Timeslips" to "Timeslips" (menu, route label, page title); mechanic timeslips merged into the Draft/Approved/All lists (open+closed count as draft) with a Mechanic badge, photos, GPS, work summary and approve/reject/edit/delete — the separate Mechanic tab is removed; person filter now lists drivers and mechanics
- [x] Edit bike: allow editing eBay collection code and related eBay fields

## Production readiness (plan 2026-10-23)
- [x] Automated test setup + bike price tests (7 passing)
- [x] Fuel cards / fuel card settings limited to staff
- [ ] Phase 1: review ~135 background actions, signed incoming messages, profiles.role removal, Geoapify proxy + key rotation, upload checks, rescan
- [ ] Phase 2: tests for inspection invoicing, chaser rules, repairs-declined, Clean Air Zone charges
- [ ] Phase 3: real-use checklist (needs staff to try each change signed in)
- [ ] Phase 4: scheduled-job failure alerts, privacy policy fixes; SMS waits on Divergent approval
- [x] TRACKING_SPEC.md for Shopify tracking page + extend public-track

## Retheme (sage/cream)
- [x] Batch 1 core: tokens light+dark, fonts, badges, buttons, amber, logo/icons, map pins, emails, label mark
- [ ] Batch 2 scheduling: RouteBuilder, GuaranteedDatePanel, CSV dialogs, RouteComparison, TrunkRuns
- [ ] Batch 3 customer-facing: TrackingPage, OrderDetail, TrackingTimeline, tokenised pages (+ Shopify CSS version)
- [ ] Batch 4 workshop/warehouse
- [ ] Batch 5 admin/money
- [ ] Batch 6 long tail
- [ ] Held-bike / failed-attempt flag in order list, order detail, Route Builder cards, Loading & Storage
- [ ] Waiting on Abdullah: Shopify theme owner, final sign-off, go-live date
