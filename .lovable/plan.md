

## Manually Create 5 Shopify Orders

### What
Create the 5 orders shown in your Shopify screenshots (CCC1472-CCC1476) by calling the Orders API edge function directly, using the Shopify user's API key (`SHOPIFY_ORDERS_API_KEY` secret).

### Orders to create

| # | Shopify Ref | Bike Type | Brand | Model | Value | Collection | Delivery |
|---|------------|-----------|-------|-------|-------|------------|----------|
| 1 | CCC1472 | Electric Bike - Under 25kg | Boardman | HYB 8.9e | 950 | Paul Snutch, CH61 7XS | Nial Ledingham, BH17 9HG |
| 2 | CCC1473 | Non-Electric - Road Bike | Btwin | Ultra AF 920 | 1000 | Tony, NE20 OJE | robert fletcher, MK15 8PR |
| 3 | CCC1474 | Travel Bike Box | Bike Box Alan | Tri EasyFit - Red | 750 | James Hildreth, GU10 4TN | Robert Niesiolowski, EN6 2ED |
| 4 | CCC1475 | Non-Electric - Mountain Bike | Specialized | Hardrock | 400 | Richard Jackson, YO26 8AH | Lawrence Webster, BS7 8PY |
| 5 | CCC1476 | Non-Electric - Hybrid Bike | Cannondale | Adventure | - | Marina Whitmore, CF72 8AN | Lili Shaw, W12 9AF |

### Notes from screenshots
- CCC1476 has a collection code: `634716` (shown in order notes)
- CCC1473 order note mentions QR code for payment — will include in delivery instructions
- CCC1475 order note mentions eBay order, no email/number for receiver

### How
5 sequential calls to `supabase--curl_edge_functions` hitting `POST /orders` with the `X-API-Key` header set to the `SHOPIFY_ORDERS_API_KEY` secret value. Each call includes full sender/receiver details, bike info, and the Shopify order number as `customerOrderNumber`. The Orders API will auto-generate tracking numbers, geocode addresses, upsert contacts, and send confirmation emails.

### Technical details
- Shopify user ID: `5ac789cc-2e89-470f-b13a-9476246810df`
- API key secret: `SHOPIFY_ORDERS_API_KEY` (already configured in Supabase secrets)
- Edge function: `orders` (POST)
- Each payload follows the same schema the Shopify webhook uses: `sender`, `receiver`, `bikes[]`, `bikeQuantity`, `customerOrderNumber`, `deliveryInstructions`

