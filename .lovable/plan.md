# Fix retail tracking page showing "Order received / To be arranged"

## What's happening
For CCC754425087236PETN11 the lookup returns the correct details: status Delivered, collected 20 Oct, delivered 21 Oct, plus the full timeline. The retail page isn't reading them. It shows its default "Order received" and "To be arranged". The likely cause is that the page looks for the status and dates at the top level of the reply, but the lookup puts them inside `order`.

There's a second problem too. The timeline wording still includes the driver's name ("Driver Abdul Hadi assigned..."), even though names should be removed.

## Changes
1. **Match what the retail page expects.** Keep the current reply as it is, and also add simple top-level fields the theme can read straight away:
   - `status` and a friendly `status_label` (e.g. "Delivered")
   - `collection_date` / `delivery_date` (the actual booked or completed day, never the customer's list of dates they're free)
   - `collected` / `delivered` (true or false)
   - `timeline` (the events)
2. **Remove driver names** from every timeline description, e.g. "A driver has been assigned for collection".
3. Add tests for both rules, deploy, and check this order returns Delivered with 20 Oct and 21 Oct.

## Technical details
- `supabase/functions/public-track/index.ts`: add the flattened fields next to `order`. Clean up event descriptions with a regex that removes "Driver <Name>" and swaps in neutral wording.
- If the theme's script uses other field names, I'll read the theme's tracking JavaScript (or you can paste it) and match those exact names.
- Update the `public-track` section in the API docs.
