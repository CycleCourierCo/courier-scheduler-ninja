# Security audit report: OWASP Top 10 / ASVS / CWE

## Goal

Produce a written security report for this application, mapped to OWASP Top 10 (2021), OWASP ASVS 4.0 requirements and CWE IDs, with severity, affected code, explanation, remediation and evidence for each finding. Deliverable is a document only — no application code changes in this pass.

## Deliverable

`docs/SECURITY_AUDIT_2026-08-24.md` containing:

1. Executive summary — risk posture, counts by severity, top five things to fix first.
2. Scope and methodology — what was reviewed (React/Vite frontend, ~200 Supabase edge functions, RLS policies, DB functions, dependencies), tools used (Supabase security scanner, Supabase linter, npm/bun dependency audit, targeted code review), and what was not tested (no live exploitation, no DoS testing, no penetration test of third parties).
3. Findings table — ID, title, severity (Critical/High/Medium/Low/Info), OWASP Top 10 category, ASVS reference, CWE, status.
4. Per-finding detail, each with: severity and CVSS-style rationale, affected files and line references, explanation of the attack path, evidence (code excerpt, scanner output or query result), remediation with concrete code direction, and effort estimate.
5. Positive controls — what is already done right (roles in a separate `user_roles` table with `has_role()`, DOMPurify plus server-side scrubbing of inbound email HTML, tiered edge-function auth helper, signed URLs for delivery photos, storage links forced through `api.cyclecourierco.com`, no high/critical dependency CVEs).
6. ASVS coverage matrix — per ASVS chapter (V1 architecture, V2 auth, V3 session, V4 access control, V5 validation/encoding, V7 logging, V9 comms, V12 files, V13 APIs, V14 config), pass / partial / fail with a one-line justification.
7. Prioritised remediation roadmap — immediate (days), short term (weeks), hardening backlog.

## Verification before anything is asserted

Several scanner findings pre-date recent hardening work, so each one is re-checked against the current code before it enters the report; anything already fixed moves to a "previously reported, now remediated" appendix with the fix cited. Verification covers:

- Auth gates in the WhatsApp/Shipday senders, `optimise-route`, `route-path`, `verify-shipday-orders`, `trigger-webhook`, `list-sendzen-templates`, `cs-inbound-email`.
- Whether the `orders` GET handler still returns full PII unauthenticated.
- Whether `manage-user-roles` still lets a `sales` caller grant `admin`.
- Whether billing/webhook functions still authorise via `profiles.role` instead of `has_role()`.
- Whether `VITE_GEOAPIFY_API_KEY` is still read in client code.
- The PostgREST `.or()` filter built from an inbound email address in `_shared/cs-order-linker.ts`.
- Fresh run of the Supabase security scanner and linter for RLS, grants and SECURITY DEFINER exposure, plus the dependency audit, so the evidence in the report is dated today.
- Spot checks not covered by scanners: secrets handling in logs, CORS `*` on authenticated functions, rate limiting on public endpoints, redirect/tenancy checks on the public availability, tracking and repair-offer routes, file-upload validation in `upload-file`, and client-side-only access control in `ProtectedRoute` versus RLS backing.

Any finding whose exploitability cannot be confirmed from code alone is labelled "unconfirmed — needs runtime verification" rather than asserted.

## Notes

- Report is written for a mixed audience: executive summary in plain English, technical detail in the per-finding sections.
- No secret values are reproduced in the report; keys are referenced by name only, with a note that the exposed Geoapify key must be rotated regardless of code changes.
- If you want the fixes applied as well, that is a separate follow-up pass once you have picked which findings to action.
