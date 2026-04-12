

## Fix: Revenue undercounted due to driver name mismatch

### Problem
`getRevenueForTimeslip` and `calculateTotalJobsFromDriverDate` match orders using only `shipday_driver_name` (e.g., "Abs") with exact string equality. Orders assigned under the driver's full name "Abdullah Hussain " (with trailing space) are completely missed. This causes revenue to show only ~£140 (4 orders) instead of the correct total for all 15 jobs.

### Fix (single file: `src/services/profitabilityService.ts`)

**1. `getRevenueForTimeslip` (line 276):**
- Build a `Set` of name variants from `timeslip.driver.shipday_driver_name` and `timeslip.driver.name`, both trimmed
- Filter orders where trimmed `collection_driver_name` or `delivery_driver_name` matches any variant

**2. `calculateTotalJobsFromDriverDate` (line 149):**
- Accept an optional `driverFullName` parameter
- Use the same trimmed multi-name matching logic

**3. `getTotalJobs` (line 205):**
- Pass `timeslip.driver.name` as the second argument to `calculateTotalJobsFromDriverDate`

### What this fixes
- All orders for a driver are found regardless of whether "Abs" or "Abdullah Hussain " was used
- Trailing spaces are handled automatically via `.trim()`
- Revenue correctly reflects all bike types and quantities across all matched orders
- No database changes needed

