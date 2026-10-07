# Restore service icons on thermal labels

## Fix
Keep the new black-on-white thermal header and restore the service indicators used before the redesign:

- **Inspection:** the existing repair/spanner icon.
- **Box My Bike:** the existing box icon.
- **Northern Ireland:** the original outlined **NI** symbol.

Show every applicable indicator together when an order has multiple services. Do not replace them with the current `INSPECTION`, `BOX MY BIKE`, and `NI` text badges.

## Technical details
- Update the shared label renderer so single, bulk, loading-page, and driver-grouped labels all receive the same fix.
- Preload the existing monochrome icon artwork with the thermal header before PDF rendering, avoiding unreliable image loading during generation.
- Render the icons in black at a thermal-printer-readable size, preserving their proportions and the existing 4 × 6 layout.
- Include the indicator row in the label-height calculation so long labels still switch to the compact header without clipping.
- Retain safe fallback behaviour: if an image cannot load, generation continues with an outlined text marker rather than failing the entire PDF.

## Verify
Generate representative labels for NI-only, inspection-only, Box My Bike-only, and an order with all three indicators. Check single and bulk output for visible icons, correct spacing, and no overlap or clipping.
