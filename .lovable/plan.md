# Clearer home/work address badges + click-to-pin bike details

## 1. Home / work address badges and button (Route Timeslots)

Currently a stop shows either a blue "Work address" badge, a plain outline "Work address available" badge, or nothing — and a faint ghost button reading "Use work address". It isn't obvious which address is actually being visited or what the button does.

Changes in the timeslot job rows:

- Always show an explicit address badge for stops that have an alternative address:
  - Visiting work: blue badge, briefcase icon, "Going to: Work address"
  - Visiting home: neutral badge, house icon, "Going to: Home address"
- When a work address exists but home is being used, add a small muted hint badge "Work address on file" so the planner knows a switch is possible.
- Replace the ghost button with a clearly labelled outline button with a swap icon: "Switch to work address" / "Switch to home address", plus a tooltip/popover showing the address it would switch to and why the current one was auto-chosen (work hours on that date vs outside them).
- Neighbour badge keeps its amber styling but gains a person icon and reads "Leave with neighbour: 42".
- Badges wrap on mobile (no overflow) and the switch button stays full-width-friendly on narrow cards.

## 2. Bike details: hover on desktop, click to pin

Desktop hover works today via a Radix tooltip, but a tooltip closes as soon as the pointer leaves, so it can't be read while scrolling or compared between stops.

- Replace the desktop tooltip with a single Popover that opens on hover and can be pinned open by clicking the badge; clicking again (or outside) unpins/closes.
- Mobile keeps tap-to-open behaviour (same component, no hover).
- Same bike list content in both modes; badge styling and overload colouring unchanged.

## Technical notes

- `src/components/scheduling/RouteBuilder.tsx`
  - `BikeCountBadge`: drop the split Tooltip/Popover branches for a controlled `Popover` with `open` state; on desktop add `onMouseEnter`/`onMouseLeave` (ignored when pinned) and `onClick` to toggle `pinned`; `PopoverContent` gets `onOpenAutoFocus={e => e.preventDefault()}` so hover-open doesn't steal focus, and keeps `z-[60]`. Keep `useIsMobile` only to disable hover handlers on touch.
  - Address badge block (around lines 703-730): render a single resolved-address badge from `job.addressSource` using `Briefcase` / `Home` icons from lucide-react, an "on file" hint badge, and an outline `Button` with `ArrowLeftRight` icon and explicit label calling the existing `onToggleAddress(job)`.
  - No changes to `applyAddressChoice`, `toggleStopAddress`, or `resolveStopAddress` — resolution logic stays as-is; this is presentation only.
- Mirror the same badge/button labelling in `src/components/scheduling/MultiJobTimeslotDialog.tsx` if it renders the same address badges.
