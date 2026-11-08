# Data map

App: Cycle Courier Co. booking and operations platform. Live at https://booking.cyclecourierco.com and https://courier-scheduler-ninja.lovable.app. The driver app wraps the same site.
Controller: Cycorco Ltd trading as Cycle Courier Co., 30 Wake Green Road, Birmingham, B13 9PB. Company no. 16220087.
ICO registration number: TO CONFIRM (user to fill in)
Privacy contact: privacy@cyclecourierco.com (named on the current privacy page; check that someone reads this mailbox)
Privacy notice version: none. The /privacy page says "Last updated: April 4, 2025" and has no version number.
Last reviewed: 2026-11-08 by /gdpr-audit (first audit, so this map is a first draft)

"TO CONFIRM" means the business has to decide. The suggested periods follow the UK defaults in the audit skill and are not legal advice.

## Personal data held

### Customers, senders and receivers

| Table / bucket | Fields | Whose data | Purpose | Lawful basis | Retention | Erasure action | Notes |
|---|---|---|---|---|---|---|---|
| orders | sender / receiver JSONB (name, email, phone, address, lat/lon), sender_notes, receiver_notes, alt locations, payment_collection_phone, booked_by_name, driver names, guaranteed_delivery_note, ni_partner_token | Customers, senders, receivers, staff | Collect, store and deliver bikes; invoicing | Contract (legal obligation for the invoice fields) | TO CONFIRM. Suggest 6 years after completion, then anonymise. | Anonymise the sender/receiver snapshots and keep the financial fields | 8,982 rows, oldest 2025-03-19. No anonymise job yet. |
| contacts | name, email, phone, street, city, postcode, lat/lon, notes | Address-book contacts kept by business customers | Repeat bookings | Contract with the business customer; legitimate interests for the contact people | TO CONFIRM. Suggest deleting with the account, or after 2 years unused. | Delete | 10,889 rows |
| profiles | name, email, phone, address, company, accounts_email, lat/lon, special rates | Business and private account holders (staff fields listed separately below) | Accounts, pricing, invoicing | Contract | TO CONFIRM. Suggest account closure + 6 years for billing fields. | Anonymise | 254 rows. delete-user removes only the sign-in, not this row. |
| auth.users | email, phone, sign-in metadata, last sign-in | All account holders | Sign-in | Contract | Life of the account | Delete | 300 users. 0 dormant for 2+ years. |
| oauth_grant_addresses | contact_name, contact_phone, address, lat/lon | Customers of partner apps | Partner-app bookings | Contract | TO CONFIRM | Delete with the grant | |
| order_leg_availability, date_chase_log | Chosen dates, chase history | Senders, receivers | Scheduling | Contract | Same as orders | Delete with the order | |
| order_comments | admin_name, comment (free text) | Customers, staff | Internal order notes | Legitimate interests | Same as orders | Delete or anonymise | Free text, can pick up unnecessary details |
| bicycle_inspections, inspection_issues, inspection_comments, inspection_chases | customer_name/email/phone/address, identity_notes, staff names, approval timestamps | Customers, receivers, mechanics | Workshop inspections, repair approvals and invoices | Contract | TO CONFIRM. Suggest 6 years. | Anonymise | identity_notes: check whether these record ID checks or theft checks (see Special category) |
| inspection-reports (bucket) | Inspection PDFs with customer and bike details | Customers | Reports | Contract | Same as inspections | Delete files | 148 files. Private bucket. Older PDFs kept public URLs for compatibility. |
| claims, claim_notes, claim_status_log, claim_evidence_files, claim-evidence (bucket) | Assessor and author names, notes, settlement and payment reference, photos | Claimants, staff | Damage claims | Legitimate interests (defending claims); contract | Claim closed + 6 years | Keep while open | 13 claims, 2 files |
| lost_found_items, lost-found-photos (bucket) | Item name, photo, order link | Customers | Return lost items | Legitimate interests | TO CONFIRM. Suggest 12 months after closed. | Delete | |
| delivery_proofs, delivery_proof_uploads, delivery-proofs (bucket) | recipient_name, signature, photos, lat/lng, note | Receivers, drivers | Proof of delivery | Contract; legitimate interests (disputes) | TO CONFIRM. Suggest 2 years, longer if there is a claim. | Delete files and rows | 0 rows at the moment |
| foam-delivery-photos, foam-my-bike-labels, box-my-bike-labels (buckets) | Photos, labels showing names and addresses | Customers, receivers | Ferry and boxing services | Contract | TO CONFIRM | Delete files | |
| warehouse_stock | item_notes | Business customers | Stock storage | Contract | TO CONFIRM | | |
| tracking_postcode_attempts | ip, order_id, time | Anyone using public tracking | Rate limiting / abuse prevention | Legitimate interests (security) | Suggest 30 days | Delete | 12,604 rows since 2026-06-15. No purge job. |
| fleet_eta_links | sent_to_phone, sent_to_email, registration | Customers sent an ETA link | ETA sharing | Contract | Suggest expiry + 30 days | Remove the contact columns | Links expire after 12 hours, but the rows stay |

