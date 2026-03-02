

## Plan: Switch Loading Lists to SendZen + Add Loader + Driver Selector

### Overview
Three changes: (1) replace 2Chat WhatsApp with SendZen session text messages, (2) add loader phone/email option, (3) replace manual driver phone/email inputs with a dropdown that selects from driver profiles in the database.

### Changes

**1. Frontend: `src/pages/LoadingUnloadingPage.tsx`**

- Add state for `loaderPhoneNumber` and `loaderEmail`
- Fetch all driver profiles (`role = 'driver'`) from the `profiles` table when the dialog opens
- Replace the manual phone/email inputs for each driver with a **Select dropdown** that filters to profiles where `role = 'driver'`. When a driver profile is selected, auto-populate the phone and email from that profile's `phone` and `email` fields
- Add a "Loader" section at the top of the dialog with phone and email inputs (or a similar driver-style selector filtered to loaders)
- Pass `loaderPhoneNumber` and `loaderEmail` in the request body to the edge function

**2. Edge Function: `supabase/functions/send-loading-list-whatsapp/index.ts`**

- Replace all 2Chat API calls with SendZen session text messages:
  - URL: `https://api.sendzen.io/v1/messages`
  - Auth: `Authorization: Bearer ${sendzenApiKey}` (using existing `SENDZEN_API_KEY` secret)
  - Body format:
    ```json
    {
      "from": "441217980767",
      "to": "+44...",
      "type": "text",
      "text": { "body": messageContent, "preview_url": false }
    }
    ```
- Remove references to `TWOCHAT_API_KEY` and `TWOCHAT_FROM_NUMBER`
- Update `LoadingListRequest` interface to accept `loaderPhoneNumber?: string` and `loaderEmail?: string`
- After sending management WhatsApp/email, send the same management overview to the loader phone (via SendZen text) and loader email (via Resend) if provided
- Update all three WhatsApp send points (management, loader, individual drivers) to use SendZen

**3. Specific SendZen replacements in the edge function:**

- **Lines 490-491**: Replace `TWOCHAT_API_KEY`/`TWOCHAT_FROM_NUMBER` with `SENDZEN_API_KEY` and hardcoded from number `441217980767`
- **Lines 618-638** (management WhatsApp): Replace 2Chat fetch with SendZen text message
- **Lines 676-701** (driver WhatsApp): Same replacement
- Add new loader WhatsApp send block after management send

### Technical Details

- The driver selector will query `profiles` table filtered by `role = 'driver'` and `is_active = true`
- Driver name matching: the dialog currently lists drivers by their `delivery_driver_name` from orders. The selector will try to match by name, and if a match is found, auto-select that profile. Otherwise the user picks manually.
- No database changes required — all data already exists in the `profiles` table
- No new secrets needed — `SENDZEN_API_KEY` is already configured

