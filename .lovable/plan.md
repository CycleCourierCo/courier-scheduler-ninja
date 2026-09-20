# Add all missing jobs to Shipday

## Changes

1. Add an **Add all missing to Shipday** button at the top of the available-jobs section, beside the existing Shipday control.
2. Count only currently visible jobs with a confirmed red cross. Do not include jobs still being checked, jobs already on Shipday, or ferry jobs needing an address rebuild.
3. Disable the button when there are no confirmed missing jobs, and show the missing-job count in its label.
4. When pressed, add each missing collection or delivery to Shipday, show progress, prevent repeat clicks, and retain the existing confirmation prompt for larger batches.
5. Recheck the affected jobs afterward so successful red crosses become green ticks, then report how many succeeded or failed.

## Technical notes

- Reuse the existing single-job Shipday creation and bulk progress/error handling in `RouteBuilder`.
- Keep the current **Load filtered into Shipday** control unchanged; the new action is the precise red-cross-only option.
- Preserve all filters, card selection, ferry rebuilding, and scheduling behaviour.
- Validate the control and status updates on the mobile scheduling view and desktop.