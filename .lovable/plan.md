

## Add "Test Account" Toggle for B2B Profiles

### What it does
Adds an `is_test_account` boolean flag to the `profiles` table. When enabled on a B2B profile, Shipday job creation and email sending will be skipped for orders belonging to that user. This lets admins create test accounts without triggering real external integrations.

### Database change
Add column `is_test_account` (boolean, default false) to `profiles` table via migration.

### UI change
**File: `src/components/user-management/EditUserDialog.tsx`**
- Add a Switch toggle labeled "Test Account" in the Business tab with helper text: "Disables Shipday sync and email sending for this account"
- Wire it to `formData.is_test_account`

**File: `src/types/user.ts`**
- Add `is_test_account: boolean | null` to `UserProfile`

### Integration changes

**File: `src/services/shipdayService.ts`** (`createShipdayOrder`)
- Before invoking the edge function, fetch the order's `user_id`, then check `profiles.is_test_account`
- If true, log a skip message and return early without calling Shipday

**File: `src/services/emailService.ts`** (email-sending functions)
- Similarly check the order owner's `is_test_account` flag before invoking the send-email edge function
- If true, skip silently

**File: `supabase/functions/create-shipday-order/index.ts`**
- Add a server-side check: query `profiles.is_test_account` for the order's `user_id`. If true, return `{ success: true, skipped: true, reason: 'test_account' }` without calling Shipday API.

**File: `supabase/functions/send-email/index.ts`**
- Add a similar server-side check before sending emails for order-related email types.

### Approach rationale
Checking at both client and server level ensures test accounts never accidentally trigger external services regardless of where the call originates (UI, scheduling, webhooks, etc.). The server-side check in edge functions is the primary guard; the client-side check provides better UX with skip messages.

