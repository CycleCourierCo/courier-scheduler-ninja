# Increase gap between label indicator icons and receiver details

## Goal
Add more vertical space between the service/box/NI indicator row and the receiver (TO) details on the printed 4x6 collection/delivery labels.

## Changes

### `src/utils/labelUtils.ts`
- Increase the spacing returned by `renderIndicatorRow` so there is a larger gap before the receiver block begins.
- Current return adds `ICON_SIZE + 10` points below the indicator baseline; raise the trailing gap (e.g. to `ICON_SIZE + 20` or `ICON_SIZE + 24`) so the icons sit visually separated from the TO details.
- Keep all other label layout, icon sizing, and fallback behaviour unchanged.

## Verify
- Type check.
- Generate a sample single label and a sample bulk label and visually confirm the receiver details no longer crowd the indicator icons.
