## Append Bay Breakdown to Existing Loader Loading List

Extend the existing "Send Loading List" flow so the message sent to the **loader only** (WhatsApp + email at `loaderPhoneNumber` / `loaderEmail`) includes an extra "Bay Breakdown" section grouping bikes-needing-loading by storage bay. Driver messages are unchanged.

### Client changes
- File: `src/pages/LoadingUnloadingPage.tsx`
- In `handleSendWithDriverNumbers`, after building `bikesNeedingLoadingData`, build a `bayBreakdown` array from in-storage bikes for the selected date:
  ```ts
  bayBreakdown: [
    { bay: "A", bikes: [{ position, trackingNumber, bikeBrand, bikeModel, receiverName, deliveryDriverName, bikeQuantity }, ...] },
    { bay: "B", ... }, ...
  ]
  ```
  - Source: `bikesNeedingLoadingData.filter(b => b.isInStorage)` flattened over `storageAllocations`.
  - Sort bays A→D (then any others alphabetically); within each bay sort bikes by `position` ascending.
- Pass `bayBreakdown` as a new field in the existing `supabase.functions.invoke('send-loading-list-whatsapp', { body: { ... } })` call. No new button, no new dialog.

### Edge function changes
- File: `supabase/functions/send-loading-list-whatsapp/index.ts`
- Extend `LoadingListRequest` with optional `bayBreakdown` (same shape as above).
- Add a `formatBayBreakdownText(bayBreakdown)` helper that renders:
  ```
  BAY BREAKDOWN
  
  Bay A
   • A1  TRK-123  Trek Domane – J. Smith (Tom)
   • A2  TRK-456  ...
  Bay B
   • B1  ...
  ```
  and a matching `formatBayBreakdownHtml(...)` for the email.
- **Only when composing the loader's WhatsApp text and the loader's email** (the existing branch that uses `loaderPhoneNumber` / `loaderEmail`), append the bay-breakdown section to the message body. Driver-specific WhatsApp/email composition is left untouched.
- Skip the section entirely if `bayBreakdown` is empty or undefined.

### Out of scope
- No new button, route, dialog, DB schema, or RLS change.
- No change to driver messages, templates, or per-driver categorisation logic.
- Not sent to management contacts beyond the existing loader recipient.

### Files
- Edit: `src/pages/LoadingUnloadingPage.tsx`
- Edit: `supabase/functions/send-loading-list-whatsapp/index.ts`
