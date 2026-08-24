# Harden inline event-handler regexes in sanitizeHtml.ts

## Current state (verified)

- `supabase/functions/_shared/sanitizeHtml.ts` already applies `replaceUntilStable` to all multi-character regex replacements, including the inline event-handler block (lines 37–42).
- CodeQL still flags the event-handler block as `js/incomplete-multi-character-sanitization` because the regexes match multi-character unsafe constructs and can leave behind dangerous fragments (e.g. a surviving `on` prefix or re-formed attribute) even after repeated passes.

## What to change

1. **Rewrite the inline event-handler regexes** in the "Strip inline event handlers" block so they:
   - Anchor on a true HTML attribute boundary (`(?:^|[\s"'])` or whitespace) rather than just `\s`.
   - Match valid event attribute names with `on[a-z0-9_-]+`.
   - Consume and remove the full assignment value for double-quoted, single-quoted, and unquoted forms.

2. **Add tag-aware neutralization for unquoted handlers** as a second layer:
   - Inside start tags, rewrite any `on...=` attribute name to a safe, non-executable prefix (e.g. `data-removed-on...=`).
   - This prevents executable event attributes from surviving even if the value-removal regex misses a corner case.

3. **Keep `replaceUntilStable` in place** for the block as a whole so any residual overlap is still iterated to a fixed point.

4. **Verify and deploy**:
   - Run Deno type-check on the function.
   - Redeploy affected edge functions (`cs-inbound-email` and any other function importing `sanitizeInboundHtml`).
   - Re-run the CodeQL scan or check the alert status after merge.

## Technical notes

- File to edit: `supabase/functions/_shared/sanitizeHtml.ts` only.
- No new imports or dependencies are required.
- No schema or database changes are required.
- The change preserves the existing defense-in-depth model alongside client-side DOMPurify.
