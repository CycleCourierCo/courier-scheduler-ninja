

## Hide Cancelled Orders from Bicycle Inspections Page

### Changes

**`src/services/inspectionService.ts`** — Add `.neq('status', 'cancelled')` filter to both query functions:

1. `getPendingInspections()` (line ~120): Add `.neq('status', 'cancelled')` after `.eq('needs_inspection', true)`
2. `getMyInspections()` (line ~165): Add `.neq('status', 'cancelled')` after `.eq('needs_inspection', true)`

This excludes cancelled orders from both admin and customer inspection views.

