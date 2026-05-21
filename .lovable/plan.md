# Surface B2C contacts in the Announcements recipient picker

## Problem
The Announcements page only fetches from `profiles` where `account_status = 'approved'`. The business has just 1 B2C profile — real B2C customers exist as entries in the `contacts` table (linked to orders as sender/receiver). They never appear individually or via the role filter.

## Approach

Pull B2C contacts from the `contacts` table alongside profiles and merge them into the recipient picker.

### Data source
Query `contacts` with `email IS NOT NULL`. Deduplicate by lowercased email. Each contact gets a synthetic record:
- `id`: `contact:<uuid>` prefix to keep distinct from profile ids
- `name`, `email`, `phone` from the contact row
- `role`: pseudo-role `b2c_contact`
- `company_name`: null

Merge order: profiles first, then contacts whose email isn't already covered by a profile (profiles win on conflict).

### UI changes (`AnnouncementEmailsPage.tsx`)
- **Individual tab**: existing search list now includes B2C contacts with a small "B2C Contact" badge so they're distinguishable from registered users.
- **Role tab**: add a "B2C Contacts" entry to `ROLE_LABELS` (label only — not a real `user_role` enum value) and let the role filter match `role === 'b2c_contact'`.
- Recipient dedupe by lowercased email is already in place — keep as-is.

### Backend / RLS
No schema changes. Admin and sales already have `SELECT` on `contacts` via existing policies (`has_role(uid,'admin')`). Confirmed in current RLS.

### Persistence
`scheduled_announcements.recipient_ids` and `recipient_roles` continue to store the synthetic ids / pseudo-role string. The scheduled-announcements cron resolves them the same way at send time — it will need the same merged source. Touch `supabase/functions/process-scheduled-announcements/index.ts` so scheduled sends to B2C contacts also work.

## Out of scope
- No new tables, no migration.
- No changes to send-email / send-sendzen edge functions (they already take a `to` address).
- No phone-number cleanup for contacts.

## Technical notes
- Contacts count is large (thousands) — fetch with `.range()` pagination loop (Supabase 1k limit).
- Memoised `mergedRecipients` derived once, reused by both search-filter and role-filter `useMemo`s.
- Sales role already has access to `/emails` and `contacts.SELECT` — no role plumbing changes.
