

## Remove Friday from Opening Hours Editor & Add "Within Hours" Badge

### Changes

**1. `src/components/user-management/OpeningHoursEditor.tsx`**
- Filter out `'friday'` from the `DAY_NAMES` loop so it never renders in the editor
- Friday will always stay as closed (already set in the DB update)

**2. `src/components/scheduling/RouteBuilder.tsx`**
- Update `getOpeningHoursBadge` to return a **green** badge when the estimated time IS within opening hours: `✓ Within Hours (09:00-21:00)`
- For 24h days, show `✓ Open 24h`
- Keep existing red "Closed" and amber "Outside Hours" badges

**3. `src/components/scheduling/TimeslotEditDialog.tsx`**
- Filter out `'friday'` from the compact opening hours summary so it doesn't show Friday as an option

### No other changes needed
Fridays are already disabled on the date pickers. This just removes Friday from the opening hours editor UI and adds the positive "within hours" badge on route job cards.

