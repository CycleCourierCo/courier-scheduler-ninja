# Fix tracking page UI (mobile)

Verified on a 390px-wide render of `/tracking/CCC754877137960COLBT4`: the page scrolls sideways (content is 401px wide in a 390px viewport) and several blocks spill past the card edges. Desktop measures clean.

## What's broken

1. **Bike name is cut off mid-word** ("Cannondale Synapse Carbon Disc Ultegra 3 201…") — the text span uses both `break-words` and `truncate` (conflicting), and it has no shrink allowance inside its row, so it grows instead of wrapping.
2. **Locked proof buttons force the page wider** — the "Verify collection postcode to view images" / "…to view signature" buttons keep their text on one line (measured 414px and 430px right edges), which stretches the whole page and creates the horizontal scroll.
3. **Provisional-dates note and scheduled-date cards** overflow the card by the same 11px, because the surrounding grid/columns don't allow their children to shrink.

## Fixes

- Bike details row: drop `truncate`, keep wrapping, and let the text shrink so long brand/model strings wrap onto two lines.
- Locked proof buttons: allow the label to wrap (multi-line, auto height, full width on mobile, shrink to content from `sm` up) and shorten the label to "Verify postcode to view photos" / "…to view signature", so nothing forces a minimum page width.
- Add shrink/`min-w-0` allowances to the order header grid and scheduled-dates column, and let the provisional note wrap, so all card content stays inside the card.
- Keep the timeline body clipping-safe so future long values (tracking links, descriptions) wrap rather than widen the page.

No copy or data changes beyond the two shortened button labels; no backend changes.

## Verification

Re-render the same tracking page at 390px and confirm document scroll width equals the viewport width and no element extends past the right edge, plus a desktop pass to confirm no regression.
