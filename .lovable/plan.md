

## Add Bike Type Reference to API Documentation Page

### What's Missing

The API documentation page doesn't show:
- The `bike_type_id` / `type_id` fields (numeric 1-17) on bikes or at top level
- The `bike_type` / `type` string fields
- The `bike_value` / `value` fields
- The reference table mapping IDs to bike types and prices

These are all implemented in the backend and documented in the markdown docs but not visible to API users on the page.

### Changes

**`src/pages/ApiDocumentationPage.tsx`**

1. **Add Bike Type Reference section** — Insert a new Card after the "Orders API" section (before Order Statuses) with a table showing all 17 bike type IDs, their names, and prices. Use a simple HTML table styled with Tailwind.

2. **Update request body example** — Add `bike_type_id`, `bike_value`, and per-bike `type_id` and `value` fields to the JSON example:
   ```json
   "bikes": [
     {
       "brand": "Trek",
       "model": "Domane AL 2",
       "type_id": 2,
       "value": 1200
     }
   ],
   "bike_type_id": 2,
   "bike_value": 1200
   ```

3. **Update field descriptions** — Add entries for:
   - `bike_type_id` (optional, integer 1-17, numeric bike type; takes precedence over `bike_type`)
   - `bike_type` (optional, string bike type name)
   - `bike_value` (optional, number, estimated value in £)
   - `bikes[].type_id` (optional, integer 1-17 per bike)
   - `bikes[].type` (optional, string type per bike)
   - `bikes[].value` (optional, number value per bike)

4. **Update response example** — Add `bike_type`, `bike_value`, and `bikes` array with type/value fields to the 201 response JSON.

