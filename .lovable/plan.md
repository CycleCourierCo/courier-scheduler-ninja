# Security finding: orders GET without auth — already remediated

## What I checked

The public `orders` API endpoint was verified live and in code:

- The GET handler requires an `X-API-Key` header and validates it via the `verify_api_key` database function. Missing or invalid keys are rejected with 401.
- Live checks against the deployed function confirm this: a request with no key returns 401 `MISSING_API_KEY`, and a bogus key returns 401 `INVALID_API_KEY`.
- The order lookup is scoped to the API key owner (`user_id` must match the caller), so one customer cannot read another customer's order.
- The response no longer returns the whole order row. It returns an explicit field list (tracking number, status, dates, timeslots, bike details, plus the `sender`/`receiver` blocks that belong to the caller's own booking).

The finding describes an earlier state of the code and no longer reflects the deployed function.

## Proposed action

No code changes. Instead:

1. Mark the finding as resolved/ignored with the reasoning above so future scans don't re-raise it.
2. Update the security memory to record the intended access model for this endpoint:
   - `orders` is a customer-facing API authenticated by per-customer API keys (`X-API-Key` + `verify_api_key`), not JWT — `verify_jwt = false` is intentional for that reason.
   - Every read is scoped to the key owner's own orders; the sender/receiver PII returned is data the caller themselves submitted.
   - Any future change must keep the key check, the `user_id` scoping, and the explicit field allow-list (never `select('*')` on orders).

## Optional hardening (say the word if you want it)

- Rate-limit per API key on the GET path to slow ID-guessing attempts.
- Return only the postcode/town portion of sender/receiver addresses unless the caller's key is flagged for full detail.
