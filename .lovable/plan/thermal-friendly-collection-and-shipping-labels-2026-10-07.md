# Thermal-friendly collection and shipping labels

## Changes
- Replace the coloured label branding with your supplied full black-on-white thermal header and place it at the top.
- Keep the 4 × 6 label size, with tracking below the header as the largest text, followed by recipient details, bike details and service indicators.
- Use black text and outlined service badges, never reversed or filled badges. Preserve the optional sender name for accounts that request it, collection codes and multi-bike numbering.
- Keep single-order, bulk and loading-page labels consistent, including existing driver separators and pickup-time sorting.
- Remove the duplicate contact footer because the supplied header already includes the website and phone number.
- Keep the screen logo and favicon unchanged: these uploads are separate thermal-print artwork, not replacement screen branding.

## Technical details
- Update the existing shared renderer in `src/utils/labelUtils.ts`, not the different path mentioned in the brief.
- Store the supplied one-bit PNGs as CDN assets and load image data before generating the PDF.
- Use the full 203 dpi artwork at its native four-inch width, preserving its aspect ratio and using no image recompression. Retain the compact variant for overflow cases instead of shrinking text or stretching the header.
- Wrap long names, addresses and bike descriptions; check available space before rendering to avoid overlapping or clipping.
- No new QR workflow is included: the diagram is treated as layout guidance, with existing label data preserved.

## Verification
- Generate and visually inspect every page of representative single, multi-bike and driver-grouped PDFs, including long addresses, sender-name opt-in and all service flags.
- Confirm the artwork is one-bit, proportions are correct, and application checks report no errors.
- Physical print quality remains unverified until a sample is printed on your actual printer at 100% size; use the supplied printer-setting guidance.