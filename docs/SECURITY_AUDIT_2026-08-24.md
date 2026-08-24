# Security Audit — Cycle Courier Co Platform

**Date:** 24 August 2026
**Standards:** OWASP Top 10 (2021), OWASP ASVS 4.0.3, CWE
**Type:** White-box code and configuration review (no live exploitation)

---

## 1. Executive summary

The platform is in reasonable shape for an application of this size (~200 edge functions, ~90 database tables). Authorisation is built on the correct foundation — roles live in a dedicated `user_roles` table behind a `SECURITY DEFINER` `has_role()` function, RLS is enabled on almost every table, inbound email HTML is scrubbed server-side and again with DOMPurify in the browser, and there are no high or critical known vulnerabilities in third-party npm packages.

The residual risk is concentrated in **unauthenticated edge functions**. Supabase edge functions are internet-reachable by default and this project sets `verify_jwt = false` for 33 functions, delegating authentication to in-function code. Most functions do that correctly, but a handful never check the caller at all. Those are the findings that matter.

| Severity | Count |
|---|---|
| Critical | 1 |
| High | 4 |
| Medium | 6 |
| Low | 4 |
| Informational | 2 |

### Fix these five first

1. **F-01** — Geoapify API key shipped in the browser bundle; the key is public and must be rotated (Critical).
2. **F-02** — `send-announcement-whatsapp` sends WhatsApp messages from the company's verified number with no authentication (High).
3. **F-03** — `trigger-webhook` lets anyone push full order PII to customer webhook endpoints (High).
4. **F-04** — `cs-inbound-email` accepts unauthenticated, unsigned inbound mail into the support inbox (High).
5. **F-05** — billing/QuickBooks functions authorise admins from `profiles.role` instead of `has_role()` (High).

---

## 2. Scope and methodology

**In scope**

- React 18 / Vite / TypeScript frontend (`src/`), including `ProtectedRoute`, the role-route permission matrix, and all client-side use of `import.meta.env`.
- All Supabase edge functions (`supabase/functions/`), with focus on authentication gates, service-role key usage, and untrusted input handling.
- Database: RLS enablement and policy shape, `SECURITY DEFINER` function exposure, grants, public RPC surface.
- Dependency posture (`bun`/npm audit).
- Configuration: `supabase/config.toml` (`verify_jwt`), `.env`, CORS headers.

**Tooling and evidence sources**

- Lovable/Supabase agent security scanner (persisted findings, latest run 23 Aug 2026).
- Supabase database linter, run 24 Aug 2026 — 101 issues across 7 types.
- Dependency scan (npm audit equivalent), run 24 Aug 2026 — no high/critical findings.
- Targeted manual code review with ripgrep across every function named in prior findings, to confirm current state rather than reuse stale scanner output.

**Out of scope / not performed**

- No live exploitation, no authenticated penetration test, no DoS or load testing.
- No assessment of third-party providers' own security (Supabase, QuickBooks, SendZen, Shipday, Resend, Geoapify).
- No review of the Vercel/host layer, TLS configuration, or DNS.
- No secret-scanning of git history.

**Caveat:** findings are derived from code reading. Where exploitability depends on runtime state that could not be confirmed from source, the finding is marked *unconfirmed*.

---

## 3. Findings register

