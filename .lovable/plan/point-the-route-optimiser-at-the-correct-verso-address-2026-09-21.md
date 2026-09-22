# Point the route optimiser at the correct Verso address

The optimiser is currently calling the wrong web address, so Generate routes would fail. The Verso documentation confirms the solve endpoint and that coordinates must be sent as longitude then latitude — the request we build already does that, so only the address and key handling need fixing.

## What changes

- Call the address exactly as saved, including the `api_key=` part, appending the key if the saved value ends at `api_key=`.
- If the saved address doesn't already end in `solve`, add it automatically, so either form of the setting works.
- Keep sending the key as a header as well, so it works whichever way Verso expects it.
- When Verso rejects a request, show its own message in the error so any remaining mismatch is obvious immediately.

## Technical detail

In `supabase/functions/route-optimize/index.ts` (around line 406):

- Build the target URL once, before the day loop:
  - strip a trailing `/`; if the path doesn't end with `/solve` (ignoring any query string), append `/solve`
  - if the URL has `api_key` with an empty value, fill it with `VERSO_API_KEY`; if there's no `api_key` param at all, leave the query untouched
- Keep the existing `Authorization: Bearer` and `X-Api-Key` headers, plus `Content-Type: application/json`.
- Leave the payload unchanged (`vehicles`, `jobs`, `options.g`, `[lon, lat]`, epoch seconds).
- Redeploy `route-optimize` and confirm it still answers `401` without a signed-in staff user.

## Note

Difficult-area jobs are currently restricted to the longer expedition vehicle instances via skills. That matches the spec's intent for hard-to-reach work, but it means a difficult job can never land on a normal-length day — worth confirming after the first real run.
