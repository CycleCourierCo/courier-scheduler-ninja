# Build My Bike: customer-created builds, SKUs and stored build templates

## 1. Customer-created builds

Same page, two experiences based on the logged-in role:

- **Staff (admin/loader/mechanic):** unchanged — pick the customer, set labour price, see all builds for the site.
- **Customer (b2b/b2c):** no customer dropdown (build is created against their own account) and no labour price field. They see only their own builds, and labour cost / parts totals are hidden from them until the build is invoiced.

The "New build" form for a customer asks for: build name, SKU, bike brand, model, type, and spec notes. Labour is set later by the workshop.

## 2. SKU on a build

Builds gain a **SKU** field, shown in the new-build form, on the build card, and in the build detail header. Editable by staff; set once by the customer at creation. Used to match the finished bike back to the customer's own product catalogue, and carried onto the warehouse stock item created when the build is marked built.

## 3. Stored builds (build templates)

A customer (or staff on their behalf) can save a **stored build**: a named spec — SKU, bike brand/model/type, notes, and a list of required parts by component category with quantities (not tied to specific stock items).

- New "Stored builds" tab on the Build My Bike page listing the customer's templates.
- Templates can be created from scratch, or **saved from an existing build** ("Save as stored build" captures its current component categories/quantities).
- Each template row has a **"Create build"** button: one click creates a live build with the template's spec/SKU/name and then auto-allocates matching in-stock components from the customer's warehouse stock — one available item per required category/quantity, reserved against the build exactly like manual picking.
- Result toast reports what was allocated and what is missing. If everything matched, the build starts at **Picking parts**; if anything is missing it starts at **Awaiting parts**, and the missing categories are listed on the build so the workshop knows what to order.

## Technical notes

- Migration: add `sku text` to `public.bike_builds`. New tables `public.bike_build_templates` (user_id, name, sku, bike_brand, bike_model, bike_type, spec_notes, created_by, timestamps) and `public.bike_build_template_items` (template_id, category, quantity, slot, notes). Both get GRANTs (authenticated + service_role), RLS enabling staff (`has_role` admin/loader/mechanic) full manage and customers manage their own rows, and an `updated_at` trigger.
- `bike_builds` RLS gains a customer self-insert/self-read policy scoped to `user_id = auth.uid()`; customers cannot change `labour_cost` (enforced by a trigger that preserves the existing/zero value unless the actor is internal staff), stage, or invoice fields.
- `src/types/bikeBuild.ts`: add `sku` to `BikeBuild`/`BikeBuildFormData`; add `BikeBuildTemplate` and `BikeBuildTemplateItem` types.
- `src/services/bikeBuildService.ts`: include `sku` on create/update; add `getBuildTemplates`, `saveBuildTemplate`, `deleteBuildTemplate`, `saveBuildAsTemplate`, and `createBuildFromTemplate` (creates the build, then loops the template items against `getAvailableComponents` and calls the existing `addComponentToBuild`, returning allocated/missing summaries).
- `completeBikeBuild` passes the build SKU into the new `warehouse_stock` row.
- `src/pages/BuildMyBikePage.tsx`: role check via `useAuth`/`src/lib/roles.ts` to hide the customer dropdown, labour field and site switcher for customers; add SKU input; add a "Stored builds" tab.
- New `src/components/build-my-bike/StoredBuildsTab.tsx` and `src/components/build-my-bike/BuildTemplateDialog.tsx` (name/SKU/spec plus a category+quantity line editor using `COMPONENT_CATEGORIES`).
- `src/components/build-my-bike/BuildDetailDialog.tsx`: show SKU, add "Save as stored build", hide labour/costs and stage controls for customer viewers.
- Route permissions: allow `b2b_customer`/`b2c_customer` on `build-my-bike` in `role_route_permissions`, and add it to the customer menu section in `src/components/Layout.tsx`.
