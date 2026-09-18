# Cycle Courier — Partner Integration Guide

"Connect with Cycle Courier" lets your product act on a Cycle Courier customer's
account after the customer approves it once. It is a standard OAuth 2.1
authorization-code flow with PKCE.

- Approval (customer-facing): `https://booking.cyclecourierco.com/oauth/authorize`
- API and token endpoints: `https://api.cyclecourierco.com/functions/v1`

---

## 1. Getting started

Cycle Courier registers your app and gives you:

| Item | Notes |
|------|-------|
| `client_id` (App ID) | Safe to include in URLs |
| `client_secret` (App secret) | Shown **once** at registration. Server-side only |

You give Cycle Courier:

- Your exact return web address(es) (`redirect_uri`). HTTPS only, except
  `http://localhost...` which is allowed for development.
- A technical contact email.

Redirect addresses are matched **exactly** — including path, trailing slash and
query string. Register every environment you need (production, staging, local).

---

## 2. The connect flow

```text
Your app ──▶ /oauth/authorize (customer signs in + approves)
        ◀── redirect back with ?code=...&state=...
Your server ──▶ POST /oauth-token (code + code_verifier + secret)
            ◀── access_token (1h) + refresh_token (180d)
Your server ──▶ Cycle Courier API with Authorization: Bearer <access_token>
```

### Step 1 — generate PKCE values and send the customer to the approval page

```js
import crypto from "node:crypto";

const b64url = (buf) => buf.toString("base64url");
const codeVerifier = b64url(crypto.randomBytes(32));            // store in session
const codeChallenge = b64url(crypto.createHash("sha256").update(codeVerifier).digest());
const state = b64url(crypto.randomBytes(16));                    // store in session

const url = new URL("https://booking.cyclecourierco.com/oauth/authorize");
url.search = new URLSearchParams({
  response_type: "code",
  client_id: APP_ID,
  redirect_uri: "https://your-app.example.com/callback",
  state,
  code_challenge: codeChallenge,
  code_challenge_method: "S256",
}).toString();
// redirect the customer to url.toString()
```

| Parameter | Required | Notes |
|-----------|----------|-------|
| `response_type` | yes | Always `code` |
| `client_id` | yes | Your App ID |
| `redirect_uri` | yes | Must exactly match a registered address |
| `state` | yes (strongly advised) | Opaque value returned to you; verify it |
| `code_challenge` | yes | base64url SHA-256 of your verifier, 32–200 chars |
| `code_challenge_method` | yes | `S256` |

If the customer is not signed in, they sign in first and are returned to the
approval screen automatically. The screen shows your app name and logo and the
account they are connecting.

### Step 2 — handle the redirect back

```text
https://your-app.example.com/callback?code=ccode_xxx&state=THE_STATE_YOU_SENT
```

Verify `state` matches the value you stored. If the customer cancels you receive
`?error=access_denied&state=...`. Authorization codes are **single-use** and
expire after **60 seconds**.

### Step 3 — exchange the code for tokens

```http
POST https://api.cyclecourierco.com/functions/v1/oauth-token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=ccode_xxx
&redirect_uri=https://your-app.example.com/callback
&code_verifier=THE_VERIFIER
&client_id=APP_ID
&client_secret=APP_SECRET
```

`client_id`/`client_secret` may also be sent as HTTP Basic auth. JSON bodies are
accepted as well as form encoding.

Response:

```json
{
  "access_token": "ccat_...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "ccrt_...",
  "scope": "api"
}
```

---

## 3. Tokens

- **Access token** — 1 hour. Send as `Authorization: Bearer <access_token>`.
- **Refresh token** — 180 days, and **rotates on every use**: each refresh
  returns a new refresh token, and the old one is dead. Store the new one
  immediately, and never refresh the same token twice in parallel.
- Reusing an already-rotated refresh token is treated as a compromise: the whole
  connection is revoked and the customer must reconnect.
- Store tokens encrypted, per customer, server-side only.

```http
POST /functions/v1/oauth-token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token&refresh_token=ccrt_...&client_id=APP_ID&client_secret=APP_SECRET
```

If a refresh returns `invalid_grant`, the connection is gone (revoked by the
customer, app disabled, refresh token expired or reused). Stop retrying, mark the
customer as disconnected, and prompt them to connect again.

