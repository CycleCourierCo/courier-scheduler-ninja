# Fix squashed home page UI on laptop screens

On a typical laptop viewport (roughly 1400x800), the home hero is sized for very tall screens: the heading jumps to `text-7xl`/`text-8xl`, the header logo is 80px tall, and the hero has `py-12 md:py-0` (no vertical padding from `md` up) while stretching with `flex-1`. The result is oversized type pressed against the buttons, with the footer crowding straight in underneath.

## What changes

- Home hero (`src/pages/Index.tsx`)
  - Tone the heading scale down for laptops: keep the large sizes for genuinely big screens only, so a laptop sees a moderate size instead of `text-8xl`.
  - Restore vertical breathing room at all widths instead of `md:py-0`, and give the section a sensible minimum height so content is centred rather than stretched-and-squashed.
  - Slightly reduce the subheading size and the gap stack (`space-y-8` / `space-y-6`) at laptop sizes so the block fits without crowding.
  - Cap the decorative blurred circles so they don't sit oddly on short viewports.
- Header (`src/components/Layout.tsx`)
  - Reduce the logo height on medium screens (keeping the current size on large screens), reclaiming vertical space at the top of the page.

## Notes

Purely presentational Tailwind class changes — no copy, routing, data, or logic changes. Verification: render `/` at 1440x800 and 1280x720 and confirm the heading, subtext, buttons and footer all fit comfortably without clipping, then re-check 1920x1080 and mobile for no regression.
