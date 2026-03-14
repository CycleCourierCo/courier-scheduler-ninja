

## Plan: Add Loader Profile Selector + Send Individual Driver Lists to Loader

### Changes

**1. Frontend: `src/pages/LoadingUnloadingPage.tsx`**

- Fetch loader profiles (`role = 'loader'`) alongside driver profiles (add new state `loaderProfiles` and `loaderProfileSelection`)
- Replace the manual loader phone/email inputs (lines 1432-1454) with a **Select dropdown** filtered to loader profiles, same pattern as the driver selector. When a loader profile is selected, auto-populate `loaderPhoneNumber` and `loaderEmail` from that profile. Keep the manual input fields below for override.

**2. Edge Function: `supabase/functions/send-loading-list-whatsapp/index.ts`**

- After sending the management overview to the loader (lines 682-714), also send each individual driver's loading list to the loader (WhatsApp + email), **excluding** the "Unassigned Driver". This reuses the same loop that sends to individual drivers (lines 720-765) — simply add a send to the loader phone/email for each driver message within that loop.

