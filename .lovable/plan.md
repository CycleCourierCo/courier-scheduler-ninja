## Problem

While editing bike Brand/Model in the "Edit Bikes" dialog, characters you type get reverted after ~a second. Root cause: `ItemDetails.tsx` recomputes `initialBikes` via `useMemo([order])` and a `useEffect` that resets `editBikes` whenever `initialBikes` changes. The order page polls / re-fetches, producing a new `order` object reference every cycle, which overwrites the in-progress edits.

## Fix

Stop resetting `editBikes` from `order` while the dialog is open.

In `src/components/order-detail/ItemDetails.tsx`:
- Remove the `useEffect` that syncs `editBikes` from `initialBikes` on every order change.
- Instead, seed `editBikes` from the current order only when the dialog opens: when `setEditOpen(true)` is called (via the Edit Bikes button), compute the bikes array from `order` and `setEditBikes(...)` at that moment.
- Keep `useState` initial value as the current `initialBikes` for first render safety.
- Leave save logic, dialog markup, and admin gating unchanged.

Result: typing is preserved because background order refreshes no longer clobber the edit state; opening the dialog still starts from the latest saved data.
