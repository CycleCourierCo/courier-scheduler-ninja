## Update "Load All onto Van" to skip unassigned bikes

In `src/pages/LoadingUnloadingPage.tsx`, change the `onClick` of the new "Load All onto Van" button so it:

1. Gets the full list from `getBikesNeedingLoading(selectedLoadingDate)`.
2. Splits into:
   - `toLoad` = bikes where `delivery_driver_name` is set.
   - `skipped` = bikes where `delivery_driver_name` is null/empty.
3. If `toLoad.length === 0` → show a warning toast ("No bikes with an assigned driver to load") and return.
4. Sequentially `await handleRemoveAllBikesFromOrder(b.id)` for each bike in `toLoad`.
5. Show a success toast: `Loaded N bike(s) onto van` and, if `skipped.length > 0`, append `(skipped X with no driver assigned)`.

No changes to the individual per-card "Load onto Van" button — only the bulk action filters by assigned driver.