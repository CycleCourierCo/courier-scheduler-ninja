# Partner integration documentation

Right now the API page has a short "Connect with Cycle Courier" summary. This turns it into a complete, self-contained partner guide you can send to Velodealer or anyone else, plus a copy they can download.

## What you will be able to do

- Send partners a single link to the API page and have everything they need on it.
- Give them a downloadable copy (a "Download partner guide" button on the page) for their own developers.

## What the guide will cover

1. **Getting started** — what Cycle Courier gives them (App ID, App secret), what they give us (return web addresses, contact), and how to test.
2. **Step-by-step connect flow** — the exact approval link with every parameter explained, what comes back, and how to generate the PKCE challenge (with a short code snippet).
3. **Tokens** — exchanging the code, one-hour access tokens, 180-day rotating refresh tokens, how to store them, and what to do when a refresh fails.
4. **Using the API on a customer's behalf** — the `Authorization: Bearer` header, that access equals the customer's own API access, and links to the existing create/read order sections.
5. **Disconnecting** — partner-initiated revoke, plus the fact that a customer can disconnect from their profile at any moment.
6. **Errors and edge cases** — a table of the actual error codes the endpoints return (invalid client, bad redirect address, expired or reused code, expired token, revoked access) with the right response for each.
7. **Checklist and security notes** — keep the secret server-side, always send `state`, one connection per customer, sandbox/testing advice, and a support contact.
8. **Worked example** — a short end-to-end script showing approval link, exchange, an order create call, and a refresh.

## Technical details

- Rewrite the "Connect with Cycle Courier" block in `src/pages/ApiDocumentationPage.tsx` into a dedicated "Partner Integration (OAuth 2.1)" card section with the subsections above, using the existing Card/Badge/Alert/code styling already on the page.
- Add `docs/PARTNER_API_INTEGRATION.md` with the same content in markdown, and a "Download partner guide" button on the page that serves it (bundled as a raw import / blob download, no backend needed).
- Error tables will be written from the actual responses in `supabase/functions/oauth-authorize`, `oauth-token`, `oauth-revoke` and `_shared/apiAuth.ts` — codes such as `unauthorized_client`, `invalid_redirect_uri`, `invalid_grant`, `invalid_client`, `INVALID_TOKEN` — so the documented codes match what partners will really see.
- No changes to the endpoints, database, or existing API-key behaviour.
