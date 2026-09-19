# Fix CodeQL alerts on `htmlToPlainText` in emailLayout.ts

## Problem

`supabase/functions/_shared/emailLayout.ts` `htmlToPlainText()` strips HTML with regular expressions. CodeQL keeps flagging this family of code no matter how we patch the regexes:

- **Incomplete multi-character sanitization** — one-pass (or even fixed-point) regex stripping can leave re-formed `<script` / `<style` sequences.
- **Bad HTML filtering regexp** — patterns like `/<script[\s\S]*?<\/script>/gi` miss end tags such as `</script >`.
- **Double escaping or unescaping** — `&amp;` is decoded, then `&lt;`/`&gt;` decode can produce new `&` sequences that get decoded again.

Patching the regexes again will just produce the next round of alerts. The durable fix is to stop parsing HTML with regexes in this function.

## What this function is for

It converts our own generated email HTML into a plain-text alternative for Resend (spam-score and accessibility requirement). Input is our own template HTML plus user-supplied order/customer data embedded in it. Output must be readable plain text and must never contain markup or decoded entities that re-form tags.

## Fix

Rewrite `htmlToPlainText` as a small hand-rolled scanner (no HTML-matching regexes at all):

1. **Character-by-character tokenizer** that walks the string once:
   - On `<`, read the tag name; if it is `script`, `style`, or `head`, skip everything until the matching `</name` (tolerating whitespace/attributes in the end tag, since the scanner — not a regex — does the matching) and drop the whole block.
   - Otherwise skip to the closing `>` (tolerating `>` inside quoted attribute values).
   - While skipping, remember specific tags to emit text equivalents: `a` (collect `href`, append `text (href)` when they differ), `br` → newline, `li` → `- `, closing `p`/`div`/`tr`/`h1`–`h3`/`table`/`li` → newline, closing `td`/`th` → two spaces.
2. **Entity decoding exactly once, after all markup is gone**, on the extracted text only, in an order that cannot double-decode: decode `&lt;` `&gt;` `&quot;` `&#39;` `&nbsp;` `&middot;` etc. first and `&amp;` last — or simpler, decode `&amp;` last and never re-scan. Also strip zero-width characters (`&#847;`? — verify what this actually is; keep `&zwnj;`/zero-width removal).
3. **Whitespace tidy** (spaces before newlines, collapse 3+ newlines) — pure text regexes, which CodeQL does not flag.
4. Because markup is removed by a single-pass scanner before any entity decoding, there is no re-formation path and no need for the 10-pass fixed-point loop.

Because the scanner is not a regular expression, the CodeQL rules `js/incomplete-multi-character-sanitization`, `js/bad-tag-filter`, and `js/double-escaping` no longer match the code.

## Files changed

- `supabase/functions/_shared/emailLayout.ts` — replace the body of `htmlToPlainText` only. Exported name, signature, and behaviour for legitimate input stay the same.

No other files, no new dependencies (Deno stdlib only / plain TypeScript).

## Verification

- Unit-style check via a quick Deno script: feed adversarial inputs (`<script>`, `</script >`, `&lt;script&gt;`, nested/commented tags, `&amp;lt;`, unclosed tags, `>` inside attributes) and confirm no `<`/`>` or entity re-formation survives, and that a normal branded email converts to the same readable text as today (diff against current output for one real template).
- Redeploy affected edge functions via the managed deploy tool (the shared module is bundled into each function at deploy time).
- After merge, confirm the CodeQL alerts auto-close on the next scan.
