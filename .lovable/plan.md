

## Remove Prices from Bike Type Reference Table

Remove the price column from the bike types table on the API documentation page.

### Changes

**`src/pages/ApiDocumentationPage.tsx`** (lines 289-318):
- Remove the "Price" table header
- Remove `price` from each bike type object
- Remove the price `<td>` cell from the row rendering