| ID | Title | Severity | OWASP Top 10 | ASVS | CWE | Status |
|---|---|---|---|---|---|---|
| F-01 | Geoapify API key exposed in client bundle | Critical | A02 / A05 | V14.2, V6.4 | CWE-798, CWE-200 | Open |
| F-02 | `send-announcement-whatsapp` unauthenticated | High | A01 / A07 | V4.1, V13.1 | CWE-306 | Open |
| F-03 | `trigger-webhook` unauthenticated, leaks order PII | High | A01 | V4.1, V13.1 | CWE-306, CWE-359 | Open |
| F-04 | `cs-inbound-email` accepts unsigned inbound mail | High | A01 / A08 | V13.4, V5.1 | CWE-306, CWE-345 | Open |
| F-05 | Billing functions authorise via `profiles.role` | High | A01 | V4.1.3 | CWE-863, CWE-286 | Open |
| F-06 | `optimise-route` / `route-path` unauthenticated proxies | Medium | A01 / A04 | V13.1, V11.1 | CWE-306, CWE-770 | Open |
| F-07 | `list-sendzen-templates` unauthenticated | Medium | A01 | V13.1 | CWE-306 | Open |
| F-08 | PostgREST `.or()` filter built from attacker-controlled email | Medium | A03 | V5.3.4 | CWE-943, CWE-74 | Open |
| F-09 | RLS policies defined but RLS disabled on 2 tables | Medium | A01 | V4.1.3 | CWE-1220 | Open |
| F-10 | 46 `SECURITY DEFINER` functions executable by `anon` | Medium | A01 | V4.1, V4.2 | CWE-269 | Open (partly by design) |
| F-11 | `upload-file` does not validate file type or content | Medium | A04 | V12.1, V12.2 | CWE-434 | Open |
| F-12 | `Access-Control-Allow-Origin: *` on authenticated functions | Low | A05 | V14.5.3 | CWE-942 | Open |
| F-13 | 2 database functions with mutable `search_path` | Low | A05 | V14.1 | CWE-426 | Open |
| F-14 | No rate limiting on public availability / repair-offer RPCs | Low | A04 | V11.1.4, V2.2.1 | CWE-770 | Open (unconfirmed impact) |
| F-15 | Extension installed in `public` schema | Low | A05 | V14.1 | CWE-1188 | Open |
| F-16 | Client-side route matrix is UX only, not a security control | Info | A01 | V1.4, V4.1 | CWE-602 | By design — verify RLS coverage |
| F-17 | `verify_jwt = false` on 33 functions | Info | A05 | V14.1.1 | CWE-1188 | By design — see F-02/03/04 |

Previously reported items that are **now fixed** are recorded in Appendix A.

---

## 4. Finding detail

### F-01 — Geoapify API key exposed in the client bundle (Critical)

- **OWASP:** A02 Cryptographic Failures / A05 Security Misconfiguration · **ASVS:** V14.2.1, V6.4.1 · **CWE-798, CWE-200**

**Affected code**

- `.env:1` — `VITE_GEOAPIFY_API_KEY="06b0…"` (any `VITE_`-prefixed variable is inlined into the browser bundle)
- `src/utils/geocoding.ts:17`
- `src/services/routeOptimizationService.ts:28, 194, 354`
- `src/components/AddressForm.tsx:59`
- `src/components/admin/BusinessAccountsMap.tsx:48`
- `src/components/scheduling/RouteBuilder.tsx:2473`
- `src/components/availability/AltLocationFields.tsx:82`
- `supabase/functions/shopify-webhook/index.ts:79` (reads the `VITE_`-named variable server-side)

**Explanation.** Vite substitutes `import.meta.env.VITE_*` at build time, so the key is a literal string in the published JavaScript. Anyone loading the site — including unauthenticated visitors on the public tracking and availability pages — can extract it and issue geocoding, autocomplete and route-optimisation calls billed to the company account until quota is exhausted or the account is suspended. This is unauthenticated financial abuse and needs no login.

**Evidence.** Key value present verbatim in `.env` and referenced from seven client modules; confirmed by grep on 24 Aug 2026. The value is treated as compromised from the moment of first publish.

**Remediation**

1. Rotate the key in the Geoapify dashboard **first** — code changes do not undo exposure.
2. Store the new key as a Supabase secret named `GEOAPIFY_API_KEY`.
3. Add a thin authenticated edge-function proxy (`geoapify-proxy`) exposing only the operations the UI needs: forward geocode, autocomplete, and route matrix. Gate it with `requireAuth`, or for the public availability page a narrowly-scoped endpoint that only accepts a postcode and returns coordinates.
4. Replace all seven client call sites with `supabase.functions.invoke('geoapify-proxy', …)`.
5. Rename the variable read in `shopify-webhook/index.ts` to `GEOAPIFY_API_KEY` and delete `VITE_GEOAPIFY_API_KEY` from `.env`.
6. Add per-user request throttling in the proxy so an authenticated account cannot burn the quota either.

**Effort:** ~1 day.

---

### F-02 — `send-announcement-whatsapp` callable without authentication (High)

- **OWASP:** A01 Broken Access Control / A07 Identification & Authentication Failures · **ASVS:** V4.1.1, V13.1.1 · **CWE-306**

