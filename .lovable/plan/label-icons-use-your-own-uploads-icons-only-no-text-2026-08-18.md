# Label icons: use your own uploads, icons only (no text)

## Yes — you can upload the icons
Attach the images in chat (PNG, ideally square, monochrome/black on transparent or white, 128x128 or larger). Send up to three:
- service/inspect icon (a single combined cog+spanner is fine, or send both separately)
- box-my-bike icon
- NI icon (optional — currently drawn as a boxed "NI" text badge)

They will replace the existing files in `public/`:
- `label-icon-cog.png`
- `label-icon-spanner.png`
- `label-icon-box.png`
- `label-icon-ni.png` (new, only if you send one)

## Changes to `src/utils/labelUtils.ts`
1. Remove the text next to each indicator: drop `SERVICE` and `BOX` labels from `renderIndicatorRow`.
2. Icons only, laid out left to right with even spacing on the indicator row.
3. Slightly increase icon size (approx 14pt to 20pt) since there is no text and the icons must stay readable on a 4x6 label.
4. NI: if you upload an NI icon, draw it as an image; otherwise keep the boxed "NI" badge as-is.
5. Keep the existing try/catch fallback so a missing icon file never breaks PDF generation (a failed icon is simply skipped).

No backend or database changes; this is only PDF rendering plus asset swaps.

## Verify
- Type check.
- Generate one single label and one bulk label and confirm icons render at the right size with no text beside them.
