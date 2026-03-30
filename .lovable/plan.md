

## Update Missing Contact Details on 5 Manual Orders

### Data Extracted from Screenshots

| Order | Sender Email | Sender Phone | Sender Street | Sender City | Receiver Email | Receiver Phone | Receiver Street | Receiver City |
|-------|-------------|-------------|---------------|-------------|---------------|----------------|-----------------|---------------|
| CCC1472 | nickysnutch@gmail.com | +447557643429 | 35 Colemere Drive, Thingwall | Wirral | npl2@outlook.com | +447946138857 | 49 Portesham Way | Poole |
| CCC1473 | brookstony@400gmail.com | +447996373357 | Holly House, Medburn | Newcastle | robert.fletcher@kajima.co.uk | +447896621539 | 6 Montgomery Crescent | Milton Keynes |
| CCC1474 | robski1@yahoo.com | +447876755305 | 9 Glynswood | Farnham | robski1@yahoo.com | +447944508935 | 11 Elmroyd Avenue | Potters Bar |
| CCC1475 | richard.james.jackson93@gmail.com | +447494985934 | 1 Station Road, Whixley | York | richard.james.jackson93@gmail.com | +447494985934 | 3 Manor Road, Bishopston | Bristol |
| CCC1476 | whitmorem@outlook.com | +447952903208 | 9 Maes y Rhedyn | Talbot Green | shaw.l@hotmail.co.uk | +447900868886 | 5b Curwen Road | London |

### Notes
- CCC1473 sender email appears to be `brookstony@400gmail.com` (possibly a typo on Shopify — `400gmail.com`)
- CCC1475 receiver uses the sender's email/phone (eBay order — buyer didn't provide their own)
- CCC1474 sender and receiver share the same email (`robski1@yahoo.com`)

### Implementation
5 SQL `UPDATE` statements using the Supabase insert tool to set the `sender` and `receiver` JSONB columns with the full contact details (name, email, phone, street, city, county, postcode, lat/lon preserved from existing data).

Each update will use `jsonb_set` chained calls to populate the missing fields while preserving existing geocoded coordinates.

