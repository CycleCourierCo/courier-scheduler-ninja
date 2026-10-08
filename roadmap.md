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
