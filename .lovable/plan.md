

## Show Delivery Instructions, Sender/Receiver Notes, and Admin Comments in Timeslot Edit Dialog

### Problem
The `OrderData` interface in `JobScheduling.tsx` doesn't include `delivery_instructions`, `sender_notes`, or `receiver_notes` fields, so they're never fetched from the database. Admin comments live in a separate `order_comments` table and aren't fetched either. The `TimeslotEditDialog` tries to show notes but the data is always `null`.

### Changes

**1. `src/pages/JobScheduling.tsx`**
- Add `delivery_instructions`, `sender_notes`, `receiver_notes` to the `OrderData` interface
- These fields already exist on the `orders` table and are returned by the `select('*')` query, they just aren't typed

**2. `src/components/scheduling/TimeslotEditDialog.tsx`**
- Extract and display all relevant notes:
  - **Delivery Instructions** — always shown if present (`orderData.delivery_instructions`)
  - **Sender Notes** — shown for pickup jobs (`orderData.sender_notes`)
  - **Receiver Notes** — shown for delivery jobs (`orderData.receiver_notes`)
- Each note type gets its own labeled block with the existing muted background styling
- Remove the single combined `notes` variable and replace with individual note sections

**3. Admin Comments** — These are in a separate `order_comments` table. Fetching them would require a join or separate query per order. For now, we'll skip admin comments to keep this simple and focus on the three fields that are already on the orders table. If you want admin comments too, we can add that as a follow-up.

### Summary
- 2 files changed
- No database changes
- Delivery instructions, sender notes, and receiver notes will all display in the timeslot popup when present

