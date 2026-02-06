
# Move Track Order Button Inside Info Box

## Overview

Reorganize the availability confirmation email to:
1. Move the "Track Order" button inside the grey info box, below the tracking number
2. Remove the "You can track your order's progress:" text
3. Change the Track Order button color from grey (`#6b7280`) to blue (`#4a65d5`) to match the Confirm Availability button

## Current Structure

```
┌─────────────────────────────────────┐
│ Grey Box                            │
│   Item Name (Quantity: X)           │
│   Tracking Number: CCC-XXX          │
└─────────────────────────────────────┘

   [Confirm Availability Button - Blue]

   "You can track your order's progress:"
   [Track Order Button - Grey]
```

## New Structure

```
┌─────────────────────────────────────┐
│ Grey Box                            │
│   Item Name (Quantity: X)           │
│   Tracking Number: CCC-XXX          │
│   [Track Order Button - Blue]       │
└─────────────────────────────────────┘

   [Confirm Availability Button - Blue]
```

## Technical Changes

**File**: `supabase/functions/send-email/index.ts`

### 1. Remove the separate tracking section variable (lines 96-104)

Delete the `trackingSection` variable that creates the standalone button with grey styling.

### 2. Update the grey info box (lines 111-114)

Add the Track Order button inside the box with matching blue color:

```html
<div style="background-color: #f7f7f7; padding: 15px; border-radius: 5px; margin: 20px 0;">
  <p><strong>${item.name}</strong> (Quantity: ${item.quantity})</p>
  ${trackingNumber ? `
    <p><strong>Tracking Number:</strong> ${trackingNumber}</p>
    <div style="text-align: center; margin-top: 15px;">
      <a href="${trackingUrl}" style="background-color: #4a65d5; color: white; padding: 10px 16px; text-decoration: none; border-radius: 5px;">
        Track Order
      </a>
    </div>
  ` : ''}
</div>
```

### 3. Remove the trackingSection insertion (line 123)

Remove `${trackingSection}` from the HTML template.

### 4. Update plain text version (line 138)

Keep the tracking URL in the text version but simplify the format.

## Summary

| Change | Before | After |
|--------|--------|-------|
| Track Order location | Separate section below box | Inside the grey info box |
| Track Order color | Grey (`#6b7280`) | Blue (`#4a65d5`) |
| "You can track..." text | Present | Removed |
