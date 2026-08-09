# Draft SOPs for every Knowledge Base category

The Knowledge Base currently has 9 categories and no articles at all. This adds one draft SOP per category, written from how the app actually works today, each with a tick-off checklist so staff can run it for real.

## What gets created

All articles land as **Draft** so you can read, edit and publish them yourself.

| Category | Draft SOP |
| --- | --- |
| Route Planning | Daily route planning run-through — job selection, Route Builder, Get Timeslots, flip route, saved routes, bulk WhatsApp/email, CSV upload and the job-selection review step |
| Customer Service | Inbox triage & customer updates — assignment, availability chasers, proactive updates, expected timeframes (2-4 days collect / 2-4 days deliver, longer for remote postcodes), complaints and claims hand-off |
| Drivers | Driver day start to finish — timeslips, fuel card & Fuel Finder, timeslot behaviour, collection/delivery photos and POD |
| Workshop & Inspections | Bike inspection & repair flow — bike category, checklist, parts vs labour pricing, cleaning stage, invoice or "no invoice needed", service-before-packing gate |
| Loading & Storage | Loading, storage bays & bike search — pending allocation, allocating a bay, finding a bike, removing bikes |
| Northern Ireland | Northern Ireland orders (outbound & inbound) — ferry hand-off at Manchester, ferry contact/coordinates, surcharge, what the customer is told, foam my bike |
| Invoicing & Finance | Weekly invoicing & QuickBooks — weekly batch, individual customer invoices, NI surcharge line, common failures and fixes |
| Onboarding & Admin | Adding a staff member & roles — what each role can access, pay rates, Shipday linkage |
| Vehicles | Vehicle checks & maintenance — status changes, maintenance intervals, logs, insurance and MOT records |

Each SOP includes: when to use it, the step-by-step procedure, where in the app to click, and common mistakes. Each also gets a 5-10 step checklist staff can start as a run.

## Technical notes

- Content inserted as rows in `kb_articles` (status `draft`, correct `category_id`, slug, one-line summary) plus ordered rows in `kb_checklist_items` — no schema changes, no code changes.
- Bodies are markdown, rendered by the existing `MarkdownView` component.
- `created_by` / `updated_by` left null since inserts run without an authenticated user; the version trigger picks up editors from the first real edit onward.
