## What I checked

- The failing upload is a 44 KB PDF into the `foam-my-bike-labels` bucket — well under any limit.
- The bucket exists, is private, has **no** file size limit and **no** MIME restrictions.
- RLS on `storage.objects` allows admin/loader/mechanic/route_planner to insert into that bucket — so this is not a permissions rejection.
- The browser console shows `TypeError: Failed to fetch` from `uploadToStorage`, after the built-in retry. That is a transport-level failure (request never got a HTTP response), not a server rejection — typical of a flaky mobile connection, a request aborted mid-flight, or the direct `*.supabase.co/storage` request being blocked on that network.

Because the request dies before reaching Supabase, no amount of client-side validation will fix it. We need a more resilient transport and a fallback path.

## Plan

**1. Swap the storage upload to XHR-based transport**
In `src/utils/uploadFile.ts`, replace the `supabase.storage.from().upload()` fetch call with a direct `XMLHttpRequest` PUT/POST to the storage REST endpoint (with the session access token). Benefits:
- Returns real HTTP status codes instead of an opaque `Failed to fetch`.
- Exposes upload progress and a proper timeout, so we can distinguish "stalled" from "rejected".
- More reliable on mobile browsers where `fetch` bodies get aborted on network handover (Wi-Fi ↔ cellular).

**2. Smarter retry**
- Retry up to 3 times with exponential backoff (1s / 3s / 6s) rather than a single immediate retry.
- Only retry on transport failures / 5xx / 408; fail fast on 4xx with the server's actual message.

**3. Server-side fallback upload**
Add an edge function `upload-label` that accepts the file (multipart) plus `orderId`, `bucket`, verifies the caller's JWT and role, and writes to storage with the service role. If the direct storage attempt fails all retries, `uploadToStorage` transparently retries through this function. The functions endpoint is a different host path than the storage endpoint, so it survives cases where the storage host specifically is being blocked/stalled.

**4. Upload progress + clearer errors in the UI**
- `FoamMyBikeSection.tsx` and `BoxMyBikePage.tsx`: show a progress percentage while uploading and disable the input during the upload.
- Error toast reports the concrete cause (HTTP status, stalled, offline) instead of a generic "connection dropped".

**5. Verify**
- Test the same 44 KB PDF end-to-end against the real bucket after the change (direct path and forced-fallback path) and confirm the object lands in `foam-my-bike-labels` and the label URL renders.

## Technical notes

- Storage endpoint used by XHR: `${SUPABASE_URL}/storage/v1/object/foam-my-bike-labels/<path>` with `Authorization: Bearer <access_token>`, `x-upsert: true`, and the file's content type.
- The edge function uses `SUPABASE_SERVICE_ROLE_KEY` internally only; the client keeps sending the anon key + user JWT. Role check mirrors the existing bucket policy (admin/loader/mechanic/route_planner).
- Standard CORS preflight headers included, per project convention.
- No database schema changes needed; no changes to bucket config.
