# Instant responses should replace the reply text, not append

When staff pick an instant response (from the picker or a suggestion chip) while the reply box already has text, the new response is currently appended after the existing text. Change it so the picked response **replaces** whatever is in the reply box.

## Change

- `src/components/inbox/MessageComposer.tsx` — in `insert()`, replace the append logic (`prev.trim() ? prev + filled : filled`) with simply setting the filled response text: `setText(filled)`.
- Applies to both the "Instant responses" picker and the keyword suggestion chips, since both use the same `insert()` function.
- No changes to sending, notes, placeholders, or the picker UI.

## Verification

- Typecheck, then confirm in the composer that picking a second response replaces the first in the reply box.
