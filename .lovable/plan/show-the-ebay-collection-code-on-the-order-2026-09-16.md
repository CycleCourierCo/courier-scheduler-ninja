# Show the eBay collection code on the order

## What's actually wrong

Order CCC754172496099MATNW6 **did** receive the code from Shopify. Checked in the database: collection code `918114` is stored and the order is flagged as an eBay order.

The problem is display only — nothing in the app shows the collection code on an order. Confirmed by searching the code: `collectionCode` appears only in the create-order form, the API docs, and the data-mapping layer. Neither the staff order page nor the customer order page renders it, and it isn't on labels or job cards.

It does already reach the people who need it in the field: the driver's Shipday job and the driver WhatsApp message both include a line `eBay Code: <code>`.

## What changes

1. **Staff order page** — show an "eBay collection code" row with the code, easy to read and copy, plus an "eBay order" marker. Only shown when a code exists.
2. **Customer order page** — same code shown to the account that owns the order, so the customer can check it matches their eBay record.
3. **Order lists** — a small "eBay" badge on the order card when the order is an eBay order, so staff can spot them without opening each one.
4. **Collection labels** — include the eBay code on the collection label, since the driver may need to quote it at the door.

Nothing changes about how the code arrives from Shopify, how it's stored, or the existing Shipday/WhatsApp lines.

## Also worth knowing

Some older eBay orders may have the flag set but no code, or a code with no flag, depending on how Shopify sent them. The display handles both: the code shows whenever there is one, and the badge shows whenever the order is flagged.

## Technical notes

- `src/types/order.ts` already has `collectionCode` and `isEbayOrder`; `orderServiceUtils.ts` already maps `collection_code` / `is_ebay_order`. No type or mapping changes needed.
- `src/pages/OrderDetail.tsx` and `src/pages/CustomerOrderDetail.tsx`: render the code in the existing order-details block (conditional on `order.collectionCode`), with a copy-to-clipboard button on the staff page.
- `src/components/OrderCardList.tsx`: add an `isEbayOrder` badge alongside the existing badges.
- `src/utils/labelUtils.ts`: add the code line to the collection label output only (delivery labels unchanged).
- No database migration, no edge function changes, no RLS changes — the field is already selected by the existing order queries.
