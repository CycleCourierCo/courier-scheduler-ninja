# Book orders on behalf of a customer, and change an order's owner

## What changes

**Create Order page (admins and customer service)**
- A new **Book for account** box at the top of the form. Search by name, company or email, then pick the customer. It defaults to "My own account".
- Once a customer is picked, the order is saved under their account. That means:
  - it appears in their order list;
  - it uses their prices (account rates, big-bike rate);
  - it goes on their weekly invoice;
  - their address book is offered for sender and receiver.
- Booking for a business account that hasn't been approved yet is blocked, the same as if the customer booked it themselves.
- Each order records who actually booked it (for example "Booked by Jane (customer service)"). This shows on the order page.

**Order page (admins only)**
- A new **Change owner** button opens a pop-up with the same customer search, plus a confirm step.
- The order moves to the new account and the change is noted in the order's history.
- Invoices already raised are not changed. A warning appears if the order has already been invoiced.

## Technical details
- Migration: add `orders.booked_by_id uuid` and `booked_by_name text`. Update the orders INSERT policy so that admin and cs_agent may insert with any `user_id`. Customers stay limited to `auth.uid() = user_id`, which sets `booked_by_id` to themselves.
- `createOrder` in `orderService.ts` takes an optional `onBehalfOfUserId`. It inserts with that `user_id` and loads the owner's profile name/email instead of the current user's. Pricing lookups switch to the owner's id.
- `CreateOrder.tsx`: an account picker (searching profiles) shown when `hasRole` is admin or cs_agent. `useContacts` and the rate lookups are keyed to the chosen owner.
- `OrderDetail.tsx`: an admin-only Change owner dialog. It updates `user_id` (the existing admin update policy allows this) and adds an `order_update_log` entry.
- Ownership on insert comes from the signed-in session check in the database policy. A non-staff user cannot book into someone else's account.
- Signed-in end-to-end testing isn't possible on this project, so that path will be marked unverified.
