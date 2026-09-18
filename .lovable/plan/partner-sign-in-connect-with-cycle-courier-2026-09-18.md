# Partner sign-in ("Connect with Cycle Courier")

Today a partner system like Velodealer can only use the API if the customer copies an API key out of their account and pastes it in. This adds a proper approval flow instead: Velodealer sends the customer to a Cycle Courier approval screen, the customer logs in and presses Allow, and Velodealer is then able to act on that customer's account until the customer revokes it.

## What the customer sees

1. In Velodealer they press "Connect Cycle Courier".
2. They land on a Cycle Courier page showing who is asking for access and which account they are signed into.
3. They press Allow (or Cancel) and are sent back to Velodealer, connected.
4. In their Cycle Courier account, a new "Connected apps" section lists every partner they have approved, when it was approved and when it was last used, with a Revoke button.

## What staff see

- A new staff-only "Partner apps" page where you register a partner: name, logo, their return web address(es) and a contact.
- Registering shows the credentials to hand the partner once (an app ID and a secret, shown a single time).
- You can disable a partner app, which instantly cuts off every customer connection for it.
- Access granted to a partner is the same as that customer's own API access (create orders, read orders, tracking) — no separate permission picker.

## How the access works

- Approval hands the partner a short-lived access token (1 hour) plus a long-lived refresh token, so Velodealer stays connected without asking the customer again.
- Tokens are tied to one customer and one partner app; revoking either kills them immediately.
- Existing API keys keep working exactly as they do now, so current integrations are unaffected.

## Partner-facing documentation

Add a page to the existing API docs covering the approval URL, the token exchange, refreshing, revoking, and the error responses — enough for Velodealer to build against without back-and-forth.

## Technical details

Standard OAuth 2.1 authorization-code flow with PKCE, implemented in this project (not Supabase's own OAuth server, which serves a different purpose).

New tables:
- `oauth_clients` — staff-registered partner apps: name, logo, `client_id`, hashed secret, allowed redirect URIs, active flag.
- `oauth_authorization_codes` — single-use codes, 60-second lifetime, PKCE challenge, redirect URI, user, client.
- `oauth_access_grants` — the customer's standing approval per client, with issued/last-used/revoked timestamps.
- `oauth_refresh_tokens` — hashed refresh tokens with rotation (a reused token revokes the whole grant).
All hashed with SHA-256 like `api_keys`, RLS so customers see only their own grants and staff manage clients, plus explicit grants for `authenticated`/`service_role`.

New edge functions:
- `oauth-authorize` — validates `client_id`, `redirect_uri`, `state`, `code_challenge`; requires a signed-in Supabase session; issues the code on approval.
- `oauth-token` — code-for-token exchange and `refresh_token` grant; authenticates the client with `client_id`/`client_secret`; issues opaque tokens stored hashed.
- `oauth-revoke` — partner-initiated revocation.

API authentication: extend the existing `orders` function (and any other API surface) to accept `Authorization: Bearer <access token>` alongside `X-API-Key`, resolving it through a new `verify_oauth_token` SECURITY DEFINER function that returns the owning `user_id` and updates last-used. All downstream logic keeps using `ctx.userId`, so no business logic changes. Requests are logged to `api_request_logs` as today, with the client recorded.

Frontend: `/oauth/authorize` consent page (unauthenticated users are routed through sign-in and returned), a "Connected apps" card in customer settings, and a staff `/admin/partner-apps` page behind admin-only route permissions.

Rate limiting on the token endpoint and expiry cleanup run on the existing cron pattern.