### Customer service and messaging

| Table / bucket | Fields | Whose data | Purpose | Lawful basis | Retention | Erasure action | Notes |
|---|---|---|---|---|---|---|---|
| cs_contacts, cs_channel_endpoints | display_name, email or phone handle | Anyone who contacts support | Support inbox | Legitimate interests; contract | Suggest 24 months after last message | Delete | 618 contacts |
| cs_conversations, cs_messages | Message bodies (HTML/text), previews | As above | Support | As above | Suggest 24 months unless linked to a claim | Delete | 5,013 messages since 2026-09-20 |
| cs-attachments (bucket) | Inbound email and WhatsApp attachments | As above | Support | As above | Same as messages | Delete files | 396 files |
| sms_messages, divergent_webhook_events | recipient_masked, status | Customers | SMS delivery records | Contract | Suggest 12 months | Delete | Number stored masked (good) |
| email_delivery_events | recipient, payload (JSONB), order link | Customers | Email delivery tracking | Legitimate interests | Suggest 12 months | Delete | 195,752 rows since 2026-06-23. No purge job. |
| custom_email_sends, scheduled_announcements | recipients, html_body | Customers | One-off and bulk messages | TO CONFIRM: contract for service notices; consent or soft opt-in if promotional | TO CONFIRM | | No opt-out or suppression list |
| webhook_delivery_logs | payload (full order, including addresses), response_body | Customers of partner/API accounts | Debugging partner webhooks | Legitimate interests | Suggest 90 days | Delete | 21,355 rows since 2025-11-17. No purge job. |
| customer_shopify_order_log | message, raw_payload | Customers of partner Shopify stores | Duplicate-safe booking | Contract | Suggest 90 days | Delete | 0 rows at the moment |
| api_request_logs | user_id, endpoint, status | API customers | Security and support | Legitimate interests | Suggest 90 days | Delete | 80,663 rows since 2026-08-10. No purge job. |
| integration_call_logs | provider, status (no personal data) | none | Monitoring | n/a | 30 days | Purged daily | Active cron job |
| invoice_history, quickbooks_unmatched_invoices | customer_name, customer_email | Customers | Invoicing | Legal obligation | 6 years after the financial year | Keep | |

### Staff, drivers and mechanics