**Affected code:** `supabase/functions/send-announcement-whatsapp/index.ts` — no `Authorization` inspection anywhere in the handler; the only `Authorization` header in the file (line 110) is the outbound one carrying `SENDZEN_API_KEY`. `verify_jwt = false` applies.

**Explanation.** Any internet caller who knows the function URL can send free-text or templated WhatsApp messages from the company's verified WhatsApp Business number to arbitrary numbers. Impact: phishing that is indistinguishable from legitimate company messaging, quota/billing abuse, and a realistic risk of WhatsApp Business account suspension for spam.

**Evidence.** Grep for `requireOpsAuth|requireAuth|Authorization` in the file returns only the outbound SendZen header. Sibling functions (`send-sendzen-whatsapp:577`, `verify-shipday-orders:10`) already call `requireOpsAuth(req, [...])`, so the pattern exists and simply was not applied here.

**Remediation.** Add, immediately after the OPTIONS preflight branch and before reading the body:

```ts
const auth = await requireOpsAuth(req, ['admin', 'route_planner']);
if (!auth.success) return createAuthErrorResponse(auth.error!, auth.status!);
```

Announcements are an admin capability, so `['admin']` alone is defensible. **Effort:** <1 hour.

---

### F-03 — `trigger-webhook` unauthenticated; pushes full order PII (High)

- **OWASP:** A01 · **ASVS:** V4.1.1, V13.1.1 · **CWE-306, CWE-359**

**Affected code:** `supabase/functions/trigger-webhook/index.ts:13-40` — `Deno.serve` handles OPTIONS, then immediately builds a service-role client and reads `{ order_id, event_type }` from the body with no caller check.

**Explanation.** The function fetches the order with `select('*, profiles!orders_user_id_fkey(id, name, email))` using the service-role key (RLS bypassed) and delivers that payload to every configured webhook endpoint, with retries. An attacker who learns or guesses an order UUID can: flood a customer's webhook receiver with fabricated events (amplified by the retry loop), cause duplicate downstream order processing, and — if they control any webhook configuration — receive full sender/receiver PII for arbitrary orders.

**Evidence.** First 40 lines of the file contain no auth branch; `SUPABASE_SERVICE_ROLE_KEY` is used at line 20.

**Remediation.** This function is only ever invoked internally (database trigger `trigger_order_webhook()` and server-side flows), so gate it on the service-role bearer token:

```ts
const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
if (token !== Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
```

Use a constant-time comparison to avoid a timing side channel, and confirm the DB trigger passes the service-role key. **Effort:** ~2 hours including trigger verification.

---

### F-04 — `cs-inbound-email` accepts unsigned, unauthenticated mail (High)

- **OWASP:** A01 / A08 Software & Data Integrity Failures · **ASVS:** V13.4.1, V5.1.3 · **CWE-306, CWE-345**

**Affected code:** `supabase/functions/cs-inbound-email/index.ts` — no bearer token, no HMAC signature, no shared secret; service-role client created at line 43. Compare `cs-inbound-whatsapp`, which supports a `SENDZEN_INBOUND_SECRET`.

**Explanation.** Anyone can POST a forged inbound email payload: spoof a real customer's address to inject messages into an existing conversation thread, flood the support inbox, or drive incorrect order auto-linking (see F-08). Stored-XSS risk from the HTML body is already mitigated (`_shared/sanitizeHtml.ts` at ingest plus DOMPurify at render), so the residual impact is integrity and trust of the support channel, not code execution.

**Remediation.** Verify the provider's webhook signature over the raw body (Resend/Mailgun style HMAC-SHA256) with a secret stored as `RESEND_INBOUND_SECRET`, rejecting on mismatch, and include a timestamp/replay window check. If the provider offers no signature, fall back to a long random path token plus provider IP allowlisting. **Effort:** ~half a day.

---

### F-05 — Billing and OAuth functions authorise admins from `profiles.role` (High)

- **OWASP:** A01 · **ASVS:** V4.1.3 · **CWE-863, CWE-286**

**Affected code**

- `supabase/functions/create-inspection-invoice/index.ts:106-107`
- `supabase/functions/create-inspection-service-invoice/index.ts:105-106`
- `supabase/functions/create-box-my-bike-invoice/index.ts:108-109`
- `supabase/functions/create-quickbooks-invoice/index.ts:382-383`
- `supabase/functions/quickbooks-oauth-init/index.ts:36-37`
- `supabase/functions/create-webhook-config/index.ts:46-47`

