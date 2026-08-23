# Fix silent failures on the Create Order form

## What's happening now

Three separate issues combine to produce the behaviour you saw:

1. **Address fields can be collapsed while empty.** The Street / City / County / Postcode / Country boxes only show after an address is picked from search (or "Enter address manually"). If the block is collapsed, validation messages render into a hidden area, so nothing is visible.
2. **Collection and Delivery addresses are validated differently.** The collection address requires County; the delivery address doesn't validate County at all — but the step gate for delivery does. So the "Next"/"Create Order" checks and the schema disagree, letting a half-filled delivery address through the step and then failing at submit with nothing on screen.
3. **Submit failure is invisible.** When submit validation fails the form switches tabs and fires a toast, but it doesn't expand the address block, nor scroll to or focus the offending field — so it reads as "nothing happened".

Geoapify often returns no county for UK addresses, which is what makes this hit real orders.

## What will change

- **Search-first stays.** The address fields remain hidden until the user has searched and picked an address (or chosen manual entry) — no change to that flow. The block additionally auto-expands if any of its fields has a validation error or a value, so errors can never hide.
- **County stays required** — on both collection and delivery. The delivery schema gets the missing County check so it matches collection and matches the step gate exactly. Street, City, County, Postcode, Country are required on both sides.
- **Errors you can't miss.** On a failed submit the form switches to the offending step, expands the address block, scrolls to and focuses the first invalid field, and the toast names the specific missing fields (e.g. "Delivery address: County, Postcode") instead of a generic message.
- **Live error clearing.** Picking an address from search (or clearing it) re-validates the fields immediately, so stale errors disappear and genuinely missing ones (like a county Geoapify didn't return) surface straight away.

Buttons stay enabled, as they are today, so clicking always gives feedback rather than silently doing nothing.

## Technical notes

- `src/components/AddressForm.tsx`: keep the `addressSelected` gate, but also expand when `useFormState` reports an error under `prefix` or when any address field holds a value; pass `{ shouldValidate: true, shouldDirty: true }` to the `setValue` calls in `handleSuggestionClick` / `handleManualEntry` / `handleSearchClick`.
- `src/pages/CreateOrder.tsx`:
  - `superRefine`: add the receiver `address.state` ("County is required") check so receiver matches sender; keep `addressSchema.state` required.
  - `handleNextToSender` / `handleNextToReceiver`: build the toast from the actual missing field labels (including County).
  - `form.handleSubmit(onSubmit, onInvalid)`: after `setActiveTab`, call `form.setFocus(firstErrorPath, { shouldSelect: true })` and compose the toast from the flattened error paths.
- No database, service or edge-function changes.

