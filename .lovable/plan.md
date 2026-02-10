

# Increase Bulk Timeslot Send Delay to 4 Minutes

## Change

Update the delay between WhatsApp messages during "Send All Timeslots" from 60 seconds to 240 seconds (4 minutes).

## File: `src/components/scheduling/RouteBuilder.tsx`

Find the `setTimeout` or delay constant used in the bulk send loop (currently 60000ms) and change it to 240000ms (4 minutes).

