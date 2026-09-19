# Implement the new Cycle Courier Co. identity

## Scope
Replace the retired green/blob branding across the live digital product with the supplied road-C identity. Preserve all workflows, permissions, wording, data, and integrations.

## Implementation

1. **Prepare the supplied logo suite**
   - Add the supplied horizontal, stacked, reversed, plated, solid, favicon, and label-header artwork through the project’s asset flow.
   - Use the dashed mark only at 48px and above, and the solid mark below 48px, as required by the brand book.
   - Preserve each asset’s geometry, aspect ratio, clear space, and colours; do not redraw, recolour, rotate, shadow, or crop the mark.

2. **Replace portal and website branding**
   - Replace the temporary truck-circle/text treatment in the shared top bar with the horizontal lockup at a legible desktop size and the solid road-C plus compact wordmark treatment on mobile.
   - Replace the existing image in the collapsible internal sidebar, using the solid road-C when collapsed and the horizontal lockup when expanded.
   - Add the appropriate lockup to the shared footer without changing its company, contact, legal, or navigation content.
   - Replace the externally hosted legacy mark on the About page with the supplied local brand artwork.
   - Ensure light and dark modes use the supplied normal/reversed variants with suitable contrast and no layout shift or navigation overlap.

3. **Browser and device identity**
   - Replace the old browser favicon with the supplied favicon package.
   - Add the supplied SVG/PNG icon variants, Apple touch icon metadata, and a minimal web app manifest for the supplied 192px, 512px, and maskable icons, while keeping the existing page title and description.
   - Keep the startup/loading fallback lightweight and readable if application files are blocked.

4. **Emails and announcements**
   - Add the reversed horizontal wordmark to the shared motorway-blue email header, retaining the current portal-matched palette and content structure.
   - Update announcement and scheduled-announcement email headers so they no longer reference the retired logo URL.
   - Use an absolute, publicly reachable image URL suitable for Gmail, Outlook, and Apple Mail, with dimensions and alt text that degrade cleanly when images are blocked.
   - Preserve the current email security hardening, plain-text conversion, recipients, triggers, and wording.

5. **Labels and printed operational documents**
   - Replace the square legacy image in generated labels with the supplied 4×6 label-header treatment, preserving tracking, address, service-flag, and QR information.
   - Add the appropriate wordmark to the printable trunk manifest header without changing manifest data or print behaviour.
   - Keep print artwork flat, high contrast, and white-background compatible.

6. **Retire obsolete digital assets**
   - Remove references to `cycle-courier-logo.png` and other superseded logo files after every live use has moved to the new suite.
   - Keep operational truck icons that describe vehicles, transport, or actions; only replace icons currently acting as the company mark.
   - Do not add the van-livery mock-up to the app or change actual vehicle livery; it remains production reference artwork.

## Validation
- Check the shared header, footer, and internal sidebar at mobile and desktop widths in both light and dark modes.
- Verify there is no horizontal overflow, squashed wordmark, blurred small mark, or cumulative layout shift.
- Verify favicon/browser icon loading and all new asset URLs.
- Generate a sample label and trunk manifest to confirm print sizing and legibility.
- render representative customer, partner, announcement, and report emails to confirm the logo displays and the plain-text fallback remains clean.
- Run the project checks and confirm no old digital logo references remain.

## Technical notes
- The existing portal already uses the supplied Motorway Blue, Tarmac, Daylight, Chevron, Overpass, Overpass Mono, and 6px-radius system, so this is an identity-asset rollout rather than another theme rewrite.
- SVG lockups contain live text; browser use is safe as supplied. Physical fabrication and trademark registration are outside this implementation.
