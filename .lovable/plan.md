

## Move Load Route Button to Route Builder Header

Add the "Load Route" button alongside the existing "Upload Route" (CSVUploadButton) and "Compare Routes" (MultiCSVUploadButton) buttons in the Route Builder's filter section.

---

## Change Required

### File: `src/components/scheduling/RouteBuilder.tsx`

**Location:** Lines 2324-2336 (filter section)

Add a new button after the MultiCSVUploadButton:

### Current Code:
```tsx
{/* CSV Upload Button */}
<CSVUploadButton 
  onFileSelect={handleCsvFileSelect}
  isLoading={isProcessingCsv}
  disabled={isProcessingCsv}
/>

{/* Multi-CSV Comparison Button */}
<MultiCSVUploadButton
  onFilesSelect={handleMultiCsvUpload}
  isLoading={isAnalyzingRoutes}
  disabled={isAnalyzingRoutes}
/>

{/* Results Count */}
<div className="ml-auto">
```

### Updated Code:
```tsx
{/* CSV Upload Button */}
<CSVUploadButton 
  onFileSelect={handleCsvFileSelect}
  isLoading={isProcessingCsv}
  disabled={isProcessingCsv}
/>

{/* Multi-CSV Comparison Button */}
<MultiCSVUploadButton
  onFilesSelect={handleMultiCsvUpload}
  isLoading={isAnalyzingRoutes}
  disabled={isAnalyzingRoutes}
/>

{/* Load Saved Route Button */}
<Button
  variant="outline"
  onClick={() => setShowLoadRouteDialog(true)}
  className="flex items-center gap-2"
>
  <FolderOpen className="h-4 w-4" />
  Load Route
</Button>

{/* Results Count */}
<div className="ml-auto">
```

---

## Also: Remove Load Route from Timeslot Popup

Since the Load Route button is moving to the header, it should be removed from the timeslot popup (both mobile and desktop views) to avoid duplication.

### Mobile Drawer (around line 2591):
Remove the Load Route button from the mobile drawer.

### Desktop Dialog (around line 2710):
Remove the Load Route button from the desktop dialog.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/scheduling/RouteBuilder.tsx` | Add Load Route button to filter section (line ~2337), remove from mobile drawer and desktop dialog |

---

## Expected Result

The filter section will now show:
```text
Filters: [Available on: Date] [Collected toggle] [Upload Route] [Compare Routes] [Load Route]    [X of Y jobs]
```

This places all route management actions (upload, compare, load) together in a logical grouping.

