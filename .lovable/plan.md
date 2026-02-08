

## Implement Bike Type-Based Pricing for Invoices

This plan updates the invoicing system to price each bike based on its type, using the corresponding QuickBooks products you've set up with the corrected naming convention.

---

## Confirmed: QuickBooks Returns Pricing Automatically

Yes! When we query QuickBooks for an item by name, the API returns the full product object including:
- `Id` - the product ID (needed for the line item reference)
- `Name` - the product name
- `UnitPrice` - the price you've configured in QuickBooks

So looking up by name will automatically bring in the pricing from your QuickBooks products.

---

## QuickBooks Product Name Format

Updated with the correct prefix including the dash:

```
Collection and Delivery within England and Wales - {Bike Type}
```

**Examples:**
- `Collection and Delivery within England and Wales - Non-Electric - Mountain Bike`
- `Collection and Delivery within England and Wales - Electric Bike - Under 25kg`
- `Collection and Delivery within England and Wales - Cargo Bike`

---

## Changes Required

### 1. Database: Add Structured Bikes Storage

**New migration to add `bikes` JSONB column to orders table:**
```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS bikes JSONB;
```

This stores an array of bike objects for multi-bike orders:
```json
[
  {"brand": "Trek", "model": "Domane", "type": "Non-Electric - Road Bike"},
  {"brand": "Specialized", "model": "Turbo", "type": "Electric Bike - Under 25kg"}
]
```

---

### 2. Update Order Creation Service

**File:** `src/services/orderService.ts`

When creating an order, save the `bikes` array to the new column so we have structured data for invoicing.

---

### 3. Update Invoice Edge Function

**File:** `supabase/functions/create-quickbooks-invoice/index.ts`

**Key changes:**

**a) Add helper function to find product by bike type:**
```typescript
async function findProductByBikeType(
  accessToken: string, 
  companyId: string, 
  bikeType: string
): Promise<{id: string; name: string; price: number} | null> {
  const productName = `Collection and Delivery within England and Wales - ${bikeType}`;
  const encodedName = encodeURIComponent(productName);
  const query = `SELECT * FROM Item WHERE Name = '${productName}' AND Active=true`;
  
  const response = await fetch(
    `https://quickbooks.api.intuit.com/v3/company/${companyId}/query?query=${encodeURIComponent(query)}`,
    { headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' } }
  );
  
  if (response.ok) {
    const data = await response.json();
    const item = data.QueryResponse?.Item?.[0];
    if (item) {
      return { 
        id: item.Id, 
        name: item.Name, 
        price: item.UnitPrice  // Price comes from QuickBooks!
      };
    }
  }
  return null;
}
```

**b) Update line item creation logic:**
- For each order, iterate through bikes (or use bike_type for single-bike orders)
- Look up the matching QuickBooks product by name
- Use the product's ID and price from QuickBooks
- Create individual line items per bike

**c) Cache product lookups:**
To avoid repeated API calls for the same bike type, cache results during invoice generation.

---

### 4. Update Invoices Page Query

**File:** `src/pages/InvoicesPage.tsx`

Include `bikes` and `bike_type` in the order query to pass to the edge function.

---

## Product Name Mapping Table

| Bike Type | QuickBooks Product Name |
|-----------|------------------------|
| Non-Electric - Mountain Bike | Collection and Delivery within England and Wales - Non-Electric - Mountain Bike |
| Non-Electric - Road Bike | Collection and Delivery within England and Wales - Non-Electric - Road Bike |
| Non-Electric - Hybrid | Collection and Delivery within England and Wales - Non-Electric - Hybrid |
| Electric Bike - Under 25kg | Collection and Delivery within England and Wales - Electric Bike - Under 25kg |
| Electric Bike - Over 50kg | Collection and Delivery within England and Wales - Electric Bike - Over 50kg |
| Cargo Bike | Collection and Delivery within England and Wales - Cargo Bike |
| Longtail Cargo Bike | Collection and Delivery within England and Wales - Longtail Cargo Bike |
| Stationary Bikes | Collection and Delivery within England and Wales - Stationary Bikes |
| Kids Bikes | Collection and Delivery within England and Wales - Kids Bikes |
| BMX Bikes | Collection and Delivery within England and Wales - BMX Bikes |
| Boxed Kids Bikes | Collection and Delivery within England and Wales - Boxed Kids Bikes |
| Folding Bikes | Collection and Delivery within England and Wales - Folding Bikes |
| Tandem Bikes | Collection and Delivery within England and Wales - Tandem Bikes |
| Travel Bike Box | Collection and Delivery within England and Wales - Travel Bike Box |
| Wheelset/Frameset | Collection and Delivery within England and Wales - Wheelset/Frameset |
| Bike Rack | Collection and Delivery within England and Wales - Bike Rack |
| Turbo Trainer | Collection and Delivery within England and Wales - Turbo Trainer |

---

## Handling Legacy Orders

For existing orders without the `bikes` column:

1. Use the `bike_type` field directly to look up the product
2. Multiply by `bike_quantity` for orders with multiple bikes of the same type
3. If bike_type is missing or "Multiple types", attempt to parse from `delivery_instructions` or show an error

---

## Files to Modify

| File | Changes |
|------|---------|
| Database migration | Add `bikes` JSONB column to orders table |
| `src/services/orderService.ts` | Save bikes array when creating orders |
| `supabase/functions/create-quickbooks-invoice/index.ts` | Look up products by bike type with correct prefix, use QuickBooks pricing |
| `src/pages/InvoicesPage.tsx` | Include bikes and bike_type in order query |

---

## How Pricing Works

1. Edge function queries: `SELECT * FROM Item WHERE Name = 'Collection and Delivery within England and Wales - {BikeType}'`
2. QuickBooks returns the full item object including `UnitPrice`
3. We use `UnitPrice` as the line item price - no hardcoded prices needed
4. If you change prices in QuickBooks, invoices will automatically use the new prices

