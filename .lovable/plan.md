## Goal
Rewrite the worst user-facing error and validation messages so each one is:
- **Specific** — names the exact field or thing that's wrong
- **Constructive** — tells the user how to fix it
- **Human** — friendly, no jargon, no error codes, no "Unknown error"

I audited ~200 error/validation strings across `src/`. Below are the worst offenders grouped by area, with the proposed rewrite for each. Console-only logs (`console.error(...)`) are left alone — this plan targets strings the user actually sees (toasts, form errors, thrown errors that surface to toasts).

## Files that will change

1. `src/lib/notify.ts` — generic fallback
2. `src/components/auth/LoginForm.tsx`, `RegisterForm.tsx`, `ResetPasswordForm.tsx` — zod schemas + toasts
3. `src/contexts/AuthContext.tsx` — sign-in / sign-up / sign-out toasts
4. `src/components/webhooks/CreateWebhookDialog.tsx` + `src/pages/WebhookConfigPage.tsx`
5. `src/pages/WarehouseStockPage.tsx`
6. `src/pages/VehicleManagement.tsx` + `src/components/vehicles/PolicyDialog.tsx` + `VehicleMaintenanceDialog.tsx`
7. `src/pages/UserManagement.tsx` + `src/pages/UserProfile.tsx`
8. `src/pages/StorageBaysPage.tsx`
9. `src/pages/ShopifyIntegrationPage.tsx`
10. `src/pages/OrderDetail.tsx`
11. `src/pages/HolidaysPage.tsx`
12. `src/services/shipdayService.ts` (user-facing toast + thrown message)
13. `src/services/availabilityService.ts` (fetch toasts)
14. `src/services/bulkOrderService.ts` (row validation messages)

## Worst offenders → rewrites

### Auth — vague zod messages
`src/components/auth/LoginForm.tsx`, `RegisterForm.tsx`
- `"Invalid email address"` → `"Enter an email like name@example.com"`
- `"Password must be at least 6 characters"` → `"Use at least 6 characters — mix letters and numbers for a stronger password"`
- `"Name is required"` (min 2) → `"Enter your full name (2+ characters)"`
- `"Address line 1 is required"` → `"Enter the first line of your address (e.g. 12 High Street)"`
- `"City is required"` → `"Which city or town is this address in?"`
- `"Postal code is required"` → `"Enter your postcode (e.g. SW1A 1AA)"`
- `"+44 followed by at least 10 digits"` → `"Enter a UK mobile like +447700900123"`
- `"Confirm password is required"` → `"Re-type the password above to confirm"`
- Toast `"Failed to register. Please try again."` → `"We couldn't create your account. Check your details and try again — or contact info@cyclecourierco.com if this keeps happening."`

### AuthContext toasts — jargon + blame
`src/contexts/AuthContext.tsx`
- `"Error signing in"` → `"Sign-in failed. Double-check your email and password, then try again."`
- `"Error signing up"` → `"We couldn't finish creating your account. Please try again in a moment."`
- `"Error signing out"` → `"Sign-out didn't complete. Refresh the page and try again."`
- `"Failed to create business account - no data returned"` → `"Your business account didn't save. Please try again — if this keeps happening, email info@cyclecourierco.com."`
- Suspended: keep, add contact link: `"Your account is suspended. Email info@cyclecourierco.com to get it reinstated."`
- LoginForm timeout `"Sign in is taking too long. Please try again."` → `"Sign-in is taking longer than usual. Check your connection and try again."`
- `"Please enter your email address first"` (reset) → `"Type your email in the field above so we know where to send the reset link."`

### Webhooks
`src/components/webhooks/CreateWebhookDialog.tsx`, `src/pages/WebhookConfigPage.tsx`
- `"Please fill in all fields and select at least one event"` → `"Add a name, an endpoint URL and tick at least one event to listen for."`
- `"Please select a customer"` → `"Pick which customer this webhook belongs to."`
- `"Endpoint URL must use HTTPS"` → `"Endpoint URL must start with https:// — http endpoints aren't accepted for security."`
- `"Please enter a valid URL"` → `"That doesn't look like a URL. Use the full address, e.g. https://api.example.com/webhooks/orders"`
- `"Failed to create webhook"` → `"Couldn't save the webhook. Check the URL is reachable and try again."`
- `"Failed to fetch customers"` → `"Couldn't load your customer list. Refresh the page to try again."`
- `"Failed to fetch webhooks"` → `"Couldn't load your webhooks. Refresh the page to try again."`
- `"Failed to revoke webhook"` → `"Couldn't revoke this webhook. Try again in a moment."`

### Warehouse stock
`src/pages/WarehouseStockPage.tsx`
- `"Please select a customer"` → `"Pick which customer this bike belongs to before saving."`
- `"Please select a storage location"` → `"Choose a bay and position so warehouse staff can find it."`
- `"Failed to add stock"` → `"Couldn't add the bike to stock. Check the details and try again."`
- `"Failed to load warehouse stock"` → `"Couldn't load warehouse stock right now. Refresh the page to try again."`
- `"Failed to remove stock"` → `"Couldn't remove this bike. Refresh and try again."`
- Bay-occupied message: keep — already specific.

