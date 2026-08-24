# Harden sanitizeHtml.ts against regex reappearance bypasses

## Current state (verified)

- `supabase/functions/_shared/sanitizeHtml.ts` scrubs inbound email HTML with single-pass `String.replace()` calls.
- Lines 24–26 remove inline event handlers (`onclick`, `onerror`, `onload`, etc.) in one pass. If a malicious payload is structured so that removing one match exposes another match, the second match survives.
- The same one-pass risk exists for block-tag removal (lines 13, 15), void-tag removal (line 20), dangerous-attribute stripping (line 29), and dangerous-URL neutralization (lines 32–35).

## What to change

1. Add a small local helper `replaceUntilStable` near the top-level constants that repeatedly applies a replacement function until the input string stops changing.
2. Refactor all multi-character regex replacements in `sanitizeInboundHtml` to use `replaceUntilStable`:
   - Block tag removal (including content and unclosed variants).
   - Void/metadata tag removal.
   - Inline event-handler removal (unquoted, double-quoted, single-quoted variants).
   - Dangerous-attribute removal (`srcdoc`, `formaction`, `xlink:href`).
   - Dangerous-URL neutralization (`javascript:`, `vbscript:`, `data:text/html`).
3. Keep the same regex patterns and intended behavior; only change the application from single-pass to iterative-until-stable.
4. No new imports or external dependencies.

## Technical notes

- File to edit: `supabase/functions/_shared/sanitizeHtml.ts` only.
- The helper signature can be something like:
  ```typescript
  function replaceUntilStable(input: string, replacer: (s: string) => string): string {
    let prev = input;
    let next = replacer(prev);
    while (next !== prev) {
      prev = next;
      next = replacer(prev);
    }
    return next;
  }
  ```
- After the change, verify the edge function still type-checks and deploys.
