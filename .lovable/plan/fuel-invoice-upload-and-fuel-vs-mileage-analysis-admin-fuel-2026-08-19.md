# Fuel invoice upload and fuel-vs-mileage analysis (admin, Fuel Finder)

Add an admin-only "Fuel invoices" area on the Fuel Finder page where weekly WEX/Esso invoice PDFs are uploaded, parsed into transactions, checked against the vehicle fleet, and compared with timeslip mileage to produce MPG, cost per mile, and fraud flags.

## What the invoices contain

The attached WEX invoices are text-based PDFs with a consistent "Transaction detail" table:

```text
Trx Ref   Trx date  time   Site name and town      Vehicle ID   Odo    Product        Zone  Quantity  Unit price  Net   VAT%  VAT   Gross
00396732  09.08.26  09:21  365001RSS MOSELEY       KW65ULZ         5   Energy Diesel  CN    77.49     1.4304      110.84 20%  22.17 133.01
...
706405*********0100 KW65 ULZ   ESSO    Total card: 522.11 ...
```

Plus a header block with account number, invoice number, invoice date, due date, and totals. Real data quirks already visible in the samples that the parser and matching must handle: typo'd registrations (`AV66UT`, `AV66UYH` vs `AV66UTH`; `WP10NVO` vs `WP10NVL`), a card label that doesn't match its transactions (`MD71 FDX` card containing `AV66UTH` fills), junk odometer readings (`2`, `11`, `123`), and two products (`Energy Diesel`, `Energy Sup Diesel`).

## Upload and parsing

- New card on `/fuel-finder`, admin only: drop one or more invoice PDFs.
- PDFs are stored in a private `fuel-invoices` storage bucket (admin-only read/write).
- Text is extracted in the browser with `pdfjs-dist`, then parsed with a WEX-format parser: header fields plus every transaction row and card-total row.
- A review step shows parsed header totals vs the sum of parsed rows (so a mis-parse is caught before saving), a row count, and each row with its matched vehicle. Admin confirms to save.
- Duplicate protection: invoice number is unique, and re-uploading the same invoice offers to replace its transactions.

## Registration matching

- Each transaction's Vehicle ID is normalised (uppercase, spaces stripped) and matched against `vehicles.registration`.
- Unmatched rows are listed in a "Registrations not matching the fleet" panel, with a closest-match suggestion (edit distance) and two actions: map to a fleet vehicle (saved as a reusable alias so future invoices auto-match) or leave unmatched/ignore.
- Card-level labels are also normalised and flagged when a card's label doesn't match the registrations charged to it.

## Fuel vs mileage analysis

For a chosen period (defaults to the uploaded invoice week; also selectable as custom range / all time), per vehicle:

- Litres purchased, net and gross spend, number of fills, average price per litre.
- Miles driven from approved timeslips (`timeslips.mileage` summed by `vehicle_id` and `date` inside the period).
- MPG = miles / (litres / 4.54609), plus L/100km.
- Cost per mile (net and gross).
- Fleet totals and a per-vehicle comparison table plus a bar chart of MPG and cost per mile, so outliers are obvious.

### Fraud / anomaly flags

- Registration not in fleet, or reg mapped by alias only.
- Fuel purchased for a vehicle with zero approved timeslip mileage in the period.
- MPG outside a configurable expected band (default 15–45 mpg) — too low suggests fuel going elsewhere, impossibly high suggests missing fills or inflated mileage.
- Two or more fills for the same vehicle within a short window (default 12 hours), and fills at sites far apart on the same day where the timeslip shows no such route.
- Litres exceeding a configurable tank capacity per fill.
- Fills on days with no timeslip at all for that vehicle (weekend/out-of-hours fuelling).

Each flag row links to the vehicle and, where relevant, the timeslip date, and can be dismissed with a note so it stops re-appearing.

## Technical notes

- New tables (with grants + RLS, admin-only via `has_role`/`is_admin`):
  - `fuel_invoices` — supplier, account_number, invoice_number (unique), invoice_date, due_date, currency, net/vat/gross totals, file_path, parsed_row_count, uploaded_by, created_at.
  - `fuel_transactions` — invoice_id, trx_reference, trx_at (date + time), site_name, raw_vehicle_id, normalised_reg, vehicle_id (nullable FK to vehicles), card_label, odometer, product, quantity_litres, unit_price, net_amount, vat_rate, vat_amount, gross_amount.
  - `fuel_vehicle_aliases` — normalised_alias (unique), vehicle_id, created_by.
  - `fuel_anomaly_dismissals` — scope key (vehicle + period + rule), note, dismissed_by.
  - `fuel_analysis_settings` — single row: expected MPG min/max, max litres per fill, duplicate-fill window hours.
- New storage bucket `fuel-invoices` (private) with admin-only policies.
- New `src/services/fuelInvoiceService.ts` (parse + persist + query) and `src/lib/wexInvoiceParser.ts` (pure text-to-rows parser, unit-testable against the sample layout).
- New components under `src/components/fuel/`: `FuelInvoiceUploadCard`, `FuelInvoiceReviewDialog`, `UnmatchedRegistrationsPanel`, `FuelVsMileagePanel`, `FuelAnomalyList`, mounted in an admin-only section of `src/pages/FuelFinderPage.tsx`.
- Adds `pdfjs-dist` as a dependency for client-side text extraction; no external API needed.
- Analysis reuses the existing paginated timeslip mileage query pattern so the 1000-row limit doesn't truncate totals.
