# Stop the guaranteed delivery pop-up rebuilding on every key press

## Cause (confirmed in the code)

The guaranteed delivery section draws its outer box with a small wrapper that is created from scratch each time the section redraws. Each key you press redraws the section, so the wrapper counts as new and everything inside it is thrown away and rebuilt, the pop-up included. That's why typing "1" makes the pop-up flash and you lose your place before you can type "5". The rest of the page isn't affected, which matches what you're seeing.

## Fix

- Build the outer box (the plain box inside Services, or the green-bordered box elsewhere) directly in the section, so it stays the same between key presses and the pop-up is no longer rebuilt.
- Keep the safeguards from last time (typed values remembered, background updates held back while the pop-up is open). They're harmless.
- Check the other order-page sections for the same wrapper pattern and fix any that have it, so their pop-ups don't do this either.

## Check

Type "15.50" into the amount box in one go without the pop-up flashing, then type a note, pick who pays, and confirm.

## Technical notes

- `src/components/order-detail/GuaranteedDeliveryCard.tsx` line ~236: `const Shell = ({children}) => …` is declared inside the component body, so its identity changes every render and React remounts the subtree, including the `Dialog`. Replace it with an inline conditional element (`const shellProps`/`React.createElement(bare ? "div" : Card, …)`) or move `Shell` to module scope with `bare`/`isOn` as props.
- Search `src/components/order-detail/` for other components declared inside render (`const [A-Z]\w* = (` inside a component) and hoist them the same way.