**Explanation.** Each reads `profiles.role` and compares to `'admin'`. The project's authoritative source is `user_roles` via `has_role()`; `profiles.role` is a denormalised mirror maintained by `manage-user-roles` (`pickPrimary` → `profiles.update({ role })`) but also writable through the profile-update path. Any divergence — a direct profile update, a partially-failed role change, a future code path — grants or denies QuickBooks invoice creation, bill creation and OAuth connection incorrectly. This is a broken authorisation *design*, not yet a demonstrated bypass, hence High rather than Critical.

**Evidence.** Grep confirms `.from('profiles').select('role')` in all six files; `manage-user-roles/index.ts:36-37` shows the correct `has_role` RPC pattern used elsewhere.

**Remediation.** Replace each check with the RPC against a service-role client:

```ts
const { data: isAdmin } = await supabaseAdmin.rpc('has_role', { _user_id: user.id, _role: 'admin' });
if (!isAdmin) return new Response(JSON.stringify({ error: 'Admin required' }), { status: 403, headers: … });
```

Longer term, treat `profiles.role` as display-only and add a code comment saying so, or drop the column. **Effort:** ~2 hours.

---

### F-06 — `optimise-route` and `route-path` are unauthenticated Google Maps proxies (Medium)

- **OWASP:** A01 / A04 Insecure Design · **ASVS:** V13.1.1, V11.1.4 · **CWE-306, CWE-770**

**Affected code:** `supabase/functions/optimise-route/index.ts` (outbound `LOVABLE_API_KEY` at line 55), `supabase/functions/route-path/index.ts` (line 46). Neither inspects the incoming `Authorization` header.

**Explanation.** Both forward arbitrary origin/destination sets to Google Maps via the Lovable connector using server-side credentials. Unauthenticated callers get free distance-matrix and directions computation at the company's expense; sustained abuse exhausts quota and degrades the scheduling tools staff depend on. No customer data is exposed.

**Remediation.** `requireOpsAuth(req, ['admin', 'route_planner'])` at the top of each handler — these are only called from the scheduling and AI-routing screens. Add a simple per-user call ceiling if quota cost is a concern. **Effort:** ~1 hour.

---

### F-07 — `list-sendzen-templates` unauthenticated (Medium)

- **OWASP:** A01 · **ASVS:** V13.1.1 · **CWE-306**

**Affected code:** `supabase/functions/list-sendzen-templates/index.ts` — no auth check; proxies to SendZen with `SENDZEN_API_KEY` (line 33).

**Explanation.** Unlimited unauthenticated calls against a paid third-party API, and disclosure of the exact wording and parameter structure of the company's approved WhatsApp templates — useful raw material for convincing phishing.

**Remediation.** `requireAuth(req)` (staff-only is better: `requireOpsAuth(req, ['admin','route_planner','cs_agent'])`). **Effort:** <1 hour.

---

### F-08 — PostgREST filter built from attacker-controlled email address (Medium)

- **OWASP:** A03 Injection · **ASVS:** V5.3.4 · **CWE-943, CWE-74**

**Affected code:** `supabase/functions/_shared/cs-order-linker.ts:50-54`

```ts
const handle = opts.handle.toLowerCase();
… .or(`sender->>email.ilike.${handle},receiver->>email.ilike.${handle}`)
```

`opts.handle` comes from the `From` header parsed in `cs-inbound-email` — attacker-controlled and unauthenticated (F-04). The phone branch at line 66 interpolates a digits-only value and is safe.

**Explanation.** PostgREST `.or()` takes a filter DSL string. Commas, parentheses, `%` and field references in the interpolated value change the query's logic, letting an attacker force a conversation to auto-link to an arbitrary order — misdirecting support staff, or hiding attacker messages inside a genuine customer's order thread. This is filter injection, not SQL injection: no arbitrary SQL, no direct data exfiltration, hence Medium.

**Remediation.** Validate `handle` against a strict email pattern and reject otherwise; then replace the string-built `.or()` with two parameterised `.eq()`/`.ilike()` queries combined in `Promise.all`, or escape `, ( ) % .` before interpolation. Apply the same validation defensively on the WhatsApp path. **Effort:** ~2 hours.

---

