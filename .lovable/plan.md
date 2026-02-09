

# Add Inspection & Service Line Item to Invoices

## Overview

When an order has the inspection and service flag (`needs_inspection: true`), add an additional line item for the "Bike Inspection & Service" product. The description should match the collection and delivery line item.

## Changes Required

### 1. Update Frontend Types & Query

**File: `src/pages/InvoicesPage.tsx`**

Add `needs_inspection` to the `InvoiceItem` type and the order query:

```typescript
// Line 29-41: Add needs_inspection to InvoiceItem type
type InvoiceItem = {
  id: string;
  created_at: string;
  tracking_number: string;
  bike_brand: string;
  bike_model: string;
  bike_type: string;
  bike_quantity: number;
  bikes: BikeItem[] | null;
  customer_order_number: string;
  sender: any;
  receiver: any;
  needs_inspection: boolean | null;  // ADD THIS
};

// Line 155-174: Add needs_inspection to the select query
const { data, error } = await supabase
  .from("orders")
  .select(`
    id,
    created_at,
    tracking_number,
    bike_brand,
    bike_model,
    bike_type,
    bike_quantity,
    bikes,
    customer_order_number,
    sender,
    receiver,
    needs_inspection
  `)
  // ... rest of query
```

### 2. Update Edge Function Interface & Logic

**File: `supabase/functions/create-quickbooks-invoice/index.ts`**

#### a) Add `needs_inspection` to the order interface (line 21-33):

```typescript
interface InvoiceRequest {
  customerId: string;
  customerEmail: string;
  customerName: string;
  startDate: string;
  endDate: string;
  orders: Array<{
    id: string;
    created_at: string;
    tracking_number: string;
    bike_brand: string;
    bike_model: string;
    bike_type: string;
    bike_quantity: number;
    bikes: BikeItem[] | null;
    customer_order_number: string;
    sender: any;
    receiver: any;
    needs_inspection?: boolean | null;  // ADD THIS
  }>;
}
```

#### b) Create helper function to find product by exact name:

```typescript
async function findProductByExactName(
  accessToken: string,
  companyId: string,
  productName: string
): Promise<ProductInfo | null> {
  if (productCache.has(productName)) {
    return productCache.get(productName) || null;
  }

  const escapedProductName = escapeQuickBooksString(productName);
  const query = `SELECT * FROM Item WHERE Name = '${escapedProductName}' AND Active=true`;
  
  const response = await fetch(
    `https://quickbooks.api.intuit.com/v3/company/${companyId}/query?query=${encodeURIComponent(query)}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    }
  );

  if (response.ok) {
    const data = await response.json();
    const item = data.QueryResponse?.Item?.[0];
    
    if (item) {
      const product: ProductInfo = { 
        id: item.Id, 
        name: item.Name, 
        price: item.UnitPrice || 0
      };
      productCache.set(productName, product);
      return product;
    }
  }
  
  return null;
}
```

#### c) Add inspection line item after each bike (in the order processing loop around line 435-494):

```typescript
// After adding the delivery line item for each bike...

// Check if order needs inspection and add service line item
if (order.needs_inspection) {
  const inspectionProduct = await findProductByExactName(
    tokenData.access_token,
    tokenData.company_id,
    'Bike Inspection & Service'
  );
  
  if (inspectionProduct) {
    // Use the same description as the delivery line item
    lineItems.push({
      Amount: inspectionProduct.price,
      DetailType: "SalesItemLineDetail",
      SalesItemLineDetail: {
        ItemRef: {
          value: inspectionProduct.id,
          name: inspectionProduct.name
        },
        Qty: 1,
        UnitPrice: inspectionProduct.price,
        ServiceDate: serviceDate,
        ...(vatTaxCodeId && { TaxCodeRef: { value: vatTaxCodeId } })
      },
      Description: description  // Same description as the delivery line
    });
    
    console.log(`Added inspection line item: ${description} @ £${inspectionProduct.price}`);
  } else {
    console.warn(`Inspection product "Bike Inspection & Service" not found in QuickBooks`);
    if (!missingProducts.includes('Bike Inspection & Service')) {
      missingProducts.push('Bike Inspection & Service');
    }
  }
}
```

## QuickBooks Setup Required

Create a product in QuickBooks named exactly:
```
Bike Inspection & Service
```

Set the price to the net (ex-VAT) amount you want to charge. The 20% VAT will be applied automatically.

## Flow

```text
For each order:
├── For each bike in order:
│   ├── Add "Collection and Delivery" line item
│   │   └── Description: "{tracking} - {brand} {model} - {sender} → {receiver}"
│   │
│   └── IF order.needs_inspection = true:
│       └── Add "Bike Inspection & Service" line item
│           └── Description: "{tracking} - {brand} {model} - {sender} → {receiver}"
│                            (same as delivery line)
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/InvoicesPage.tsx` | Add `needs_inspection` to type and query |
| `supabase/functions/create-quickbooks-invoice/index.ts` | Add interface field, create helper, add inspection line items |

## Testing

1. Ensure the "Bike Inspection & Service" product exists in QuickBooks
2. Find a customer with an order that has `needs_inspection: true`
3. Create an invoice for that customer
4. Verify the invoice contains both:
   - Collection and Delivery line item
   - Bike Inspection & Service line item (with matching description)

