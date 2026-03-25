
Goal: make the “Return to Sender” button show clear top/bottom padding on mobile, with all text fully visible.

1) Update only the return button styling in `src/pages/CustomerOrderDetail.tsx` (action row near the page header).
- Replace the current classes with a height-unlocked mobile-friendly set:
  - add `h-auto`
  - increase vertical padding to `py-4`
  - raise minimum height to `min-h-[64px]` (or `min-h-[72px]` if needed after preview check)
  - keep wrapping + readability via `whitespace-normal leading-tight text-left`
- Keep `flex-1 sm:flex-none` so it stays responsive.

2) Improve text block behavior inside the button.
- Wrap the mobile label (`Return to Sender`) in a span with `leading-tight` and `block` so line height and wrapping are stable.
- Keep desktop label unchanged (`hidden sm:inline`) so larger screens preserve the current phrasing.

3) Validate in mobile viewport (360px wide).
- Confirm text is no longer clipped.
- Confirm visible top and bottom breathing room.
- Confirm icon + text alignment still looks intentional and action hierarchy remains unchanged.

Technical details
- Root cause: the Button component’s default size injects `h-12`, which limits vertical growth; adding `py-*` alone does not guarantee visible extra padding when content wraps.
- Safe fix strategy: override per-instance with `h-auto` + larger `min-h` instead of changing global `button.tsx` variants, so other buttons across the app are unaffected.
- Suggested final class target for this button:
  `flex-1 sm:flex-none h-auto min-h-[64px] px-4 py-4 whitespace-normal leading-tight text-left`
