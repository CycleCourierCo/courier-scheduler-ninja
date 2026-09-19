# Implement the Cycle Courier Co. redesign

Implement `ccc-design.md` v1.1 and `ccc-wireframes.md` v1.0 across the full application. Preserve existing permissions, data, integrations, and business workflows; this is a comprehensive presentation and interaction redesign, not a feature rewrite.

## 1. Establish the road-sign design system

- Replace the current green, gradient, glass and large-radius theme with the supplied daylight/tarmac/motorway-blue tokens in light and night-shift themes.
- Add the complete semantic status, urgency and eight-segment palettes, then map them through Tailwind and the shared UI components.
- Load Overpass and Overpass Mono correctly, applying mono only to operational data such as references, postcodes, timeslots, registrations and API keys.
- Reduce the radius to 6px, remove glow/shine/float/hover-lift effects, and retain only the specified route-draw, van-slide, accordion and short transition motion.
- Rebuild Button, Badge and StatusBadge variants around semantic tokens; add the 56px doorstep action and remove the legacy premium/glass treatments.
- Add reusable signboard, chevron-alert, slot block, journey strip/mini-strip, order-row and room-density primitives. Respect reduced motion and keep tokenised pages and print output permanently light.

## 2. Rebuild the shared application frame

- Restyle the notice bar, header, role-aware desktop links, grouped admin menu, mobile sheet and footer exactly to the shared wireframe.
- Keep the existing role/route permission matrix, but present non-approved, rejected, suspended and B2C-only states as informative access sheets rather than redirects or blank denials.
- Preserve the task bell and theme toggle, with compact direct links for permitted staff pages and the seven admin menu groups.
- Remove decorative backgrounds and ensure mobile navigation remains touch-safe, scrollable and consistent with desktop permissions.

## 3. Build the signature journey components and doorstep pages first

- Create one responsive strip-map component for normal, inspection, Box My Bike, Foam/NI and Scotland lifecycles, including timestamps, exception flags, POD blocks and the animated van position.
- Rework sender and receiver availability into the postcode gate, large date tiles, opening hours, notes, alternate-location disclosure, blocked-state view and clear confirmation view. Preserve the inbound-NI weekday-only single-date rule and all existing validation.
- Rework tracking into the signboard/facts/strip-map/POD-verification composition while retaining private-photo signing and all existing lifecycle branches.
- Rework repair offers and inspection approvals into large priced decision rows with live totals and clearly separated approval, decline and return-to-seller paths.
- Rework the NI partner upload and OAuth consent pages using the same light-only, no-navigation doorstep frame.

## 4. Redesign public and account-entry pages

- Replace the current gradient home screen with the solid signboard composition, authenticated CTA states and existing internal-staff task panel.
- Apply the legal/content template to About, Terms and Privacy; apply the two-column documentation template to API Docs.
- Restyle sign-in, registration and password reset as compact sheets, preserving `next=` redirects, business approval messaging and recovery behavior.
- Give not-found and application-error states the same plain fact/cause/next-step treatment.

## 5. Redesign the customer portal

- Dashboard: convert order cards/lists to ruled order rows with mini journey strips, route summaries, dates, service flags, status badges, action-needed tape, filters, labels and pagination.
- Create Order: retain the actual three-step Bikes → Collection → Delivery workflow and all current conditional fields, validation, address search/address book shortcuts, Box My Bike behavior and post-submit availability redirect; do not invent price, slot or payment steps.
- Restyle bulk upload, bulk availability, pricing, customer order detail, stock, customer inspections, Build My Bike, Box My Bike and Profile according to their counter-density wireframes.
- Preserve the inspection-report cutoff, QuickBooks behavior, connected-app revocation and all existing customer access restrictions.

## 6. Redesign warehouse and workshop screens

- Apply floor density, large touch targets and full-width tablet sheets to Loading & Storage, Box/Foam/Inbound NI, Build My Bike, inspections, warehouse stock, storage bays, equipment and mechanic clock.
- Preserve natural bay sorting, allocation/loading logic, photo handling, partner-label stages, workshop queues, parts allocation and all existing stage actions.
- Replace the eleven inspection tabs with a counted stage selector while retaining every existing filter, issue/pricing field, approval path, invoice choice, workshop-only customer flow and report action.
- Apply the same one-handed floor treatment to driver timeslips, Fuel Finder and the other in-app driver utilities; do not invent Shipday run, stop or POD screens.

## 7. Redesign office operations

- Job Scheduling: implement the resizable map/guaranteed-date/jobs/route composition, fixed-order job badges, existing heat-map modes, date viability rules, capacity calculations, drag ordering and all route actions.
- Convert route timeslots, saved routes, route comparison, CSV matching, coordinate updates and route flipping to wide work sheets without changing their calculations or integrations.
- Recompose staff order detail into the ordered strip-map plus Who / What / When & Where groups, timeline, communications and comments, preserving all current admin actions and Shipday recreation warnings.
- Restyle trunk runs, claims, inbox, tasks, project management, analytics, route profitability and mechanic profitability to the specified dense office layouts.
- Keep current pagination, memoisation and lazy loading so the redesign does not reintroduce page hangs.

## 8. Redesign administration and integrations

- Apply the supplied table, filter, form, drawer and sticky-action patterns to users, approvals, holidays, notices, announcements, API keys, webhooks, partner apps, Shopify, route permissions, knowledge, reviews and invoices.
- Use a shared integration-card pattern with status, action and last-error information while preserving real provider behavior and branded third-party logos.
- Keep admin tables dense and usable on desktop, with deliberate mobile fallbacks rather than compressed desktop grids.

## 9. Print, maps and hardcoded-colour sweep

- Restyle collection labels, bulk labels, trunk manifests and inspection reports as ink-on-white Overpass artefacts with large mono references, solid service flags and print-safe contrast.
- Retheme Leaflet and Google map presentation to the semantic palette; use marker shape/number as well as colour. Move Leaflet marker assets off the external CDN.
- Sweep page and feature code for legacy `courier` colours, raw status colours, gradients, translucency and inline visual values, replacing them with semantic tokens without changing meaningful status distinctions.

## 10. Validation and rollout

- Verify shared components first, then each room in order: doorstep → public → customer counter → warehouse/workshop floor → office/admin.
- Test light and dark themes, with tokenised links and print forced light.
- Exercise critical workflows rather than only checking appearance: availability submission, order creation, tracking/POD unlock, repair approval, route editing/timeslots, loading allocation, inspections, claims, messaging and permissions.
- Check representative phone, tablet and desktop sizes for overflow, focus order, 48/56px touch targets, sticky controls and non-overlapping text.
- Run focused tests plus the project test/build commands, and use browser screenshots on representative routes before completion.

## Technical notes

- The current app already has the required business behavior and most page-level controls; implementation should compose and restyle those controls instead of replacing their data flows.
- New shared journey components must consume existing order snapshots and tracking events, including the current NI, Box/Foam, inspection, third-party and Scotland branches.
- Because this is a full-application redesign, maintain a lean `roadmap.md` during implementation and complete the work in the dependency order above so intermediate screens remain coherent.