| Table / bucket | Fields | Whose data | Purpose | Lawful basis | Retention | Erasure action | Notes |
|---|---|---|---|---|---|---|---|
| profiles (staff fields) | hourly_rate, per_mile_rate, pay_type, workshop_hourly_rate, licence_number, licence_expiry, licence file paths | Drivers, mechanics, staff | Employment, pay, right to drive | Contract (employment); legal obligation | TO CONFIRM. Suggest leaving + 6 years for pay, and leaving + 6 months for licence copies. | Delete licence files | |
| driver-licences (bucket) | Licence front/back images, DVLA check code | Drivers | Licence checks | Legal obligation / legitimate interests | As above | Delete files | 58 files. Check codes can reveal driving endorsements, which count as criminal offence data. |
| timeslips, mechanic_timeslips | Hours, pay, job locations, clock-in/out GPS, clock-in/out photos, admin_notes | Drivers, mechanics | Pay and time records | Contract; legal obligation (pay records) | Suggest 6 years for pay; 12 months for photos and GPS | Delete photos and GPS early | 95 mechanic timeslips |
| mechanic-clock-photos (bucket) | Clock-in selfies | Mechanics | Proof of attendance | Legitimate interests | TO CONFIRM. Suggest 3 to 12 months. | Delete files | 196 files. No purge job. |
| driver_positions | Phone GPS while on shift | Drivers | Live tracking, ETAs | Legitimate interests | 90 days | Purged daily | Recorded only between Start shift and Stop shift |
| fleet_position_history, fleet_snapped_paths | Van GPS every 2 minutes, 04:00 to 22:00 | Drivers (linked through van assignment) | Live map, route deviation | Legitimate interests | 90 days (history). Snapped-path cache: TO CONFIRM | Purged daily (history only) | 61,792 rows |
| label_scans | user_id, role, action, lat/lon | Staff | Chain of custody | Legitimate interests | TO CONFIRM. Suggest 2 years. | | |
| driver_absence_requests, driver_availability_overrides, driver_weekly_availability, van_unavailability | Leave dates, notes, decision reason | Drivers | Rota | Contract | TO CONFIRM | | Notes are free text and could pick up health reasons |
| review_cycles, review_ratings, review_responses, review_actions | Scores, meeting notes, employee comments | Staff | Performance reviews | Contract (employment); legitimate interests | TO CONFIRM. Suggest leaving + 6 years. | | |
| tasks, task_comments, kb_* | Assignee, comments | Staff | Internal work | Legitimate interests | TO CONFIRM | | |
| fleet_inspections, vehicle_issues, fleet_repair_jobs, fleet_audit_log, fuel_transactions, fuel_cards, caz_charges | Inspector and verifier names, notes, card names | Drivers, fleet staff | Vehicle safety and costs | Legal obligation (roadworthiness); legitimate interests | TO CONFIRM. Suggest 15 months minimum for safety inspections (DVSA guidance), up to 6 years for costs. | Keep | |
| fleet_repair_providers | Name, email, phone, address | Garage contacts | Repairs | Legitimate interests | While in use | Delete | Mostly business contacts |
| user_roles | Role assignments | Staff | Access control | Contract | Life of the account | Delete | |

## Processors and recipients

