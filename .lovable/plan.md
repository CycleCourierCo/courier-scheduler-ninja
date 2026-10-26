# Restore the normal timeslip view for hourly drivers

## Problem
The cut-down driver view (mileage + per-mile rate only) is shown to every driver, including hourly drivers like Tahir.

## Fix
- Only drivers whose timeslip is paid per mile get the cut-down view.
- Hourly drivers see the timeslip card exactly as before (hours, hourly rate, lunch, stops, pay), without the admin edit/approve/delete buttons.
- Admins unchanged.

## Technical details
- In `TimeslipCard.tsx`, change the early return to `if (!isAdmin && timeslip.pay_type === "per_mile")`. The full card already gates admin-only actions and links behind `isAdmin`.
