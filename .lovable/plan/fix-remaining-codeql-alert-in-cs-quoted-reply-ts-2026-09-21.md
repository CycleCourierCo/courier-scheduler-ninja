# Fix remaining CodeQL alert in cs-quoted-reply.ts

GitHub Advanced Security (CodeQL "Incomplete multi-character sanitization") still flags
`stripTagsUntilStable()` even with the 10-pass loop — the tag regex `/<[^>]*>/g` is the
pattern it distrusts.

## Change

In `supabase/functions/_shared/cs-quoted-reply.ts`:

- Replace the loop body of `stripTagsUntilStable()` with the scanner's suggested fix:
  remove angle brackets entirely with `input.replace(/[<>]/g, "")`.
- Rename the function/comment accordingly (e.g. `stripAngleBrackets`) since it no longer
  loops. Single one-line change, used only by the emptiness check in `stripQuotedHtml`.

## Why this is safe

This function only decides whether the trimmed HTML still contains real text; its output is
never rendered. Removing all `<`/`>` is strictly stronger than repeated tag matching, so no
markup construct can survive or re-emerge, and normal email text is unaffected (angle
brackets are not meaningful in prose).

## Verification

- Run the same adversarial cases as before (`<<script>script>`, normal replies, empty
  fallback) via a quick Deno/node snippet.
- Redeploy `cs-inbound-email`, `cs-resend-inbound`, `cs-resend-fetch` so the shared file
  change reaches all inbound paths.
- CodeQL alert should auto-close on the next scan.
