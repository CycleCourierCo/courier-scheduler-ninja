# Public tracking endpoint for cyclecourierco.com

## Answers
- **Endpoint:** not yet. The booking site's own tracking page looks orders up directly, and nothing is set up for another website to call. The example in your theme (`.../functions/v1/public-track`) doesn't exist. This plan adds it.
- **Geoapify settings:** the three web addresses are right for the live sites. Two notes:
  - Address search will stop working in the Lovable preview and the published `courier-scheduler-ninja.lovable.app` address. To keep testing there, add `https://courier-scheduler-ninja.lovable.app` and `https://id-preview--252363c3-e673-4761-adce-5be670d61f60.lovable.app`.
  - Origin checks only block other websites. Anyone can still copy the key into their own scripts, so the earlier plan to move the key behind a server and replace it still stands.

## What gets built
1. A new public `public-track` lookup. It takes a tracking number and returns the same safe information the booking site's tracking page shows: status, timeline, collection and delivery dates, and the inspection summary. It never returns names, phone numbers, emails, full addresses or photos.
2. Optional postcode check. If the visitor also enters a postcode, it reveals the proof photos for that side, using the same check and rate limit as the booking site.
3. Only cyclecourierco.com, www.cyclecourierco.com and booking.cyclecourierco.com may call it from a browser. Unknown or badly formatted tracking numbers get a plain "not found" message.
4. A short guide for your theme: the web address to paste in, and an example request and response.

The address to paste into the theme will be `https://api.cyclecourierco.com/functions/v1/public-track`. That's the API address already in your Postman file, not `booking.`.

## Technical notes
- Edge function `public-track`, `verify_jwt = false`, PUBLIC class header. It accepts GET `?tracking=` and POST `{tracking, postcode?}`, validated with zod against the CCC754 pattern.
- It calls the existing `get_public_order` / `get_public_order_with_proof` RPCs with the anon key, so the existing sanitisation and rate limits apply. The response is whitelisted again in the function.
- CORS echoes the origin only for the three allowed domains. Responses are cached for 60 seconds.
- Docs: add a section to `docs/API_DOCUMENTATION.md`.
