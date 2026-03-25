

## Make All Bulk Upload Columns Editable

### What changes

The preview table currently only shows Order #, Receiver name, Postcode, Qty, Brand, Model, Type, and Status. It needs to show all order-relevant fields and make them editable.

### New columns (all editable)

The table will show these columns, with shared order fields using `rowSpan` across bike rows:

| Column | Editable via | rowSpan'd |
|--------|-------------|-----------|
| ☐ (checkbox) | Checkbox | Yes |
| Order # | Input | Yes |
| Receiver Name | Input | Yes |
| Email | Input | Yes |
| Phone | Input | Yes |
| Street | Input | Yes |
| City | Input | Yes |
| Postcode | Input | Yes |
| Qty | Badge (read-only) | Yes |
| Brand | Input | No (per bike) |
| Model | Input | No (per bike) |
| Type | Select dropdown | No (per bike) |
| Status | Icon/text (read-only) | Yes |

### Technical details

**File: `src/pages/BulkOrderUpload.tsx`**

1. Add an `updateReceiverField` handler that updates a specific field in `order.receiverData` by order key:
   ```ts
   const updateReceiverField = (orderKey: string, field: string, value: string) => {
     setGroupedOrders(prev => prev.map(o => {
       const key = getOrderKey(o);
       if (key !== orderKey) return o;
       return { ...o, receiverData: { ...o.receiverData, [field]: value } };
     }));
   };
   ```

2. Add an `updateOrderNumber` handler to allow editing the order number field.

3. Update table headers to include: Order #, Name, Email, Phone, Street, City, Postcode, Qty, Brand, Model, Type, Status.

4. Convert all rowSpan'd cells (currently read-only text) to `<Input>` components bound to `receiverData` fields via `updateReceiverField`. Order # uses `updateOrderNumber`.

5. Given the 360px viewport, the table already uses `overflow-x-auto` so horizontal scrolling handles the extra columns naturally.

6. No service file changes needed -- `receiverData` already feeds into `groupedOrderToFormData` which reads `receiver_name`, `receiver_email`, `receiver_phone`, `receiver_street`, `receiver_city`, `receiver_postcode` from the data object.

