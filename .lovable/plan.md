# Fix the Radius van tracker connection

Radius rejected the request for van positions with "You do not have permission". The most likely cause is the customer ID: Radius wants its internal customer key (the numeric key in its Customers list), not your account number. The fix below has the app look up the right ID itself.

## What changes
- The app asks Radius for the customers linked to your token, then uses the one whose product includes "Telematics".
- If several customers have Telematics, it shows all their vans together on one map.
- The saved customer ID is only used if it matches one of those customers. If it doesn't match (for example, it's an account number), the app uses the looked-up ID instead.
- If no customer on the token has Telematics, the page says: "This Radius token isn't for Telematics. Create a Telematics refresh token in the Radius portal." That means the token was made for the wrong product.
- The one-off diagnostic step I added earlier will also report the customers it found (names and product only, no IDs shown), so I can confirm the fix from here.

## After building
- Run the diagnostic once and confirm Radius returns vans.
- If it still says "no permission", ask you for a new Telematics token through the secure form.

## Technical details
- `radius-positions`: add `listCustomers(token)` calling `GET /vapi/v1/accounts/users/customers`, then pick the keys whose `product` matches /telematics/i. Cache the result in memory for 1 hour.
- Choose the customer IDs: use `RADIUS_CUSTOMER_ID` if it is one of the Telematics keys, otherwise use all Telematics keys. Fetch positions for each ID in parallel and merge them, removing duplicates by device id.
- The 401 retry path also re-fetches the customer list.
- New error code `radius_no_telematics`, with the message shown above.
