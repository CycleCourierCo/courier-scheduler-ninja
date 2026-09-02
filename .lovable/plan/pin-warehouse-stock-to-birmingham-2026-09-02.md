# Pin warehouse stock to Birmingham

## Answer: B2B access to Warehouse Stock

B2B customers do **not** have access to the Warehouse Stock page. Access control shows `warehouse-stock` set to not-allowed for the B2B customer role (admin-only page), and database access rules restrict a customer to only the stock rows they own. Customers see their inventory through the separate **My Stock** page instead. No change needed here.

## What changes

Warehouse stock lives only at the Birmingham depot for now, so the depot switcher disappears from the stock screens and everything is pinned to Birmingham.

- **Warehouse Stock page:** remove the depot tab strip; always operate against the Birmingham depot (adding stock, bay lists, conflict checks, receive-stock bays).
- **Build My Bike page:** remove the depot tab strip for staff; builds and part reservations are pinned to Birmingham.
- The Scotland Depot record stays in the database and remains available on Trunk Runs, Storage Bays and Equipment — nothing else is touched.

## Technical notes

- `src/pages/WarehouseStockPage.tsx`: drop the `siteId` state and `<Tabs>` site selector; resolve the site once via the Birmingham site code (`BHM`) using `findSite`, falling back to `defaultSite`. Keep passing that id into `getWarehouseStock`, `useStorageBays`, `checkLocationConflict`, `addWarehouseStock` and `ReceiveStockDialog`.
- `src/pages/BuildMyBikePage.tsx`: same treatment for the staff site tabs; `activeSiteId` becomes the Birmingham site id for staff, `null` for customers as today.
- No database migration, no RLS change, no change to `sites` rows or `ReceiveStockDialog`'s props.
