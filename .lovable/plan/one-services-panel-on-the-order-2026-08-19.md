# One "Services" panel on the order

Right now the four add-on controls are scattered: Box My Bike conversion and Inspect & Service sit inside Item Details, while Northern Ireland and Guaranteed Delivery sit in separate admin blocks further down the page. Bring all four into a single panel.

## What you'll see

A new admin-only **Services & Add-ons** card, placed directly after Item Details / Tracking, with four rows — one per service:

- **Box My Bike** — status badge (on/off, current stage), convert to/from Box My Bike.
- **Inspect & Service** — status badge (not inspected / inspection enabled / inspection status), enable inspection, create inspection invoice.
- **Northern Ireland** — badge for detected region and direction, plus the existing NI editor controls (foam stage, ferry email resend, etc.).
- **Guaranteed delivery date** — badge for guaranteed / not set, plus the existing card contents (payer, amount, note, invoice link, edit/remove).

Each row shows a one-line summary with its badge and expands to reveal the full controls, so all four are visible at a glance without a wall of forms. On mobile the rows stack full width.

## What is removed from elsewhere

- Box My Bike conversion button and the Inspect & Service / inspection-invoice buttons are removed from Item Details (the informational "Box My Bike order" / "will be inspected and serviced" lines stay there for non-admins).
- The standalone Northern Ireland and Guaranteed Delivery blocks near the bottom are removed.

## Technical notes

- New `src/components/order-detail/OrderServicesPanel.tsx` — a card of four collapsible sections (shadcn `Accordion` or `Collapsible` + `Badge`), rendered from `src/pages/OrderDetail.tsx` for admins only, right after the Item Details / Tracking grid.
- Reuses existing components unchanged: `BoxMyBikeConversion`, `NorthernIrelandEditor`, `GuaranteedDeliveryCard` (rendered without their own outer card chrome where they duplicate it).
- Inspect & Service handlers (`enableInspectionForOrder`, `createInspectionServiceInvoice`) move from `ItemDetails.tsx` into a small `InspectServiceSection` inside the new panel; no service-layer changes.
- Presentation only — no database, edge function, or business-logic changes.
