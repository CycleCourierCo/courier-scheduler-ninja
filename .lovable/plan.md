# Move the bay "X" button to the left of the bay badge

## What changes

On the Loading page's "Bikes in storage" cards, the remove (X) button currently sits on the **right** of the bay number/letter badge. Move it to the **left** of the badge so it reads: `X | BAY12`.

File: `src/components/loading/BikesInStorage.tsx` — `BayBadge` component (lines 81–96).

- Swap the order inside the wrapper: button first, badge second.
- Adjust the connected-edge styling so the two still appear as one unit:
  - Button: `rounded-l-md`, `border-r-0` (keeps left rounding, drops right border).
  - Badge: `rounded-l-none`, `border-l-0` (keeps right rounding, drops left border).

## What does not change

- Confirmation dialog, wording, and behaviour (removing only the bay position).
- Anything else on the Loading page.

## Verification

- Typecheck with `bunx tsgo --noEmit -p tsconfig.json`.
- Playwright screenshot of the Loading page storage cards to confirm the X sits left of the bay badge.