---

## 4. Calling the API on the customer's behalf

Use the same endpoints as documented for API keys — only the auth header differs:

```bash
curl -X POST https://api.cyclecourierco.com/functions/v1/orders \
  -H "Authorization: Bearer ccat_..." \
  -H "Content-Type: application/json" \
  -d '{ "sender": { ... }, "receiver": { ... }, "bikes": [ ... ] }'
```

An access token grants exactly the same access as that customer's own API key
(create orders, read orders, tracking). Orders you create appear in the
customer's own dashboard. Rate limiting is 100 requests per minute.

---

## 5. Disconnecting

Partner-initiated (RFC 7009 style):

```http
POST /functions/v1/oauth-revoke
Content-Type: application/x-www-form-urlencoded

token=ccat_or_ccrt_...&client_id=APP_ID&client_secret=APP_SECRET
```

Revoking a refresh token ends the whole connection; revoking an access token
ends just that token. Unknown or already-revoked tokens return success.

Customers can disconnect your app at any time from **Your Profile → Connected
apps**, and Cycle Courier can disable an app entirely. Both take effect
immediately, so always handle `401` gracefully.

---

## 6. Errors

### Approval endpoint

| Error | Meaning / fix |
|-------|---------------|
| `unauthorized_client` | Unknown App ID, or the app has been disabled |
| `invalid_redirect_uri` | Return address not registered, or not an exact match |
| `invalid_request` | Missing `client_id`/`redirect_uri`/`code_challenge`, or challenge not 32–200 chars |
| `login_required` (401) | No signed-in customer session |
| `access_denied` | Customer pressed Cancel |

### Token endpoint

| Error | HTTP | Meaning / fix |
|-------|------|---------------|
| `invalid_client` | 401 | Wrong App ID or secret, or app disabled |
| `invalid_request` | 400 | Missing `code`, `code_verifier` or `redirect_uri`, or unparseable body |
| `invalid_grant` | 400 | Code expired (60s), already used, wrong `redirect_uri`, failed PKCE check, or refresh token expired/revoked/reused |
| `unsupported_grant_type` | 400 | Only `authorization_code` and `refresh_token` are supported |
| `slow_down` | 429 | Too many token requests — back off and retry |
| `server_error` | 500 | Transient; retry with backoff |

### API requests

| Code | HTTP | Meaning |
|------|------|---------|
| `MISSING_API_KEY` | 401 | No `Authorization` or `X-API-Key` header |
| `INVALID_TOKEN` | 401 | Access token expired or revoked — refresh, then reconnect if that fails |

---

## 7. Checklist before going live

- [ ] App secret stored server-side only, never in a browser or mobile app
- [ ] `state` generated per attempt and verified on return
- [ ] `code_verifier` kept in the user's session, never in the URL
- [ ] Rotated refresh token persisted on every refresh
- [ ] One connection stored per Cycle Courier customer
- [ ] `401` / `invalid_grant` triggers a "reconnect" prompt, not a retry loop
- [ ] Production and staging return addresses both registered
- [ ] Tested a full connect, order create, refresh and disconnect

---

## 8. Worked example (Node.js)

```js
// after the callback: exchange, then create an order
const body = new URLSearchParams({
  grant_type: "authorization_code",
  code, redirect_uri: REDIRECT_URI, code_verifier: codeVerifier,
  client_id: APP_ID, client_secret: APP_SECRET,
});
const tokens = await fetch("https://api.cyclecourierco.com/functions/v1/oauth-token",
  { method: "POST", body }).then(r => r.json());

await saveTokens(customerId, tokens);           // store refresh_token securely

const order = await fetch("https://api.cyclecourierco.com/functions/v1/orders", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${tokens.access_token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ sender, receiver, bikes }),
}).then(r => r.json());

// later, when the access token has expired
const refreshed = await fetch("https://api.cyclecourierco.com/functions/v1/oauth-token", {
  method: "POST",
  body: new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: stored.refresh_token,
    client_id: APP_ID, client_secret: APP_SECRET,
  }),
}).then(r => r.json());
await saveTokens(customerId, refreshed);        // refresh_token has changed
```

---

## Support

Questions, new return addresses, or a new App secret: contact Cycle Courier at
Info@cyclecourierco.com with your App ID (never your secret).
