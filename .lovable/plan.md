

## Add Contact Selector to Admin Contact Editor

### What changes

When an admin clicks "Edit Contact" on the Order Detail page, add a "Select from address book" dropdown (reusing the existing `ContactSelector` component) above the manual form fields. Selecting a contact auto-fills all fields.

### Technical details

**File: `src/components/order-detail/AdminContactEditor.tsx`**

1. Import `ContactSelector` from `@/components/create-order/ContactSelector` and `useContacts` from `@/hooks/useContacts`
2. Inside the editing form (line 203-294), add a `ContactSelector` above the Name field
3. Call `useContacts(undefined, true)` to fetch all contacts (admin mode)
4. On contact selection, populate `editedContact` state with the selected contact's fields:
   - `name`, `email`, `phone`, `street`, `city`, `state` (county), `postal_code` → `zipCode`, `country`

The `ContactSelector` is already built with search, and `useContacts` with `isAdmin=true` fetches all contacts with pagination. No new components or backend changes needed.

