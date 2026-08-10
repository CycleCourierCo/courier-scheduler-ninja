# Allow £0 pricing on inspection issues

Right now when pricing an issue at the "Awaiting pricing" stage, saving with both Parts and Labour empty or zero is blocked with "Enter at least a parts or labour price". Some repairs genuinely have nothing to bill (goodwill, quick adjustment), so £0 should be a valid price.

## Behaviour

- Parts £0 + Labour £0 saves successfully and marks the issue as priced (so the bike can move on through the workflow instead of sitting in Awaiting pricing).
- Negative or non-numeric values are still rejected.
- Blank fields count as £0.
- Downstream behaviour is unchanged: a job whose total comes to £0 already counts as billing-settled and shows in the Invoiced tab, and the "Create invoice" button stays hidden when there is nothing to bill.

## Technical notes

- `src/pages/BicycleInspections.tsx`, pricing block around the Save button (~line 1340): remove the `if (parts + labour <= 0)` guard, keep the finite/negative validation.
- No change needed to `setIssuePrice` in `src/services/inspectionService.ts` (it writes 0 fine and stamps `priced_at`), and the `allPriced` check already uses `estimated_cost != null`, so 0 counts as priced.
- No database changes.
