## What I checked

The client code is already identical: both `BoxMyBikePage.tsx` and `FoamMyBikeSection.tsx` call the same `uploadToStorage()` helper. So the difference is not in the upload code — it's in the storage permissions and the fallback path.

Confirmed by querying the database:

- Both buckets exist and are private.
- `box-my-bike-labels` has **4** policies: admin/cs_agent/loader ALL, plus owner SELECT/INSERT/UPDATE.
- `foam-my-bike-labels` has only **2**: staff ALL for admin/loader/mechanic/route_planner, and customer SELECT.

So a `cs_agent` (or an order-owner customer) who can upload a box label is rejected by RLS on the foam bucket. A rejected upload returns 4xx, and the code then tries the `upload-file` edge function, which is where the "Failed to fetch" in the console comes from.

## Plan

1. **Mirror the Box My Bike storage policies onto `foam-my-bike-labels`** (migration):
   - Staff ALL policy extended to include `cs_agent` (matching box), keeping admin/loader/mechanic/route_planner.
   - Owner INSERT/UPDATE policies scoped to `orders.user_id = auth.uid()` on the folder-name order id, matching the box owner policies.
   - Keep the existing customer SELECT policy.

2. **Match the same role set in the `upload-file` edge function** so its authorisation check can't be stricter than the storage policies.

3. **Report the real reason instead of "connection dropped"**: when the direct upload returns a 4xx (permission/policy), stop and show that message rather than falling through to the edge fallback and reporting a transport error. Only genuine transport failures (network drop, timeout, 5xx) should use the fallback.

4. **Verify** by re-running an upload against the foam bucket and confirming the row updates with `foam_label_url`.

## Technical notes

Files touched: one new migration for `storage.objects` policies, `supabase/functions/upload-file/index.ts` (role list), and `src/utils/uploadFile.ts` (error classification). No change to `FoamMyBikeSection.tsx` UI.

One thing that would speed this up: if you tell me which account you're uploading from (admin, cs_agent, or the customer's own login), I can confirm the exact policy that rejected it — but the plan above covers all three cases.