### F-09 — RLS policies exist but RLS is not enabled (Medium)

- **OWASP:** A01 · **ASVS:** V4.1.3 · **CWE-1220**

**Affected objects:** `public.labour_times` and `public.labour_time_multipliers` — both show policies defined with RLS **off** (linter: *Policy Exists RLS Disabled* ×2, *RLS Disabled in Public* ×2, both ERROR level, run 24 Aug 2026).

**Explanation.** With RLS disabled, the defined policies are inert and every granted role can read and write every row through the Data API. These tables hold workshop labour times and pricing multipliers — commercially sensitive rather than personal data, and the intent was clearly to restrict them, so this is a misconfiguration rather than a deliberate public table. A third table has RLS enabled with **no** policies (INFO), which fails closed and is safe but should be reviewed for intent.

**Remediation.** `ALTER TABLE public.labour_times ENABLE ROW LEVEL SECURITY;` and the same for `labour_time_multipliers`, then confirm the existing policies plus grants still allow the mechanic/admin flows. Identify the RLS-enabled-no-policy table and either add policies or confirm it is service-role-only by design. **Effort:** ~2 hours including regression check of the labour-times admin page.

---

### F-10 — 46 `SECURITY DEFINER` functions executable by `anon` (Medium)

- **OWASP:** A01 · **ASVS:** V4.1.1, V4.2.1 · **CWE-269**

**Evidence:** linter, 24 Aug 2026 — 46 functions callable without signing in, 47 callable by any signed-in user.

**Explanation.** `SECURITY DEFINER` functions run with the owner's privileges and bypass RLS, so `EXECUTE` granted to `anon` is effectively a public API. Some are intentional and already have their own guards — `get_public_order`, `get_public_order_with_proof` (postcode-gated), `get_public_inspection_summary`, `get_public_repair_offer`, `submit_public_repair_offer`, `set_order_availability`. Others almost certainly should not be public: `admin_generate_api_key`, `admin_generate_webhook_secret`, `admin_revoke_api_key`, `admin_revoke_webhook`, `admin_update_account_status`, `get_business_accounts_for_admin`, `get_cron_secret`, `get_vault_secret`, `list_internal_users`, `update_user_profile_for_management`, and the `invoke_*` cron wrappers.

*Unconfirmed:* the linter reports executability, not whether each function has an internal `is_admin()`/`auth.uid()` guard. Several are known to guard internally, so the effective exposure is smaller than 46. This needs a per-function pass before severity is finalised — if any of `get_vault_secret`, `get_cron_secret`, `admin_generate_api_key` or `admin_update_account_status` lacks an internal guard, that single function is **Critical**.

**Remediation.** Enumerate the 46, and for each: keep public only if it is deliberately part of the public surface and internally guarded; otherwise `REVOKE EXECUTE ON FUNCTION … FROM anon, authenticated;` and grant narrowly. Prioritise the secret-returning and admin-mutating functions. **Effort:** ~1 day.

---

### F-11 — `upload-file` does not validate file type or content (Medium)

- **OWASP:** A04 · **ASVS:** V12.1.1, V12.2.1 · **CWE-434**

**Affected code:** `supabase/functions/upload-file/index.ts:42-83, 110-166`

**Explanation.** Authorisation is correct (bucket allow-list, path traversal check, 20 MB cap, staff role or order ownership). But `contentType` is taken from the client (`file.type`, or a JSON field) and passed straight to `storage.upload` with no allow-list and no magic-byte check. A staff member or order owner can therefore store arbitrary content — including HTML/SVG — labelled as an image in a bucket whose objects are served from `api.cyclecourierco.com`. If any of these buckets is public, an HTML or SVG object served from a company domain enables stored XSS in that origin.

*Unconfirmed:* whether `foam-my-bike-labels`, `foam-delivery-photos` and `box-my-bike-labels` are public buckets; delivery photos are known to be served via signed URLs, which limits this.