| Service | What it receives | Hosting region | DPA in place | Transfer mechanism | In privacy notice |
|---|---|---|---|---|---|
| Supabase (Lovable Cloud) | All app data and files | TO CONFIRM project region | TO CONFIRM | TO CONFIRM | No |
| Lovable | Code; data during development; hosting | TO CONFIRM | TO CONFIRM | TO CONFIRM | No |
| Shipday | Driver names, sender/receiver names, phones, addresses, proof of delivery | US | TO CONFIRM | TO CONFIRM (UK–US data bridge or IDTA) | No |
| QuickBooks (Intuit) | Customer names, emails, billing addresses, invoices | US/UK | TO CONFIRM | TO CONFIRM | No |
| Shopify (own store and customers' stores) | Orders, customer details, fulfilment tracking | Canada/US | TO CONFIRM | TO CONFIRM | No |
| Resend | Email addresses, email content, inbound support email | US | TO CONFIRM | TO CONFIRM | No |
| SendZen (WhatsApp Business / Meta) | Phone numbers, message content, inbound messages | TO CONFIRM | TO CONFIRM | TO CONFIRM | No |
| Divergent Connect (api.connect.ms) | Phone numbers, SMS content | TO CONFIRM | TO CONFIRM | TO CONFIRM | No |
| Google Maps Platform (Routes, Roads, Maps JS) | Stop coordinates, addresses, van GPS traces; visitors' IP addresses | US | TO CONFIRM | TO CONFIRM | No |
| Google Fonts | Visitors' IP addresses (fonts load from Google on every page) | US | n/a | TO CONFIRM | No |
| Geoapify | Addresses typed into search, geocoding | EU (Germany) | TO CONFIRM | n/a | No |
| postcodes.io | Postcodes | UK | n/a | n/a | No |
| OpenStreetMap tile servers | Visitors' IP addresses (map tiles on Live Map, ETA page and others) | UK/EU | n/a (usage policy) | n/a | No |
| Verso (route optimisation) | Stop addresses and coordinates, time windows | TO CONFIRM | TO CONFIRM | TO CONFIRM | No |
| Radius Velocity | Van positions (inbound) and vehicle data | UK | TO CONFIRM | n/a | No |
| DVLA Vehicle Enquiry Service | Vehicle registrations | UK | n/a | n/a | No |
| Inspectabike | Receiver/sender name, bike details, tracking number | TO CONFIRM | TO CONFIRM | TO CONFIRM | No |
| Partner apps (OAuth clients, e.g. VeloDealer) and customer webhooks | Order details including addresses for that customer's orders | Varies | TO CONFIRM (these are separate controllers or processors) | TO CONFIRM | No |
| Sentry | Errors, IP address, user id and email, masked session replays (10% of sessions, all sessions that hit an error) | TO CONFIRM (DSN host is ingest.de, so EU) | TO CONFIRM | n/a if EU | No |
| PostHog | Page views, clicks, user id and email (identify), cookies | EU (default region) | TO CONFIRM | n/a if EU | No |
| Trustpilot | Links in emails only; no data sent by the app | n/a | n/a | n/a | n/a |

Secrets with no current code use: OPTIMOROUTE_API_KEY, TWOCHAT_API_KEY, TWOCHAT_FROM_NUMBER. If these services are no longer used, delete the secrets and end any accounts.

## Cookies and tracking

Found by reading the code. Not yet checked in a fresh browser.

| Name / script | Purpose | Category | Duration |
|---|---|---|---|
| sb-<project>-auth-token (localStorage) | Login session | Necessary | Session / refresh |
| PostHog cookie + localStorage (ph_*) | Product analytics, autocapture, identify by email | Exempt only with clear information and an easy opt-out (DUAA); neither exists today | 1 year (PostHog default) |
| Sentry Session Replay + tracing | Error monitoring and replays (text and inputs masked by default) | Arguably security/exempt; needs explaining | Session |
| Google Fonts (fonts.googleapis.com) | Font files | Not a cookie, but sends visitors' IP addresses to Google | n/a |
| cdn.gpteng.co/gptengineer.js | Lovable platform script | TO CONFIRM purpose | n/a |
| Route-tab / UI localStorage keys (safeStorage, stashed route stops) | App functionality | Necessary | Short-lived |

## Legitimate interests notes

- Route deviation and van tracking: needed to run the routes, give customers ETAs and settle disputes. Drivers expect their van to be tracked on shift. Safeguards: kept for 90 days, phone tracking only between Start and Stop shift, only fleet staff can see it. TO CONFIRM: drivers have been told in writing.
- Rate-limit IP logs (tracking_postcode_attempts): needed to stop people guessing postcodes to see tracking details. Low impact. Safeguard to add: purge after 30 days.
- Damage claims evidence: needed to defend legal claims. Kept until the claim closes + 6 years.
- Support inbox: needed to answer questions and keep a record of what was agreed. Safeguard to add: a fixed retention period.

## Special category and criminal offence data (TO CONFIRM)

- DVLA licence check codes and licence images (driver-licences bucket, profiles.licence_*) can reveal driving endorsements. The ICO treats these as criminal offence data. You need a DPA 2018 Schedule 1 condition (normally para 1, employment) and an appropriate policy document.
- bicycle_inspections.identity_notes: confirm what staff write here, for example ID checks or stolen-bike checks.
- Free-text notes (driver_absence_requests.note, admin_notes, order_comments) could pick up health details. Tell staff not to record health reasons there.

## Change log

- 2026-11-08: First version, written by /gdpr-audit from the live database and the code.
