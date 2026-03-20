

## Allow Admins to See All Contacts + Remove 1K Query Limit

### Problem
1. `fetchUserContacts` always filters by `.eq('user_id', userId)` — so admins only see their own contacts, not all users' contacts.
2. Supabase default limit is 1,000 rows. With 3,201 contacts, admins would only see the first 1,000 even if the filter were removed.

### Changes

| File | Change |
|---|---|
| `src/services/contactService.ts` | Add `fetchAllContacts()` function that fetches all contacts without a `user_id` filter, using pagination to bypass the 1K limit (loop with `.range()` in batches of 1,000). |
| `src/hooks/useContacts.ts` | Accept an `isAdmin` flag. When `isAdmin` is true, call `fetchAllContacts()` instead of `fetchUserContacts(userId)`. |
| `src/pages/CreateOrder.tsx` | Pass `isAdmin` (from AuthContext `user.role`) to `useContacts`. Admins see all contacts; non-admins see only their own. |

### Technical detail

**Pagination in `fetchAllContacts`**: Loop fetching 1,000 rows at a time using `.range(offset, offset + 999)` until fewer than 1,000 rows are returned. This ensures all 3,201+ contacts are returned.

**RLS**: The `contacts_select_policy` already grants admins full SELECT access, so no DB changes needed.

**`fetchUserContacts`** also needs the pagination fix for users who might have >1,000 contacts (unlikely but defensive). We'll add `.limit(5000)` or similar as a pragmatic cap for the user-scoped query, since individual users are unlikely to have thousands.

