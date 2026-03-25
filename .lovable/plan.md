

## Fix CSV Parsing for Dealer Spreadsheets with Empty Rows/Columns

### Problem
The uploaded CSV has:
1. **Two empty rows** at the top (just commas)
2. **An empty first column** — every row starts with a comma, so the header row is `,Order Number,Dealer Name,...` rather than `Order Number,Dealer Name,...`

The current parser takes `lines[0]` as the header row, which is all empty cells, so no headers are detected and parsing fails.

### Changes

**`src/services/bulkOrderService.ts` — CSV parsing branch**

1. After splitting lines and filtering truly blank lines, **find the actual header row** by scanning for the first line that contains known dealer column names (e.g., "order number", "dealer name") or standard template headers
2. Use that line index as the header row; all subsequent lines are data rows
3. After parsing each line into columns, **strip empty leading columns** — detect if the first N columns are consistently empty across header + data rows and remove them
4. Filter out data rows where all mapped values are empty (handles trailing blank rows)

This is a small, targeted fix in the CSV `reader.onload` handler — no changes needed to the XLSX path (SheetJS already handles empty rows/columns), the grouping logic, or the UI.