**Remediation.** Allow-list content types per bucket (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`), verify the magic bytes of the decoded buffer rather than trusting the header, reject SVG, and set `Content-Disposition: attachment` plus a restrictive `Content-Security-Policy` on served objects. **Effort:** ~3 hours.

---

### F-12 — `Access-Control-Allow-Origin: *` on authenticated functions (Low)

- **OWASP:** A05 · **ASVS:** V14.5.3 · **CWE-942**

**Affected code:** `supabase/functions/_shared/cors.ts:4` and the inline copies in most functions.

**Explanation.** A wildcard origin is acceptable for genuinely public endpoints and is *not* by itself an account-takeover path here, because Supabase auth uses bearer tokens from `localStorage` rather than cookies — the browser will not attach credentials automatically. It does, however, let any site script the full authenticated API surface if it can obtain a token, and it removes a cheap defence-in-depth layer.

**Remediation.** For staff/admin functions, echo back an allow-list of known origins (`booking.cyclecourierco.com`, the Lovable preview domain, `localhost:8080`) instead of `*`. Keep `*` only on the public tracking/availability/webhook endpoints. **Effort:** ~3 hours.

---

### F-13 — Two database functions with mutable `search_path` (Low)

- **OWASP:** A05 · **ASVS:** V14.1.1 · **CWE-426**

**Evidence:** linter, 24 Aug 2026 — *Function Search Path Mutable* ×2 (WARN).

**Explanation.** A `SECURITY DEFINER` function without a pinned `search_path` can be induced to resolve an unqualified object name against a schema the caller controls, leading to privilege escalation. Most functions in this project already set `search_path = public`; two do not.

**Remediation.** Add `SET search_path = public` (or `= ''` with fully-qualified names) to both, identified from the linter detail. **Effort:** ~30 minutes.

---

### F-14 — No rate limiting on public RPCs (Low, impact unconfirmed)

- **OWASP:** A04 · **ASVS:** V11.1.4, V2.2.1 · **CWE-770**

**Explanation.** Public entry points — `get_public_order`, `get_public_order_with_proof`, `get_public_inspection_summary`, `get_public_repair_offer`, `submit_public_repair_offer`, `set_order_availability` — are reachable by `anon`. The tracking proof path has a dedicated `tracking_postcode_attempts` table, which indicates postcode-guessing throttling exists for that flow; the other RPCs have no comparable counter. Order identifiers are UUIDs, so enumeration is impractical; the realistic risk is unlimited postcode brute force on a *known* order, and resource consumption.

*Unconfirmed:* whether `tracking_postcode_attempts` is enforced on every proof path or only one.

**Remediation.** Reuse the attempts-table pattern for `get_public_repair_offer` / `submit_public_repair_offer`, cap attempts per order per hour, and add a Supabase or edge-level rate limit on the public availability endpoints. **Effort:** ~half a day.

---

### F-15 — Extension installed in the `public` schema (Low)

- **OWASP:** A05 · **ASVS:** V14.1 · **CWE-1188**

**Evidence:** linter, 24 Aug 2026 — *Extension in Public* ×1. Almost certainly `citext`, given the `citext_*` functions present in the public schema.

**Explanation.** Extensions in `public` add their functions to the default search path and to the PostgREST-exposed surface, increasing attack surface and complicating `search_path` hardening. Low risk in itself.

**Remediation.** Move to a dedicated `extensions` schema (`ALTER EXTENSION citext SET SCHEMA extensions;`) and update references. Note this is a breaking change for any object using unqualified `citext` — schedule with care, or accept and document. **Effort:** ~2 hours, or accept the risk.

---

### F-16 — Client-side route permissions are UX, not enforcement (Informational)

- **OWASP:** A01 · **ASVS:** V1.4.1, V4.1.1 · **CWE-602**

**Affected code:** `src/components/ProtectedRoute.tsx`, `src/hooks/useRoutePermissions.ts`, `src/config/routes.ts`, table `role_route_permissions`.

**Explanation.** The design is sound: admin short-circuit, B2C lock-out, then a database-backed permission matrix. But all of it runs in the browser and can be bypassed by anyone editing client state or calling the API directly. That is unavoidable in an SPA and acceptable **provided** every table and RPC reached by those pages enforces the same rules server-side in RLS. Note `useRoutePermissions` falls back to registry defaults when the table cannot be read — a fail-open behaviour for navigation, which is fine only because RLS is the real control.

**Recommendation.** Treat as an assurance task rather than a defect: for each role added recently (`fleet_manager`, `tech`, `cs_agent`, `route_planner`) confirm the tables behind their pages (`vehicles`, `api_keys`, `webhook_configurations`, `notice_bars`, `claims`) have matching `has_role()` policies. Document the invariant "ProtectedRoute is navigation only; RLS is authorisation" where the matrix is defined.

---

### F-17 — `verify_jwt = false` on 33 functions (Informational)

- **OWASP:** A05 · **ASVS:** V14.1.1 · **CWE-1188**

**Evidence:** 33 occurrences of `verify_jwt = false` in `supabase/config.toml`.

**Explanation.** This is a deliberate project convention: platform-level JWT verification is off so functions can support mixed auth (user JWT, service-role internal calls, `X-Cron-Secret`, `X-API-Key`). The convention is sound — `create-quickbooks-invoice:354-355` is a good example of tiered auth — but it means **every** function must implement its own gate, and F-02/03/04/06/07 are exactly the cases where that was missed.

**Recommendation.** Add a CI check that fails when a function under `supabase/functions/` contains neither an auth helper import nor an explicit documented `// PUBLIC ENDPOINT:` marker. This converts a discipline problem into a build failure.

---

## 5. Positive controls observed

- **Role storage done correctly.** Roles live in `user_roles` with a `SECURITY DEFINER has_role()` function; no role column is trusted for authorisation in the majority of the codebase, avoiding the classic privilege-escalation pattern.
- **Privilege escalation already closed.** `manage-user-roles` now restricts sales callers to `SALES_ASSIGNABLE = {b2b_customer, b2c_customer}` and returns 403 otherwise (lines 50-56).
- **Public orders API hardened.** The `GET` handler requires `X-API-Key`, validates it via `verify_api_key`, scopes the query with `.eq('user_id', userId)`, and returns an explicit field list instead of `select('*')`.
- **Layered XSS defence.** `_shared/sanitizeHtml.ts` scrubs inbound email HTML at ingest (block tags, `on*` handlers, `srcdoc`/`formaction`, `javascript:`/`data:text/html` URLs, with fixed-point re-scanning) and `MessageThread.tsx` sanitises again with DOMPurify at render.
- **Reusable tiered auth helper.** `_shared/auth.ts` provides `requireAuth`, `requireAdminAuth`, `requireOpsAuth` with CORS-safe error responses, and logs failures without leaking tokens.
- **Storage access control.** `upload-file` mirrors RLS in code (bucket allow-list, path traversal rejection, size cap, staff-or-owner check) and logs only a path prefix rather than customer data. Delivery photos are served through short-lived signed URLs behind a postcode check.
- **File URLs normalised** through `toPublicFileUrl` to `api.cyclecourierco.com`, avoiding direct Supabase host exposure.
- **Dependencies clean.** No high or critical advisories, 24 Aug 2026.
- **RLS broadly enabled** — 88 of 90 public tables, most with four-policy CRUD sets.

---

## 6. ASVS 4.0.3 coverage matrix

| Chapter | Verdict | Justification |
|---|---|---|
| V1 Architecture & Threat Modelling | Partial | Clear layering and a documented role model, but no threat model artefact; the "RLS is the control, not the router" invariant is undocumented (F-16). |
| V2 Authentication | Pass | Supabase Auth handles credentials, hashing and recovery; registration hardening (rate limits, complexity, domain checks) already in place. |
| V3 Session Management | Pass | Supabase JWT with refresh rotation; no custom session code; sign-out clears client state. |
| V4 Access Control | **Fail** | Unauthenticated privileged endpoints (F-02, F-03, F-06, F-07), wrong authorisation source in billing (F-05), inert RLS on two tables (F-09), broad `SECURITY DEFINER` exposure (F-10). |
| V5 Validation, Sanitisation & Encoding | Partial | Strong HTML sanitisation and Zod form validation, but filter injection in the CS linker (F-08) and unvalidated inbound email addresses. |
| V7 Error Handling & Logging | Pass | Logging conventions forbid PII and stack traces; Sentry captures exceptions; `upload-file` logs only prefixes. |
| V8 Data Protection | Partial | PII scoped per-customer by RLS, but F-03 can push full order PII to third-party endpoints. |
| V9 Communications | Pass | HTTPS throughout; all third-party calls server-side over TLS. |
| V10 Malicious Code | Pass | No `eval`, no dynamic remote script loading; no high/critical dependency advisories. |
| V11 Business Logic | Partial | Ownership and status checks are consistent, but public endpoints lack anti-automation controls (F-14). |
| V12 Files & Resources | **Fail** | No content-type allow-list or magic-byte validation on upload (F-11). |
| V13 API & Web Service | **Fail** | Several edge functions expose privileged operations with no authentication (F-02, F-03, F-04, F-06, F-07). |
| V14 Configuration | Partial | Secrets are generally server-side, but a live third-party key ships in the browser bundle (F-01), CORS is wildcard (F-12), and `verify_jwt = false` is broad (F-17). |

---

## 7. Remediation roadmap

**Immediate — this week**

1. Rotate the Geoapify key (F-01) — do this before any code work.
2. Add `requireOpsAuth` to `send-announcement-whatsapp`, `optimise-route`, `route-path`, `list-sendzen-templates` (F-02, F-06, F-07) — roughly an hour of work in total.
3. Gate `trigger-webhook` on the service-role token (F-03).
4. Switch the six billing/OAuth admin checks to `has_role()` (F-05).
5. Enable RLS on `labour_times` and `labour_time_multipliers` (F-09).
6. Pin `search_path` on the two flagged functions (F-13).

**Short term — 2 to 4 weeks**

7. Build the authenticated Geoapify proxy and remove all `VITE_GEOAPIFY_API_KEY` references (F-01).
8. Verify the inbound email webhook signature (F-04) and validate/parameterise the linker filter (F-08).
9. Audit and revoke `EXECUTE` on the `SECURITY DEFINER` functions that should not be public, starting with the secret-returning and admin-mutating ones (F-10).
10. Add content-type and magic-byte validation to `upload-file` (F-11).

**Hardening backlog**

11. Origin allow-list instead of wildcard CORS on staff functions (F-12).
12. Rate limiting on public availability and repair-offer RPCs (F-14).
13. CI guard requiring every edge function to declare an auth gate or an explicit public marker (F-17).
14. Confirm RLS coverage for the newly added roles and document the ProtectedRoute/RLS invariant (F-16).
15. Move `citext` out of `public`, or formally accept the risk (F-15).

---

## Appendix A — Previously reported, now remediated

Verified fixed by code review on 24 August 2026:

| Previous finding | Evidence of fix |
|---|---|
| Orders `GET` returned full PII with no auth | `orders/index.ts:652-690` — `X-API-Key` required, `verify_api_key` RPC, `.eq('user_id', userId)`, explicit field list. |
| Sales users could grant themselves `admin` | `manage-user-roles/index.ts:50-56` — `SALES_ASSIGNABLE` allow-list with 403 on violation. |
| `verify-shipday-orders` unauthenticated | Line 10 — `requireOpsAuth(req, ['admin','route_planner'])`. |
| `send-sendzen-whatsapp` unauthenticated | Line 577 — `requireOpsAuth(req, ['admin','route_planner','loader'])`. |
| `send-timeslot-whatsapp` unauthenticated | Function deleted; functionality consolidated into the gated SendZen sender. |
| Delivery photos readable without ownership check | `get-foam-photo-urls` verifies receiver postcode and issues 30-minute signed URLs. |
| Stored XSS via inbound email HTML | `_shared/sanitizeHtml.ts` at ingest plus DOMPurify at render. |
| Storage links exposing the Supabase host | `toPublicFileUrl` helpers rewrite all storage URLs to `api.cyclecourierco.com`. |

## Appendix B — Evidence log

| Source | Date | Result |
|---|---|---|
| Supabase database linter | 24 Aug 2026 | 101 issues / 7 types: 2 policy-exists-RLS-disabled (ERROR), 2 RLS-disabled-in-public (ERROR), 1 RLS-enabled-no-policy (INFO), 2 mutable search_path (WARN), 1 extension in public (WARN), 46 anon-executable SECURITY DEFINER (WARN), 47 authenticated-executable SECURITY DEFINER (WARN). |
| Dependency scan | 24 Aug 2026 | No high or critical severity vulnerabilities. |
| Agent security scanner (persisted) | 23 Aug 2026 | 10 findings; 3 confirmed remediated since, remainder carried into this report. |
| Manual grep audit of named functions | 24 Aug 2026 | Confirmed current auth state of 17 edge functions and 7 client Geoapify call sites. |

*No secret values are reproduced in this report beyond the already-public Geoapify key referenced in F-01, which must be rotated regardless.*
