

## Adapt Bulk Upload for Dealer Order Spreadsheets

### Overview
Modify the bulk upload feature to accept XLSX files in the dealer order format (your spreadsheet), auto-fill sender details from the logged-in user's profile, and group rows by Order Number into multi-bike orders.

### How It Works
1. User uploads an XLSX file (or CSV) with dealer columns: Order Number, Dealer Name, Street Address, City, Postcode, Email, Telephone, Brand, Model, Size, Type
2. System reads the file, maps columns to order fields, and groups rows by Order Number
3. Sender details are auto-filled from the user's profile (same as "Fill in my details" on the Create Order page)
4. Each group becomes one order with multiple bikes in the `bikes` array
5. User reviews and submits as before

### Key Column Mapping

```text
Spreadsheet Column     -> Order Field
─────────────────────────────────────
Dealer Name            -> receiver.name
Street Address         -> receiver.street
City                   -> receiver.city
Postcode               -> receiver.postcode
Email                  -> receiver.email
Telephone              -> receiver.phone
Brand                  -> bikes[].brand
Model                  -> bikes[].model
Size                   -> (stored in bike model/notes)
Type                   -> bike_type (mapped: "Frame" -> "Wheelset/Frameset", "Bike" -> "Non-Electric - Mountain Bike" or similar default)
Order Number           -> customer_order_number (also used for grouping)
Sender (all fields)    -> From logged-in user's profile
```

### Changes

**1. `src/services/bulkOrderService.ts`**
- Add XLSX parsing support using the `xlsx` npm package (SheetJS) — reads the file and converts to the same internal row format
- Accept both `.csv` and `.xlsx` files
- Add a new `groupRowsByOrderNumber()` function that merges rows sharing the same Order Number into a single order with multiple bikes
- Add a dealer column mapping that translates the spreadsheet headers to the expected internal format
- Map "Frame" -> "Wheelset/Frameset" and "Bike" -> a sensible default bike type (e.g. "Non-Electric - Mountain Bike")
- Update `rowToFormData()` to accept grouped rows and build the `bikes[]` array with brand, model, size info
- Auto-populate sender fields from the user's profile data (passed as a parameter)
- Relax phone validation to accept UK landline formats (01xxx, 07xxx) not just +44

**2. `src/pages/BulkOrderUpload.tsx`**
- Accept `.xlsx` files in addition to `.csv` in the file input and drag-drop
- Import `useAuth` to access `userProfile` for sender auto-fill
- Show a notice that sender details will come from the user's profile
- Update the preview table to show grouped orders (one row per order number, with bike count)
- Add the `xlsx` package dependency

**3. Install dependency**
- Add `xlsx` (SheetJS) package for reading Excel files client-side

### Technical Details
- SheetJS (`xlsx`) reads the workbook client-side, no server needed
- Rows with the same Order Number are grouped before validation
- The "Size" column is appended to the bike model string (e.g. "Rogue Frame - No Shock (Medium)")
- Phone numbers are normalized: spaces stripped, leading 0 converted to +44 for the system
- If the user's profile is incomplete, a warning is shown with a link to complete it before uploading

