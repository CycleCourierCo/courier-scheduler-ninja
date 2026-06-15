## The problem (confirmed)

The public tracking page is built on a "trust the client" model:

- `get_public_order` returns the **full** `tracking_events` JSONB to anon. That includes POD photo URLs, signature URLs, driver names embedded in events, GPS coordinates per event, etc.
- The "Verify postcode to view images" gate in `TrackingTimeline.tsx` is purely a React `useState` flag — the image URLs are already in the network response. Anyone with DevTools open sees them without entering the postcode.
- Worse: the postcode the dialog compares against (`order.sender.address.zipCode`) is *also* in the response — so the gate validates user input against a value that's already public. After the recent RPC sanitisation that field is now `""`, which means the gate is currently **completely broken** (it accepts an empty string as "correct"). That's a regression we need to fix anyway.
- A few other public-facing pages still go directly to tables (`SenderAvailability`, `ReceiverAvailability` via `getPublicOrder` is fine now, but I want to confirm no edge function reflects the full row back).

So the architecture needs to flip: **the server decides what to send based on what the caller has proven**, and the client only renders what it received.

## Plan

### 1. Split the public tracking RPC into "default" and "verified" payloads

Replace today's `public.get_public_order(p_identifier)` with two RPCs (or one RPC with a second `p_proof` argument):

**`get_public_order(p_identifier text)` — default, anonymous**
Returns only what's safe for anyone with the order id/tracking number:
- `id`, `tracking_number`, `customer_order_number`
- `status`, `created_at`, `updated_at`, scheduled/pickup/delivery dates + timeslots, confirmation timestamps
- `bike_brand`/`bike_model`/`bike_type`/`bike_quantity` and the sanitised `bikes` array
- Sender/receiver: `name` + `city` + `country` only — **drop postcode** from the default payload
- A **sanitised** `tracking_events`: keep `type`, `status`, `timestamp`, `description`. **Strip** `podUrls`, `signatureUrl`, `driverName`, `latitude`/`longitude`, raw Shipday payload fields
- A boolean per event: `has_pod`, `has_signature` — so the UI can render "Verify postcode to view proof" only when there *is* something to reveal
- `inspection_summary` as today (already sanitised)

**`get_public_order_with_proof(p_identifier text, p_postcode text)` — gated**
Server-side compares the trimmed/lower-cased `p_postcode` against `sender.postcode` and `receiver.postcode`. If it matches one side:
- Returns the same payload as above, plus
- `tracking_events` enriched with `podUrls` / `signatureUrl` **only for that side** (collection events if sender postcode matched; delivery events if receiver postcode matched)
- Still **never** returns address line 1/2, phone, email, GPS, or financials

If no match: returns the default payload unchanged + an `verification_failed: true` flag the UI can use to show "Incorrect postcode".

Both functions remain `SECURITY DEFINER`, `STABLE`, `search_path = public`, with `EXECUTE` granted to `anon` / `authenticated`.

### 2. Rewrite the UI gate as a real server call

In `TrackingTimeline.tsx` / `PostcodeVerification.tsx`:
- Remove `getExpectedPostcode` and the client-side string compare entirely.
- When the user submits a postcode, call `supabase.rpc('get_public_order_with_proof', { p_identifier, p_postcode })` and replace the order in the query cache with the response.
- Show the POD / signature blocks only for events that actually have `podUrls` / `signatureUrl` in the returned payload (i.e. the side the user proved).
- Show the "Verify postcode" button only when the event has `has_pod` / `has_signature` true. Hide it otherwise (no point teasing a non-existent image).

### 3. Lock down the storage that hosts the POD images

Server-side gating is moot if the URLs themselves are guessable / public:
- Check whether POD URLs are public Shipday URLs or stored in a Supabase bucket. If they're in a Supabase bucket, make the bucket private and return **short-lived signed URLs** from the `_with_proof` RPC instead of the raw paths. If they're remote Shipday URLs, accept that they're externally accessible and at minimum proxy them through an edge function that re-checks the postcode before redirecting.
- Document the choice in the security memory.

### 4. Audit the remaining anon-reachable surfaces

Quick pass with concrete fixes per finding (not a generic "review everything"):

- **`SenderAvailability` / `ReceiverAvailability`** — already route through `getPublicOrder` (the new RPC). Confirm they don't need any extra fields and that the page renders correctly with the trimmed payload. If they do need e.g. `bikes` count, it's already in the payload.
- **`BulkAvailabilityPage`** — already on `get_my_pending_availability_orders`. Confirm.
- **`get_public_inspection_summary`** — re-read; confirm it only returns counts/timestamps, no part numbers, no internal notes, no photos, no prices.
- **Edge functions that reflect order data to the client** — grep `supabase/functions/**` for responses that include order rows or `sender`/`receiver` JSONB. Anything callable without a JWT (`verify_jwt = false` and no in-function auth check) gets the same sanitisation treatment, or moves behind an auth check.
- **`orders` table RLS** — confirm `anon` no longer has any direct `SELECT`. The two RPCs are the only public read path.

### 5. Tests & verification

- Drive Playwright as an anonymous user:
  1. `/tracking/<tracking_number>` → assert response body contains no `podUrls`, `signatureUrl`, `email`, `phone`, address lines, lat/lng. Screenshot the timeline.
  2. Click "Verify collection postcode", enter the wrong one → assert error, no POD URLs in any response.
  3. Enter the correct sender postcode → assert collection events now carry `podUrls`, delivery events do not.
  4. Repeat with receiver postcode for delivery-side proof.
- Run `supabase--linter` after the migration.

## Technical notes

- The "verified" RPC should not return *anything* extra unless the postcode matched. Returning a `verification_failed` flag is fine; returning the postcode itself, the address, or the other side's POD is not.
- Rate-limit `get_public_order_with_proof` to prevent brute-forcing the postcode. Easiest path: a small `public.tracking_verification_attempts(ip text, order_id uuid, attempted_at timestamptz)` table written from inside the RPC and rejecting more than N attempts per (ip, order) per 10 minutes. If we can't get the caller IP into the RPC reliably, do the throttle in an edge function wrapper instead and have the wrapper call the RPC.
- Keep the bikes JSONB sanitiser (brand/model/type/quantity only). Keep `inspection_summary` as already implemented.
- Postcodes for sender/receiver are pulled from the JSONB snapshot fields (`postcode` / `zipCode` / `postal_code`) — normalise to one canonical key inside the RPC.

## Questions before I implement

1. **POD storage**: are the POD images hosted by Shipday (public URLs) or stored in our Supabase storage? This decides whether step 3 needs a bucket migration or a proxy edge function.
2. **Rate limiting**: OK to add a `tracking_verification_attempts` table and a 10/10-minute cap per order? Or do you want the gate to be untimed?
3. **Single vs. two RPCs**: prefer one `get_public_order(identifier, postcode?)` overload, or two distinct functions? Two is clearer in logs/permissions; one is a smaller blast radius for the frontend change.
