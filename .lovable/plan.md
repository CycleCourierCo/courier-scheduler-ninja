

## Add Numeric Bike Type IDs, bike_type, bike_value, and bikes array to Orders API

### Changes

#### 1. `supabase/functions/orders/index.ts`

**Add bike type ID mapping** (top of file): Inline `BIKE_TYPE_BY_ID` map (1-17) matching the existing bike types.

**Update extraction logic** (lines 93-116):
- Extract `bike_type` from: `bikes[0].type`, `body.bike_type`, or resolved from `bikes[0].type_id` / `body.bike_type_id`
- Extract `bike_value` from: `bikes[0].value`, `body.bike_value`
- If `type_id` is provided (number 1-17), resolve to string type; return 400 if invalid
- `type_id` takes precedence over string `type` when both provided

**Update orderData** (lines 206-231): Add:
- `bike_type: bikeType || null`
- `bike_value: bikeValue || null`
- `bikes: body.bikes || null` (full JSONB array)

**Update POST response** (lines 504-525): Add `bike_type`, `bike_value`, `bikes`, `needs_inspection`.

#### 2. `src/constants/bikePricing.ts`

Add exported `BIKE_TYPE_BY_ID` and reverse `BIKE_TYPE_ID_BY_NAME` mappings:

| ID | Type | Price |
|----|------|-------|
| 1 | Non-Electric - Mountain Bike | £60 |
| 2 | Non-Electric - Road Bike | £60 |
| 3 | Non-Electric - Hybrid | £60 |
| 4 | Electric Bike - Under 25kg | £70 |
| 5 | Electric Bike - Over 25kg | £130 |
| 6 | Cargo Bike | £225 |
| 7 | Longtail Cargo Bike | £130 |
| 8 | Stationary Bike | £70 |
| 9 | Kids Bikes | £40 |
| 10 | BMX Bikes | £40 |
| 11 | Boxed Kids Bikes | £35 |
| 12 | Folding Bikes | £40 |
| 13 | Tandem | £110 |
| 14 | Travel Bike Box | £60 |
| 15 | Wheelset/Frameset | £35 |
| 16 | Bike Rack | £40 |
| 17 | Turbo Trainer | £40 |

#### 3. `docs/API_DOCUMENTATION.md`

- Add "Bike Type Reference" table with all IDs, names, and prices
- Update request body: document `bike_type`, `bike_type_id`, `bike_value` as top-level optional fields
- Update `bikes` array to include `type`, `type_id`, and `value` per bike
- Update response examples to include `bike_type`, `bike_value`, `bikes`, `needs_inspection`
- Update Field Validation section with new optional fields

### Files

| File | Change |
|---|---|
| `supabase/functions/orders/index.ts` | Add type ID resolution, extract+store bike_type/bike_value/bikes, update response |
| `src/constants/bikePricing.ts` | Add `BIKE_TYPE_BY_ID` and reverse mapping |
| `docs/API_DOCUMENTATION.md` | Document numeric IDs, new fields, updated examples |

