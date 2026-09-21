# Fix CodeQL: incomplete multi-character sanitization in cs-quoted-reply.ts

## Problem

GitHub Advanced Security flags `stripQuotedHtml` in `supabase/functions/_shared/cs-quoted-reply.ts` (rule `js/incomplete-multi-character-sanitization`, High):

```ts
const textual = out.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
```

The single-pass tag strip can leave behind re-formed markup (e.g. a surviving `<script` after removing an inner tag). `out` is stored on the message and later rendered, so a surviving tag construct is a genuine injection concern — and it trips CodeQL regardless of the downstream sanitize + DOMPurify layers.

This line's only job is an emptiness check: if stripping all markup would leave nothing, keep the original HTML so the message is never lost.

## Fix

Reuse the established `replaceUntilStable` pattern already used in `sanitizeHtml.ts` (same repo convention, and the same pattern CodeQL accepted for earlier findings):

1. Add a local `stripTagsUntilStable(html)` helper in `cs-quoted-reply.ts`: a loop that applies the same `/<[^>]*>/g` tag-strip repeatedly until the string stops changing (bounded, e.g. max 10 passes, so crafted input cannot loop unboundedly).
2. Replace the single-pass strip with the helper:
   ```ts
   let textual = stripTagsUntilStable(out).replace(/&nbsp;/g, " ").trim();
   return textual.length ? out : html;
   ```
3. No behavioural change for legitimate emails: real quoted replies stabilize after 1–2 passes and produce identical output; the fallback guard keeps the same semantics.
4. No changes to `stripQuotedText`, the container patterns, or any other file.

## Files changed

- `supabase/functions/_shared/cs-quoted-reply.ts` — `stripQuotedHtml` tag-strip only.

## Deployment

Redeploy the three functions that bundle this shared module (via `cs-inbound.ts`):

- `cs-inbound-email`
- `cs-resend-inbound`
- `cs-resend-fetch`

## Verification

1. Quick Deno/node sanity test with adversarial inputs:
   - `<scri<SCRIPT>removed</SCRIPT>pt>alert(1)</script>` must not leave a residual `<script`.
   - `&lt;script&gt;` handling unchanged; empty-after-strip input still falls back to the original HTML.
   - A normal quoted reply still trims to the same text as today.
2. Confirm the functions deploy successfully.
3. Confirm the CodeQL alert auto-closes on the next scan after merge.
