# Mobile Responsiveness & Layout Audit (report only)

Goal: produce a complete audit report of mobile responsiveness, overflow, spacing and layout consistency issues across every page, dialog, drawer, table, form and card. No code changes in this phase — the deliverable is the report.

## How the audit runs

Automated Playwright crawl against the running preview, signed in with the injected Supabase session. Each route is loaded at four viewports:

- 360×640 (small Android)
- 390×844 (iPhone 14)
- 768×1024 (tablet)
- 1280×900 (desktop baseline for comparison)

For every route + viewport the script captures:

1. Full-page screenshot to `/tmp/audit/screens/<route>_<w>.png`.
2. Horizontal overflow check: `document.documentElement.scrollWidth` vs `clientWidth`.
3. Element-level overflow scan: any node where `scrollWidth > clientWidth + 1` — records selector, tag, text snippet, bounding box.
4. Tap-target scan: interactive elements (`button`, `a`, `[role=button]`) whose rendered box is smaller than 44×44.
5. Text truncation scan: elements with `white-space: nowrap` clipping content, and long strings breaking layout.
6. Off-screen / clipped fixed elements (headers, sticky footers, FABs).

## Coverage

Every route registered in `src/App.tsx`, plus every dialog/drawer/sheet reachable from those routes. The crawler opens the primary modal on each page (Order Detail drawer, Task drawer, Create Order steps, Vehicle Maintenance, Bulk Upload review, Route Builder, Scheduling dialogs, CSV match review, Storage bays edit, Webhook create, Claim advance, Invoice detail, User Management edit, Log Service, Maintenance Intervals, etc.).

Component-level focus areas walked explicitly:

- Global chrome: `Layout.tsx`, `DashboardHeader.tsx`, sidebar / mobile menu.
- Tables: every `<Table>` usage (Invoices, Vehicles, Warehouse Stock, Timeslips, Users, Webhooks, Analytics tables, maintenance history).
- Forms: Create Order, Bulk Upload, Auth (login/register/reset), User Profile, Vehicle add/edit, Policy dialog, Webhook create, Holidays, Storage Bays.
- Dashboards / cards: Dashboard, Analytics, Route Profitability, Fuel Finder, My Stock, Loading/Unloading.
- Scheduling surfaces: Job Scheduling, Route Builder, Dispatch Routes, AI Routing, Scheduling dialogs, Multi-CSV upload, Multi-job timeslot.
- Charts: every Recharts container (min-height, legend overlap, axis labels).
- Public / auth pages: Auth, Reset, Tracking, Sender/Receiver Availability, Pricing, About, Terms, Privacy, NotFound.

## Deliverable

A single markdown report at `/tmp/audit/report.md` with:

- **Executive summary** — counts by category and by severity.
- **Findings table** — Route | Viewport | Category | Severity | Selector | Description | Screenshot link.
- **Category breakdowns** with representative screenshots:
  - Horizontal page overflow
  - Tables overflowing without scroll wrapper
  - Dialogs/drawers wider than viewport
  - Grids not stacking on mobile
  - Toolbars/filters not wrapping
  - Truncation / long-text overflow (order refs, emails, addresses, notes)
  - Tap targets < 44px
  - Sticky/fixed elements clipped or blocking content
  - Padding / spacing inconsistencies across pages
  - Chart rendering issues on narrow viewports
- **Worst offenders** — top 15 issues ranked by user impact.
- **Recommended fix waves** — grouped so you can approve them in order later (global chrome → high-traffic pages → ops → admin/analytics → auth/public). No code written in this phase.

## Scope guardrails

- Read-only. No file edits, no dependency changes, no schema changes.
- Presentation concerns only (overflow, spacing, stacking, tap size, truncation). Business logic, copy, and data are out of scope for the report.
- Auth-gated routes are covered using the injected Supabase session; if `LOVABLE_BROWSER_AUTH_STATUS` isn't `injected`, the report notes which routes were skipped and why.

## Questions before I run it

1. **Minimum viewport** — is 360px the floor, or should I also test 320px (iPhone SE 1st gen)?
2. **Priority list** — any routes you specifically care about on mobile so I lead the report with them (guessing: Order Detail, Tracking, Tasks, Driver Timeslips, Mechanic Clock, Loading/Unloading)?
3. **Depth** — do you want per-issue screenshots for every finding (heavier report, ~200–400 images) or only per category + worst offenders (lighter, ~40 images)?
