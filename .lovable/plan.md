

## Fix VAT Rate on QuickBooks Invoices

Remove the explicit non-taxable tax code to let QuickBooks use each product's default VAT settings.

---

## Changes Required

**File:** `supabase/functions/create-quickbooks-invoice/index.ts`

### 1. Remove Tax Code Lookup (lines 280-311)

Delete the entire tax code fetching and lookup section since we won't be overriding the product's tax settings.

### 2. Remove TaxCodeRef from Line Items (lines 424-426)

Remove the `TaxCodeRef` property from the `SalesItemLineDetail` object so QuickBooks uses the product's default tax code.

**Before:**
```typescript
SalesItemLineDetail: {
  ItemRef: {
    value: product.id,
    name: product.name
  },
  Qty: 1,
  UnitPrice: product.price,
  TaxCodeRef: {
    value: nonTaxableCode
  },
  ServiceDate: serviceDate
}
```

**After:**
```typescript
SalesItemLineDetail: {
  ItemRef: {
    value: product.id,
    name: product.name
  },
  Qty: 1,
  UnitPrice: product.price,
  ServiceDate: serviceDate
}
```

---

## Result

| Before | After |
|--------|-------|
| Forces `NON` (0%) tax code on all line items | Uses each product's configured VAT rate |
| All invoices show 0% VAT | VAT rates come from QuickBooks product settings |

