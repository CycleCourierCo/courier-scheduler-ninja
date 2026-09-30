# Fix the false "not taxable" storage error

## What's wrong
Your QuickBooks product is set up correctly (Service, £33.33, 20.0% S). Our check reads a "Taxable" yes/no flag that US QuickBooks uses. UK QuickBooks doesn't fill that flag in; it stores the VAT rate on the product instead. So the check always fails for UK accounts.

## Fix
- Treat the product as correct when its sales VAT code is the standard 20% code (or, if QuickBooks leaves it blank, still apply the 20% code on the invoice line as we already do).
- Only block the invoice if the product is set to a different VAT code, like zero-rated or exempt, and name that code in the message.
- Then re-run Oskar Artur Pietrzak's invoice.

## Rate-limit errors
The "Rate limit exceeded" rows (taylan arslan, Tom) are from the email service, not QuickBooks, when many invoices send at once. Add a short wait and automatic retry when that happens so they don't show as failed.

## Technical notes
- `create-quickbooks-invoice`: in `findProductByExactName`, also capture `SalesTaxCodeRef.value`; replace the `taxable !== true` check with: pass if `salesTaxCodeId` is empty or equals `vatTaxCodeId`; fail if it's a different code.
- Resend 429 on invoice email: honour retry-after (cap ~20s), retry up to 3 times.
