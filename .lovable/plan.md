## What I checked

- The `foam-my-bike-labels` bucket exists (private) and has working storage policies: staff (admin/loader/mechanic/route_planner) can do everything, customers can read their own order folder. So this is **not** a missing-bucket or missing-policy problem.
- The upload code in `src/components/boxmybike/FoamMyBikeSection.tsx` is byte-for-byte the same pattern as the working Box My Bike upload (`{orderId}/{timestamp}-{file.name}`, `upsert: true`).

`Failed to fetch` is a browser-level network error (the request never got a response), not a Supabase permission error. On mobile the usual causes are: a large camera/PDF file hitting the storage size cap or timing out, a filename with characters that break the storage key, or an expired auth session mid-request. Right now the code surfaces the raw message with no detail, so we can't tell which.

## Plan

1. **Make the failure diagnosable**
   - Wrap the label upload in a try/catch that logs the real error (name, message, file size/type, bucket, path) to the console and to Sentry via `Sentry.captureException`.
   - Show a specific toast per failure mode instead of the generic "Failed to fetch" (network/offline, too large, permission, unknown).

2. **Remove the likely causes**
   - **Sanitise the filename** before building the storage key: strip/replace anything outside `A–Z a–z 0–9 . _ -`, collapse spaces, and cap length. iPhone uploads often carry spaces, `#`, or non-ASCII characters that produce an invalid storage key.
   - **Guard file size client-side** (reject over ~20 MB with a clear message, suggest a PDF or smaller photo) so a huge camera image can't silently abort the request.
   - **Validate type** against `application/pdf` and `image/*` before uploading.

3. **Make it resilient**
   - Refresh the Supabase session before uploading (`getSession`), so a stale token can't kill the request.
   - Retry the upload once on a pure network failure before reporting an error.

4. **Fix the input reset bug**
   - `e.currentTarget.value = ""` runs after `mutate()` in the change handler; capture the input element into a local variable first so resetting it can't throw on a pooled/detached event.

5. **Apply the same treatment to the sibling uploads** so this doesn't resurface elsewhere: the Foam delivery-photo upload in the same file, and the Box My Bike label upload in `src/pages/BoxMyBikePage.tsx`.

## Technical notes

- Files touched: `src/components/boxmybike/FoamMyBikeSection.tsx`, `src/pages/BoxMyBikePage.tsx`, plus a small shared helper (e.g. `src/utils/uploadFile.ts`) holding the sanitise + validate + retry logic so all three call sites share it.
- No database or storage-policy migration is needed.
- After the change, one failed attempt will produce a precise console/Sentry entry, so if it's still failing we'll know exactly why on the next report.
