

## Add Invoice Reporting and Bike Type Failure Tracking

This plan adds comprehensive reporting for QuickBooks invoice creation, including bike type failures and email notifications.

---

## Summary

Two enhancements:
1. **Batch Invoices**: Add missing bike type products to the batch report email
2. **Single Invoice**: Send an email report after each successful invoice creation

---

## Changes Required

### 1. Update Edge Function Response (`supabase/functions/create-quickbooks-invoice/index.ts`)

Enhance the response to include more detailed statistics for reporting:

```typescript
return new Response(JSON.stringify({
  success: true,
  invoice: invoice,
  quickbooksInvoice: quickbooksResponse,
  message: `Invoice created in QuickBooks for ${invoiceData.customerName} with ${lineItems.length} line items`,
  missingProducts: missingProducts.length > 0 ? missingProducts : undefined,
  stats: {
    orderCount: invoiceData.orders.length,
    bikeCount: lineItems.length,
    skippedBikes: missingProducts.length > 0 ? 
      invoiceData.orders.reduce((count, order) => {
        // Count bikes that were skipped due to missing products
        const bikesInOrder = order.bikes?.length || order.bike_quantity || 1;
        return count + bikesInOrder;
      }, 0) - lineItems.length : 0,
    totalAmount: invoice.totalAmount,
    invoiceNumber: invoiceNumber,
    invoiceUrl: invoiceUrl
  }
}), ...);
```

### 2. Add Email Report After Single Invoice Creation (`supabase/functions/create-quickbooks-invoice/index.ts`)

Send an email report to `info@cyclecourierco.com` after successfully creating an invoice:

```typescript
// After saving invoice history, send email report
try {
  const reportHtml = `
    <h2>QuickBooks Invoice Created</h2>
    <p><strong>Customer:</strong> ${invoiceData.customerName}</p>
    <p><strong>Email:</strong> ${invoiceData.customerEmail}</p>
    <p><strong>Invoice Number:</strong> ${invoiceNumber || 'N/A'}</p>
    <p><strong>Date Range:</strong> ${invoiceData.startDate} to ${invoiceData.endDate}</p>
    
    <h3>Summary</h3>
    <ul>
      <li>Orders: ${invoiceData.orders.length}</li>
      <li>Line Items (Bikes): ${lineItems.length}</li>
      <li>Total Amount: £${invoice.totalAmount.toFixed(2)}</li>
    </ul>
    
    ${missingProducts.length > 0 ? `
      <h3 style="color: #dc2626;">Missing QuickBooks Products</h3>
      <p>The following bike types could not be matched to QuickBooks products:</p>
      <ul>
        ${missingProducts.map(p => `<li>${p}</li>`).join('')}
      </ul>
      <p><strong>Action Required:</strong> Create these products in QuickBooks or update the bike type mappings.</p>
    ` : ''}
    
    <p><a href="${invoiceUrl}">View Invoice in QuickBooks</a></p>
  `;

  await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
    },
    body: JSON.stringify({
      to: 'info@cyclecourierco.com',
      subject: `Invoice Created: ${invoiceData.customerName} - ${invoiceNumber || 'Draft'}`,
      html: reportHtml
    })
  });
} catch (emailError) {
  console.error('Failed to send invoice report email:', emailError);
  // Don't fail the request if email fails
}
```

### 3. Update Batch Invoice Reporting (`src/pages/InvoicesPage.tsx`)

Capture and display missing products in the batch report:

**Track missing products per invoice:**
```typescript
// Add to successful invoice tracking
successfulInvoices.push({
  customerName: customer.name,
  customerEmail: customer.accounts_email,
  orderCount: customerOrders.length,
  invoiceNumber: data?.invoice_number,
  bikeCount: data?.stats?.bikeCount || customerOrders.length,
  missingProducts: data?.missingProducts || []
});
```

**Add missing products section to batch report email:**
```html
<h3>Missing QuickBooks Products (Bike Types)</h3>
${allMissingProducts.length > 0 ? `
  <table border="1" cellpadding="8" cellspacing="0" style="background-color: #fee2e2;">
    <tr>
      <th>Bike Type</th>
      <th>Affected Customers</th>
    </tr>
    ${uniqueMissingProducts.map(product => `
      <tr>
        <td>${product}</td>
        <td>${getCustomersWithMissingProduct(product)}</td>
      </tr>
    `).join('')}
  </table>
  <p><strong>Action Required:</strong> Create these products in QuickBooks with the naming format: 
    "Collection and Delivery within England and Wales - [Bike Type]"</p>
` : '<p>All bike types matched to QuickBooks products</p>'}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/create-quickbooks-invoice/index.ts` | Add stats to response, send email report after invoice creation |
| `src/pages/InvoicesPage.tsx` | Track and display missing products in batch report |

---

## Email Report Contents

### Single Invoice Report
- Customer name and email
- Invoice number
- Date range
- Number of orders
- Number of bikes (line items)
- Total amount
- Missing bike type products (if any)
- Link to invoice in QuickBooks

### Batch Invoice Report (Enhanced)
- All existing content
- **New section**: Missing QuickBooks Products table showing:
  - Bike type name
  - Which customers were affected

