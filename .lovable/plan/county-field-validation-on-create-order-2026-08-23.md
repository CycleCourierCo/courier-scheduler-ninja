# County field validation on Create Order

## What changes

The County box on both the collection (sender) and delivery (receiver) address sections will behave exactly like Street, City and Postcode: leaving it blank shows a red inline message under the box, and the toast that appears when you try to move on names County as a missing field.

Today the receiver County has no rule at all (blank sails through), and the sender's message reads "State is required" instead of "County is required".

## Technical notes

`src/pages/CreateOrder.tsx` only:

- `addressSchema.state`: change message to `"County is required"`.
- In `superRefine`, inside the `if (!data.isBoxMyBike)` receiver block, add alongside the existing street/city/postcode checks:
  `if (!r?.address?.state) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "County is required", path: ["receiver", "address", "state"] })`.
- `handleNextToReceiver`: include `!address?.state` in the address-incomplete branch and reword the toast to "Please complete the sender's address (street, city, county, and postcode are required)."

No change needed in `src/components/AddressForm.tsx` — the County field already renders a `FormMessage`, so it starts displaying the error once the schema produces one.
