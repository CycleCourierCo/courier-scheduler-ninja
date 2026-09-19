# Fix public tracking and vehicle overview layouts

## Tracking page

- Put the public tracking experience back inside the normal site frame so the main navigation/header and company footer appear on both `/tracking` and `/tracking/:id`.
- Keep the tracking reference and order summary prominent inside the page, without duplicating the site heading.
- Replace the current all-events horizontal journey strip with an overflow-safe journey summary designed for the tracking card’s actual width. It will remain readable when inspection, workshop, ferry-partner and Northern Ireland events create a long history.
- Keep the complete chronological event history underneath, including inspection, repair, Box/Foam My Bike, ferry, partner hand-off, collection, delivery, proof photos and signatures.
- Ensure long event titles, dates, descriptions and links wrap cleanly without overlapping or widening the page.
- Preserve postcode verification and all existing tracking data/security behaviour.

## Vehicles page

- Replace the wide ten-column desktop vehicle table and tall mobile cards with one compact responsive vehicle layout: one column on mobile and a denser multi-column grid on larger screens.
- Keep each vehicle’s registration, make/colour, status, purchase date, mileage, tax, MOT, auto-pay flags, refresh state and all four actions visible together without horizontal scrolling.
- Keep the status selector and existing Service, DVLA refresh, Edit and Delete actions unchanged, using compact icon controls with accessible labels/tooltips where space is tight.
- Format tax and MOT dates as friendly UK dates such as `5 Aug 2027`, with clear labels such as `Tax due` and `MOT expires`.
- Hide repetitive positive DVLA status words such as “Taxed” and “Valid”; retain meaningful warning/exception statuses and the existing expired/due-soon emphasis.
- Keep search, status filtering, insurance timeline, insurance tab and sold-vehicle workflow unchanged.

## Verification

- Test tracking with a long inspection and Northern Ireland history at mobile and desktop widths; confirm no overlap, clipped text or horizontal page scroll, and confirm the site header/footer are present.
- Test Vehicles at mobile and desktop widths; confirm every detail and action is visible without horizontal scrolling and the tax/MOT wording is concise.
- Run the production build after the changes.

## Technical notes

- The tracking overlap is caused by rendering every event as a horizontal `JourneyStrip` once the viewport reaches the `sm` breakpoint, even though `DoorstepShell` constrains the content to a narrow `max-w-xl` card. Inspection and Northern Ireland events increase the number of columns until labels collide.
- `TrackingPage` currently renders `DoorstepShell` directly rather than `Layout`, so it has its local signboard but not the site-wide header/footer.
- `VehicleManagement` currently uses an overflow-scrolling ten-column table on desktop and separate vertically stacked cards on mobile. The shared compact card/grid treatment removes the need for sideways scrolling while retaining the same actions and data.
