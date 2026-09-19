# Fix CodeQL: incomplete multi-character sanitization in htmlToPlainText

## Problem

CodeQL flagged `htmlToPlainText` in `supabase/functions/_shared/emailLayout.ts` (lines 247–271, rule `js/incomplete-multi-character-sanitization`, CWE-80/116).

The replacement chain runs once. Because `.replace(/&lt;/gi, "<")` decodes entities into raw angle brackets *after* tag stripping has already happened, crafted input like `&lt;script&gt;alert(1)&lt;/script&gt;` becomes a live `<script>` tag in the plain-text output. Plain text is not executed by mail clients by itself, but it is injected into downstream contexts (integration logs, announcement previews, any HTML re-rendering of stored text), so it is a genuine injection vector worth fixing.

## Fix

Keep the same replacement chain and ordering, but run it inside a stabilization loop, as CodeQL's Autofix recommends:

```ts
export function htmlToPlainText(html: string): string {
  if (typeof html !== "string") return "";
  let current = html;
  let previous: string;
  let passes = 0;
  do {
    previous = current;
    current = current
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      // ... exact same chain as today, unchanged ...
      .trim();
    passes++;
  } while (current !== previous && passes < 10);
  return current;
}
```

Details:

1. Wrap the existing chain verbatim — no changes to individual replacements or their order — inside the `do...while` loop.
2. Cap at 10 passes so a maliciously crafted input that keeps re-forming patterns (e.g. `&amp;lt;` layers) cannot loop unboundedly. 10 passes is far beyond what legitimate email HTML needs (2 at most).
3. No new dependencies, no behavioral change for legitimate emails: real email HTML stabilizes after 1–2 passes and produces byte-identical output to today.

## Files changed

- `supabase/functions/_shared/emailLayout.ts` — `htmlToPlainText` only.

## Verification

1. Typecheck the functions (`tsgo` on the shared module / existing project check).
2. Quick node sanity test with the exact CodeQL attack strings:
   - `&lt;script&gt;alert(1)&lt;/script&gt;` must not survive into the output.
   - `<scrip<script>removed</script>t>alert(1)</script>` must not yield a residual `<script>`.
   - A real branded email sample must produce identical plain text before and after the change.
3. Redeploy `send-email`, `send-order-updates`, and any function using `htmlToPlainText` (it is re-exported via `integrationLog.ts`, which all email senders import — the per-function deployments pick up the shared module).
4. Confirm no CodeQL reopening by checking the sanitizer is now a fixed-point loop.
