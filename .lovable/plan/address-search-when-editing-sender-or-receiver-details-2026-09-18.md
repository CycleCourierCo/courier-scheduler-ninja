# Address search when editing sender or receiver details

## What you get

On an order page, when you press "Edit Contact" on the Sender or Receiver panel, there will be a
"Search Address" box above the address fields — the same UK address search used on the Create Order
page. Type three or more characters, pick a result from the list, and the street, city,
county, postcode and country fill in automatically.

Manual typing still works exactly as it does now, so you can pick a result and then tweak a line, or
skip the search entirely.

The address book picker ("Select from address book") stays where it is; the new search sits
underneath it and only touches the address lines.

## How it will work

- Reuse a shared search component so the order page and Create Order behave identically: same
  UK-only results, same 3-character minimum, same short typing delay before searching, same
  dropdown styling.
- Selecting a result also captures the map coordinates and the UK constituent country
  (England / Wales / Scotland / Northern Ireland), so Northern Ireland routing and ferry pricing
  keep working when an address is changed after booking.
- Saving continues to work as today, including the existing fallback that looks up coordinates from
  the typed address when no search result was used.

## Technical notes

1. Extract the Geoapify autocomplete logic currently inside `src/components/AddressForm.tsx`
   (search state, debounce, fetch, suggestion list, manual-entry fallback) into a new presentational
   component `src/components/address/AddressSearchInput.tsx` that takes an
   `onSelect(address)` callback returning `{ street, city, state, zipCode, country, region, lat, lon }`
   — no react-hook-form dependency.
2. Refactor `AddressForm.tsx` to render `AddressSearchInput` and map the selected values onto its
   form fields via `setValue`, preserving the current field mapping (housenumber + street, city
   falling back to county, `region` from Geoapify `state`, lat/lon reset when absent) and the
   existing "enter manually" behaviour. No change to Create Order itself.
3. In `src/components/order-detail/AdminContactEditor.tsx`, render `AddressSearchInput` in the
   editing block above the Street Address field and merge the selection into `editedContact`.
   Extend local state with `region`, `lat`, `lon` so a searched selection is saved directly.
4. In `handleSave`, when a search selection supplied coordinates use them instead of calling
   `geocodeAddress`; otherwise keep the current geocode-from-string path and its warning toast.
   Merge `region` into the contact address alongside the other fields, leaving the existing stored
   value untouched when no search result was used.
5. No database, RLS, or edge function changes. Verify with a typecheck and build.
