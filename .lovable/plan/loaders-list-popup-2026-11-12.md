# Loaders List popup

## What you'll see
A new **Loaders List** button on the Loading page, beside "View Loading List" and "Scan to bay". It opens a popup centred on the screen with:

- A date picker at the top. It defaults to today.
- **One section per driver**, based on the delivery driver on each job. Bikes with no driver go in an "Unassigned" section. Each heading shows "X of Y taken out".
- Each bike in the depot that's booked out for that day shows:
  - its collection photo (tap it to see it bigger)
  - bike name (brand and model)
  - customer name
  - tracking number
  - location (bay, e.g. A4)
  - a **Taken out of depot** button
- When a loader taps **Taken out of depot**:
  - the bike stays in the list but greys out
  - its bay is freed
  - it shows "Taken out by <name> at HH:mm"
- Taken-out bikes go to the bottom of their driver's section. Bikes still waiting stay at the top, so nobody has to guess.
- Admins get an **Undo** link on taken-out bikes in case one was tapped by mistake. The undo puts the bike back in the bay it came from.

## How "taken out" is recorded
Tapping the button counts as loading the bike onto the van. So the bike's status, the bay layout and the existing loading list all update together.

What's new is that the system also saves **who** took it out, not just when. This works however the bike gets loaded: this button, "Load All onto Van", scanning, or removing it from a bay.

## Technical details
- Migration: add `orders.loaded_onto_van_by uuid` and `orders.loaded_onto_van_by_name text`. These are filled in by a BEFORE UPDATE trigger whenever `loaded_onto_van` changes from false to true, using `auth.uid()` and that person's profile name. The trigger clears them when a bike is unloaded. Because it's a trigger, every loading path is covered.
- Undo for admins: a new `undo_taken_out(p_order_id)` security-definer function. It is admin-only, restores the last `storage_locations` entry from a saved copy (`loaded_from_locations jsonb`, also written by the trigger) and logs the change in `label_scans`. It has `REVOKE EXECUTE` from PUBLIC/anon.
- "Taken out" calls the existing `load_orders_onto_van([id])` function, so it uses the same safe way of loading as the bulk loading button.
- New `src/components/loading/LoadersListDialog.tsx`:
  - Rows: orders whose scheduled delivery is on the chosen date and that either have bays in storage or were taken out on that date.
  - Grouped by `normaliseDriverName(delivery_driver_name)`.
  - Photo comes from `getCollectionPhotos`.
  - The list refreshes after each tap.
- `getOrdersForLoading` will also select the two new name/by columns.
- Add a small test for the grouping and sorting rule: waiting bikes first, unassigned driver last.
