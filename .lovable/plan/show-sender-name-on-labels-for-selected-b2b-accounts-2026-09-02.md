# Show sender name on labels for selected B2B accounts

## Goal
Some B2B customers want to see who sent a bike. Add an account-level flag so labels printed for that customer's orders include a "FROM" line with the sender's name.

## What changes

### 1. Account flag
- New field on customer profiles: "Show sender name on labels" (off by default).
- Editable by admins in User Management → Edit user → Business tab (shown for business accounts).

### 2. Label output
- When an order belongs to an account with the flag on, the label prints a `FROM:` line with the sender's name (name only — no address or phone), placed just above the existing `TO:` block.
- Labels for accounts without the flag are unchanged.
- Applies everywhere labels are produced: single order label (order detail, customer order detail, order card list, loading/storage lists) and bulk collection label PDFs (Dashboard, Loading/Unloading page).

### 3. Enable for the requesting customer
Once approved, turn the flag on for the specific customer — tell me the account email and I'll set it.

## Technical notes
- Migration: `ALTER TABLE public.profiles ADD COLUMN show_sender_on_label boolean NOT NULL DEFAULT false;` (no new table, so existing grants/RLS apply; admins already have update rights on profiles).
- `src/utils/labelUtils.ts`: `renderLabelPage` gains an optional `showSenderName` argument; `generateSingleOrderLabel` / `generateBulkCollectionLabels` become responsible for resolving the flag by querying `profiles` for the distinct `user_id`s of the orders being printed (one batched `in(...)` query) and passing the result down.
- `src/pages/LoadingUnloadingPage.tsx` calls `renderLabelPage` directly, so it resolves the same flag set before its render loop.
- Sender name is read from the order's `sender` JSONB snapshot (source of truth), falling back to nothing when absent.
- `EditUserDialog.tsx`: add a Switch bound to the new field in the Business tab, included in the profile update payload.
