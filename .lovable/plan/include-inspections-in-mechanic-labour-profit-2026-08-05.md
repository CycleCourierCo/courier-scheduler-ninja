# Include inspections in mechanic labour profit

Right now the Mechanic Profitability panel treats inspection income (£60 per released inspection) as separate from labour, so "Labour profit" only compares repair labour charges against the mechanic's full wage cost — which makes mechanics who mostly inspect look unprofitable.

## Change

- Labour revenue for each mechanic becomes: inspection revenue (£60 per inspection) + labour portion of resolved repair issues.
- Labour profit stays labour revenue − wage cost, but now with inspections included, so it reflects all the labour a mechanic actually billed.
- Totals row and the three summary tiles pick this up automatically.
- Update the helper text under the table and the card description to state that labour revenue includes inspections plus the labour element of repairs.

## Technical notes

- `src/services/mechanicProfitabilityService.ts`: add `INSPECTION_REVENUE` into `labourRevenue` where inspections are aggregated (keeping `inspectionRevenue` reported separately for the existing column), so `labourProfit = labourRevenue − wageCost` includes inspections.
- `src/components/analytics/MechanicProfitabilityPanel.tsx`: wording only — no calculation changes needed, since it sums the service rows.
