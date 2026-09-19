# Redesign brief: full page inventory and theme documentation

Documentation only — no application code, database or behaviour changes. The output is one exhaustive markdown document written to `docs/REDESIGN_BRIEF.md` (plus a copy in Files for sharing).

## What the document will contain

Eleven sections, in the order requested:

1. **Audiences and roles** — every role in the system (admin, route_planner, sales, loader, mechanic, driver, timeslip_admin, cs_agent, fleet_manager, tech, project_manager, b2b_customer, b2c_customer, public visitor, API/OAuth partner), what each can reach, and the account approval/suspension states that gate them.
2. **Public pages** — table of every route reachable without sign-in: home, about, pricing, terms, privacy, API docs, auth and password reset, plus the tokenised links (order tracking, sender/receiver availability, repair offer, inspection approval, NI partner upload) with exactly what each reveals and what identity check it asks for.
3. **Client portal pages** — dashboard, order list and detail, create order (every step and field in order, including addresses/postcodes, bike details, boxed/unboxed and services, availability day selection, guaranteed date, price display), bulk upload, bulk availability, invoices, inspections and reports, my stock, build my bike, profile and address book.
4. **Internal ops pages** — all staff screens with their real sections, tabs, tables, dialogs and fields: job scheduling and route builder (map modes, heat maps, guaranteed-date panel, get-timeslots popup, CSV import and match review, saved routes), loading and storage, trunk runs, box/build my bike, inspections and labour times, warehouse stock and storage bays, equipment, vehicles, timeslips, fuel finder, claims, inbox, tasks and project management, analytics and profitability, users, approvals, holidays, notices, announcement emails, API keys, webhooks, partner apps, route permissions, Shopify.
5. **Driver-facing views** — driver timeslips, fuel finder, tasks, and how stop completion/POD actually reaches the system today (Shipday driver app rather than in-app capture), stated plainly so the redesign doesn't assume screens that don't exist.
6. **Order lifecycle** — every status and exception state in sequence (including NI ferry stages, inspection/repair stages, ship-as-is, failed delivery, returns, cancellation), what triggers each, who sets it, and which email/WhatsApp notification fires with the gist of the template.
7. **Key objects and their visible fields** — order, bike, client account, price/rate, invoice, saved route, stop, driver, vehicle, claim, task, notification.
8. **Navigation** — sidebar sections and item order per role as implemented, top bar contents, mobile behaviour.
9. **Design notes before wireframing** — device and environment per screen (warehouse tablet, van cab phone, client desktop), every printed artefact (labels, manifests, loading lists, inspection reports, invoices) with generating file paths, everything emailed or messaged and via which provider, where maps appear and which library, payment handling, and the status colours and semantic tokens that must survive.
10. **Integrations** — Shipday, Resend, SendZen/Infobip WhatsApp, QuickBooks, Shopify, Geoapify, Google Maps, Inspectabike, OSRM/VROOM/Verso plans, OAuth partner apps and webhooks — where each surfaces in the UI and what its status/connect UI looks like.
11. **How the theme gets implemented** — what is in `src/index.css` and `tailwind.config.ts` today (fonts, HSL tokens, courier palette, gradients, shadows, radius), the shadcn component set and where variants live, custom components (route builder, maps, boards, capture widgets), dark-mode variables and the toggle, and a listed inventory of files with hardcoded colours that would survive a token swap.

## How it gets produced

- Read-only sweep of all route definitions, all 60+ page components, `Layout`, `ProtectedRoute`, the route/permission registry, services, order status enums, edge functions for notifications, PDF/label generators, and the token files.
- Parallel read-only sub-agents for the four heaviest areas (ops pages, lifecycle/notifications, print/email artefacts, theme and hardcoded colours), then a single assembled document.
- Every claim traced to a file path so the redesign team can open the source. Anything that doesn't exist (e.g. in-app POD capture, in-app payment) is stated as absent rather than omitted.