### Vehicles
`src/pages/VehicleManagement.tsx`, `src/components/vehicles/PolicyDialog.tsx`
- `"Sold date and mileage are required"` → `"Enter the date the vehicle was sold and its final mileage so records stay accurate."`
- Policy `"Vehicle, insurer, start and end date are required"` → `"Fill in the vehicle, insurer, start date and end date before saving the policy."`
- Policy `"End date must be after start date"` → `"The policy end date needs to be after its start date."`
- Wrap the raw `(e as Error).message` catches in a friendlier default: `notify.error("Couldn't save vehicle", e)` (uses notify's auto-description).

### User management
`src/pages/UserManagement.tsx`
- `"Please fill in all fields"` → `"Fill in the name, email and role before creating this user."`
- `"User must have at least one role"` → `"Every user needs at least one role — pick one before saving."`
- `"Failed to fetch users"` → `"Couldn't load users. Refresh the page to try again."`
- `"Failed to update role"` / `"Failed to update roles"` → `"Couldn't update this user's roles. Try again in a moment."`
- `"Failed to update user"` → `"Couldn't save changes to this user. Try again in a moment."`
- `"Failed to delete user"` → `"Couldn't delete this user — they may still have orders or timeslips linked."`
- `"Failed to link carrier to driver"` → `"Couldn't link this Shipday carrier to the driver. Check the name matches and try again."`
`src/pages/UserProfile.tsx`
- `"Failed to update profile"` → `"Couldn't save your profile changes. Check the highlighted fields and try again."`
- `"Please fill in all required fields correctly (N errors)"` → `"There ${n===1?'is':'are'} ${n} field${n===1?'':'s'} to fix — scroll up to see what's highlighted in red."` (keeps count, adds direction)

### Storage bays
`src/pages/StorageBaysPage.tsx`
- `"Label is required"` → `"Give this bay a short label so staff can find it (e.g. A1 or Rack-3)."`
- `"Positions must be 1–100"` → `"Enter a bay size between 1 and 100 positions."`
- `"Failed to save bay"` → `"Couldn't save this bay. Try again in a moment."`
- `"Failed to reorder"` → `"Couldn't reorder the bays. Refresh and try again."`

### Shopify integration
`src/pages/ShopifyIntegrationPage.tsx`
- `"All fields required"` → `"Fill in your shop domain and both API keys before saving."`
- `"Enter shop domain and access token first"` → `"Type your shop domain and access token above, then run the test."`
- `` `Test failed: ${msg || "Unknown error"}` `` → `` `Couldn't reach Shopify: ${msg || "double-check the shop domain and access token"}` ``
- `"Failed to disconnect"` → `"Couldn't disconnect your Shopify store. Try again in a moment."`

### Orders
`src/pages/OrderDetail.tsx`
- `"Please select pickup date"` → `"Pick a collection date before scheduling."`
- `"Please select delivery date"` → `"Pick a delivery date before scheduling."`
- `"Delivery date must be after the pickup date"` → `"Delivery has to happen on or after the collection date — please adjust one of them."`
- `"Order ID is missing"` → `"We've lost track of this order. Refresh the page and try again."`
- `` `Failed to schedule pickup: ${msg}` `` → `` `Couldn't schedule the collection: ${msg}` `` (drop "Unknown error" fallback in favour of `"please try again"`)
- Same for delivery.
- `'Failed to save: ' + error.message` → `` `Couldn't save your changes — ${error.message}` ``

### Holidays
`src/pages/HolidaysPage.tsx`
- `"Failed to load holidays"` / `"Failed to load allowed Fridays"` → `"Couldn't load holidays. Refresh the page to try again."` / `"Couldn't load allowed Fridays. Refresh the page to try again."`
- `"Failed to remove holiday"` / `"Failed to remove"` → `"Couldn't remove this holiday. Try again in a moment."` / `"Couldn't remove this date. Try again in a moment."`

### Shipday service (surfaces to toast)
`src/services/shipdayService.ts`
- toast `"Failed to sync orders to Shipday"` → `"Couldn't sync orders to Shipday. Check the Shipday connection and retry."`
- thrown `"Unknown error creating Shipday orders"` → `"Shipday didn't accept these orders — please retry from the Dispatch page."`

### Availability fetch toasts
`src/services/availabilityService.ts`
- `"Failed to fetch sender availability."` → `"Couldn't load the sender's available dates. Refresh the page to try again."`
- `"Unexpected error fetching sender availability."` → `"Something got in the way of loading sender availability. Refresh to retry."`
- Same wording pattern for receiver variants.

### Bulk upload row validation
`src/services/bulkOrderService.ts`
- `"Receiver name is required"` → `"Receiver: add a contact name."`
- `"Receiver street is required"` → `"Receiver: add a street address."`
- `"Receiver postcode is required"` → `"Receiver: add a postcode."`
- `"Invalid email format"` → `"Receiver email doesn't look right — use format name@example.com."`
- row-level `"Unknown error"` → `"Import failed for this row. Check the highlighted fields and re-upload."`

### notify helper fallback
`src/lib/notify.ts`
- `"Something went wrong"` fallback → `"Something didn't work. Please try again in a moment."`

## Guardrails / out of scope

- I will not touch **`console.error`/`console.warn`** strings — those are dev-only.
- I will not touch **thrown internal errors** that never bubble to the UI (routing service, tracking service internals, orderServiceUtils null-guard, contexts' `useAuth`/`useTheme` invariants).
- No new components, no new libraries, no logic changes — copy edits only.
- Placement of messages is already correct (form-inline errors stay inline via zod, action failures stay in toast). No move needed.

## Deliverable to you after implementation

A short recap listing each file touched with the before → after diff of the strings, so you can eyeball the rewritten copy in one place.
