

## Show Driver Info & Editable Notes on Order Detail

### What changes

**1. Add Driver Assignment section to OrderDetail page**
- Display `collection_driver_name` and `delivery_driver_name` in a new section visible to admin and route_planner roles
- Show between the scheduled dates and the scheduling buttons area
- Simple two-column layout: "Collection Driver" and "Delivery Driver" with the name or "Not assigned"

**2. Add editable Delivery Instructions & Notes section**
- Add a new card/section on the OrderDetail page (visible to admin/route_planner) showing:
  - **Delivery Instructions** (`delivery_instructions`) - editable textarea
  - **Sender Notes** (`sender_notes`) - editable textarea  
  - **Receiver Notes** (`receiver_notes`) - editable textarea
- Each field has an inline edit button; clicking saves directly to the database via Supabase update
- Non-admin users see these as read-only text (already partially handled via ContactDetails for sender/receiver notes)

### Files changed

**`src/pages/OrderDetail.tsx`**
- After the scheduled dates section (~line 1202), add a "Driver Assignment" display block showing `order.collection_driver_name` and `order.delivery_driver_name`
- Before the contacts section, add an editable "Notes & Instructions" section with three textareas for `deliveryInstructions`, `senderNotes`, `receiverNotes` — each with a Save button that updates the order in Supabase

### No database changes needed
All fields (`collection_driver_name`, `delivery_driver_name`, `sender_notes`, `receiver_notes`, `delivery_instructions`) already exist on the `orders` table.

