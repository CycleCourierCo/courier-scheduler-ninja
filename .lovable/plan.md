# Fix Marcus Connolly's wrong map location

## What's wrong
Order CCC754670985137MARCT1 (Marcus is the sender) has his collection pin saved at Twickenham/Hounslow (51.448, -0.361) instead of Balham (51.450, -0.154), about 14 km west.

- The address was typed as "Greater London, london, sw128bg", which is messy. The address lookup guessed the wrong "Blandfield Road" area.
- There is a safety check that compares the result with the postcode and uses the postcode instead if they're far apart. But it only steps in when the gap is more than 15 km. This one was about 14 km, so the wrong spot was kept.
- His older orders (where he's the receiver, typed "London, SW12 8BG") have the right location.

## Fix
1. Correct the saved location on this order to the SW12 8BG postcode position, so the Get Timeslots map shows it in the right place straight away.
2. Make the postcode check stricter. A full UK postcode covers only a few streets, so if a lookup lands more than about 2 km from its postcode, use the postcode position instead. This stops the same problem happening on future orders with messy addresses.
3. Check for other open orders with the same issue (pin far from its own postcode) and correct those too, then tell you how many were fixed.

## Technical details
- `src/utils/geocoding.ts` `checkAgainstPostcode`: lower threshold from 15 km to 2 km; normalise postcode (uppercase, single space).
- Apply the same threshold in the edge geocoding fallback (`fix-order-locations` / shared edge geocoder) if it has the same check.
- Data fix: update `orders.sender` JSONB lat/lon for CCC754670985137MARCT1 using postcodes.io SW12 8BG; scan non-delivered/non-cancelled orders comparing sender/receiver lat/lon to their postcode centre and patch outliers >2 km.
