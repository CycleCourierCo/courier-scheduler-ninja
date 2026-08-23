# Harden inbound email HTML (Stored XSS finding)

## Current state (verified)

- The only place email HTML is rendered is the inbox message thread, and it already passes the HTML through DOMPurify with scripts, iframes, objects, embeds, forms, inline styles and inline event handlers stripped before display.
- The inbound email webhook stores the raw HTML exactly as the sender supplied it, with no cleaning at ingest.

So the practical exploit path (an agent opening a malicious email and it running JavaScript) is already blocked in the browser, but the database still holds untrusted markup.

## What to change

1. Sanitise at ingest in the inbound email function: strip `<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `<link>`, `<meta>` blocks, all `on*` event attributes, and `javascript:`/`data:text/html` URLs before writing `body_html`. Store the cleaned HTML, keeping the plain-text body untouched.
2. Tighten the render side slightly: also forbid `<link>`, `<meta>`, `<base>` and `srcdoc`/`formaction` attributes, and force links to open with `rel="noopener noreferrer"`.
3. Keep DOMPurify in place — layered defence, so old rows already stored raw stay safe.
4. Mark the security finding as fixed once both layers are in.

## Technical notes

- Inbound cleaning lives in `supabase/functions/cs-inbound-email/index.ts` as a small regex-based scrubber in a shared helper so the outbound function can reuse it if needed; no new dependency is added to the Deno function.
- Render hardening is a config change to the existing `DOMPurify.sanitize` call in `src/components/inbox/MessageThread.tsx`, plus a hook to add safe link attributes.
- No database migration and no schema change required.
