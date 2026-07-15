## Problem

The QuickBooks create-customer call failed with:

> Malformed Web Site Address format — Supplied value: www.marcusbikes.com

QuickBooks' `WebAddr.URI` requires a fully-qualified URL (with `http://` or `https://`). The profile had `www.marcusbikes.com`, which QB rejects with a 400, causing the edge function to return non-2xx.

## Fix

Add a small `normalizeWebsite()` helper in both edge functions that:
- Trims the value
- Returns `undefined` if empty
- Prepends `https://` if the value doesn't already start with `http://` or `https://`
- Wraps in try/catch with `new URL(...)` — if it still doesn't parse as a valid URL, omit `WebAddr` from the payload rather than failing the whole customer create

Apply in:
- `supabase/functions/create-quickbooks-customer/index.ts` — where `WebAddr` is set from `profile.website`
- `supabase/functions/backfill-quickbooks-customers/index.ts` — same spot in the backfill loop

No frontend or schema changes. This unblocks Marcus Bikes and any other account whose stored website is missing a scheme.
