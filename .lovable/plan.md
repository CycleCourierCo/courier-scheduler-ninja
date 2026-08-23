# Fix silent failures on the Create Order form

## What's happening now

Three separate issues combine to produce the behaviour you saw:

1. **Address fields are hidden.** On the create-order form, the Street / City / County / Postcode / Country boxes only appear after an address has been picked from search (or "Enter address manually" is clicked). If any of them ends up empty afterwards, there is nothing on screen to show the error against — validation messages render into a hidden block.
2. **Collection and Delivery addresses are validated differently.** The collection address requires County; the delivery address does not validate County at all. So a half-filled delivery address can pass the step gate, and the mismatch between the step check and the final submit check means the "Next" button and the "Create Order" button disagree about what is valid.
3. **Submit failure is invisible.** When submit validation fails, the form switches tabs and fires a toast, but it does not scroll to or focus the offending field, and the field itself may be inside the hidden address block — so it reads as "nothing happened".

Geoapify frequently returns no county for UK addresses, which is what makes this hit real orders rather than being theoretical.

## What will change

- **Address fields always visible.** The collection and delivery address blocks render their fields at all times, so any missing or invalid field shows its own red message directly under the input. The address search box stays exactly as it is on top.
- **Consistent required fields.** Street, City, Postcode and Country are required for both collection and delivery. County becomes optional on both (it is not needed for routing and is often missing from lookups). The step-gate checks are updated to match this exactly, so "Next" and "Create Order" can never disagree.
- **Errors you can't miss.** On a failed submit the form switches to the offending step, scrolls to and focuses the first invalid field, and the toast names the specific fields that are missing (e.g. "Delivery address: Postcode, Country") instead of a generic message.
- **Live error clearing.** When an address is chosen from search or cleared, the fields are re-validated immediately so stale errors disappear and fresh ones appear as expected.

Buttons stay enabled, as they are today, so clicking always gives feedback rather than silently doing nothing.

## Technical notes

- `src/components/AddressForm.tsx`: remove the `addressSelected` gate around the field block (keep the search + manual-entry UI), and pass `{ shouldValidate: true, shouldDirty: true }` to the `setValue` calls in `handleSuggestionClick` / `handleManualEntry` / clear.
- `src/pages/CreateOrder.tsx`:
  - `addressSchema`: `state` -> `z.string().optional()`; add `street`/`city`/`zipCode`/`country` checks for the receiver inside `superRefine` so both sides match (receiver county not required).
  - `isSenderValid` / `isReceiverValid`: drop `state` from the required watch list.
  - `handleNextToSender` / `handleNextToReceiver`: build the toast message from the actual missing field labels.
  - `form.handleSubmit(onSubmit, onInvalid)`: after `setActiveTab`, call `form.setFocus(firstErrorPath, { shouldSelect: true })` and compose the toast from the flattened error paths.
- No database, service or edge-function changes; `createOrder` already tolerates a missing county.
