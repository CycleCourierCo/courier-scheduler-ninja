# Staff Knowledge Base & SOPs

A single internal place where every procedure lives — route planning, customer service, drivers, workshop/inspections, loading & storage, Northern Ireland orders, invoicing. Any internal staff member can write and edit; every SOP can carry a runnable checklist staff tick off when doing the job for real.

## What staff will see

**New page: Knowledge Base (`/knowledge`)**

- Left: category list (Route Planning, Customer Service, Drivers, Workshop & Inspections, Loading & Storage, Northern Ireland, Invoicing & Finance, Onboarding & Admin) plus search across titles and content.
- Middle: list of SOPs in the selected category with title, short summary, owner, last-updated date, and a Draft/Published badge.
- Right/main: the SOP itself — rich text with headings, lists, links, images, and an optional step checklist.

**Editing** — any signed-in internal staff member (admin, route_planner, sales, driver, loader, mechanic, timeslip_admin, cs_agent) can create and edit. Customers (b2b/b2c only) never see the page or the nav link. Every save writes a version snapshot, so "who changed what, when" is visible and any earlier version can be restored.

**Checklists (runs)** — an SOP can define ordered steps. Staff hit "Start" to create a run: they tick steps off, add a note per step, and the run records who did it and when it was finished. Handy for "daily route planning run-through", "new driver first day", "bike intake". Each SOP shows its recent runs; a "My runs" filter shows anything unfinished.

**Discoverability**
- Nav entry "Knowledge Base" next to Tasks (desktop menu + mobile sheet).
- Search box matches title, summary and body.
- Optional per-SOP "related pages" links so an SOP can point at e.g. Job Scheduling or Inspections.

## Starter content I will draft

Seeded from how the app actually works today, so it is immediately useful and you edit from there:

- **Route Planning** — daily planning flow, Route Builder + Get Timeslots, flip route, saved routes, bulk WhatsApp/email to a route, CSV upload and job selection.
- **Customer Service** — inbox triage and assignment, availability chasers, proactive customer updates and expected timeframes (2-4 days collect / 2-4 days deliver, longer for remote areas), complaints and claims hand-off.
- **Drivers** — daily start, timeslips, fuel cards/fuel finder, collection & delivery photo/POD expectations, on-time timeslot behaviour.
- **Workshop & Inspections** — bike category, inspection checklist, parts vs labour pricing, cleaning stage, invoicing vs "no invoice needed", service-before-packing gate.
- **Loading & Storage** — storage bays, pending allocation, searching for a bike, removing bikes.
- **Northern Ireland** — outbound and inbound rules, ferry hand-off contact and coordinates, surcharge, what the customer is told.
- **Invoicing & Finance** — weekly batch, individual invoices, common failure causes and fixes.
- **Onboarding & Admin** — user roles and what each can access, adding a new staff member.

## Technical notes

Database (new tables, all with RLS + grants):
- `kb_categories` — name, slug, description, icon, sort order.
- `kb_articles` — category, title, slug, summary, body (rich text), status (draft/published), tags, author, last editor, timestamps, optional `related_links` JSONB.
- `kb_article_versions` — article id, body snapshot, title, editor, created_at (written by trigger on update).
- `kb_checklist_items` — article id, position, text, optional guidance.
- `kb_checklist_runs` + `kb_checklist_run_items` — run owner, started/completed timestamps, per-step done flag, note, completed_by.

RLS: read for any internal staff via a `is_internal_staff(auth.uid())` check (function already exists); insert/update for internal staff; delete restricted to admin. Runs are readable by internal staff, writable by their owner (admin can edit any). Grants issued to `authenticated` and `service_role` in the same migration.

Frontend:
- `src/pages/KnowledgeBase.tsx` with `KnowledgeSidebar`, `ArticleList`, `ArticleView`, `ArticleEditor`, `ChecklistPanel`, `VersionHistoryDialog` under `src/components/knowledge/`.
- `src/services/knowledgeService.ts` + `src/hooks/useKnowledge.ts` following the existing tasks service/hook pattern.
- Route `/knowledge` (and `/knowledge/:slug`) in `App.tsx` behind `ProtectedRoute`; `ProtectedRoute` updated so every internal role is allowed and pure-customer roles are redirected.
- Rich text via a lightweight markdown editor (write markdown, render sanitised) to avoid a heavy WYSIWYG dependency.
- Nav links added to `Layout.tsx` for internal staff only.

Seed content is inserted as published articles with checklists so the section is not empty on first open.
