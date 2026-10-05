# Privacy audit of the Cycle Courier Co app (no code changed)

The findings come from reading the code and checking the live database. Anything marked **[confirm]** couldn't be proved from the code alone. This is not legal advice.

## 1. Personal data held

| Data | Where it's kept | Who sees it | Deleted? |
|---|---|---|---|
| Sender/receiver name, email, phone, address, postcode, alternative locations | orders (`sender`, `receiver`, alt locations), contacts | Staff by role; the customer for their own orders | Never |
| Access/delivery notes (can include health or access needs) | orders `delivery_instructions`, `sender_notes`, `receiver_notes` | Staff, drivers via Shipday | Never |
| Bikes: make, model, frame size, value, serial/frame details | orders `bikes`, `bike_value`; inspections | Staff, the customer | Never |
| Payment-collection phone, "needs payment on collection" | orders | Staff | Never. No card or bank fields exist |
| Order refs, appointment dates/times, status, tracking events | orders | Staff, the customer, the public tracking page | Never |
| Proof of delivery photos/signatures | Shipday's own CDN links saved in `tracking_events` | Anyone with the link [confirm Shipday access] | Never |
| Foam/NI delivery photos, labels | Private buckets, short-lived signed links after a postcode check | Staff, the receiver after the postcode check | Never |
| Inspection customer name/email/phone/address, reports | `bicycle_inspections`, `inspection-reports` bucket (private) | Staff, mechanics | Never |
| Claims evidence, damage descriptions, market value | `claims`, `claim-evidence` bucket (private) | Staff | Never |
| Customer service emails and WhatsApps (full message text) | `cs_messages`, `cs_conversations` | Customer service and admin | Never |
| Business accounts: company, address, accounts email, phone | profiles | Admin, the account owner | When the user is deleted [confirm related rows] |
| **Driver driving licence images, licence number and expiry** | profiles + private `driver-licences` bucket | Admin | Never |
| Driver names on jobs, timesheets with job locations, absence notes | orders, timeslips, `driver_absence_requests` | Admin, the driver | Never |
| Mechanic clock-in location (one reading per clock-in/out) | mechanic timeslips, `mechanic-clock-photos` | Admin | Never |
| Fuel cards and transactions per vehicle/driver | fuel tables, `fuel-invoices` bucket | Admin | Never |
| IP address of postcode-check attempts | `tracking_postcode_attempts` | System | Never |
| Email delivery events (recipient address) | `email_delivery_events` | Staff | Never |
| Integration call logs | `integration_call_logs` | Admin | **Yes, nightly clean-up** |

Every table in the app's database has access rules switched on, except `labour_times` and `labour_time_multipliers`, which hold no personal data.

## 2. Outside services receiving data

| Service | What it gets | Customer / driver | Likely location |
|---|---|---|---|
| Supabase (database, login, files) | Everything | Both | [confirm region, likely EU] |
| Shipday | Names, addresses, phones, notes, proof of delivery | Both | US |
| SendZen (WhatsApp) | Phone numbers, names, job details, message text | Customers | [confirm]. Meta processes messages globally |
| Resend (email, support inbox) | Emails, names, order details, inbound emails | Both | US |
| QuickBooks | Customer names, addresses, invoice lines | Customers | US |
| Google Maps | Addresses/coordinates | Customers | US |
| Geoapify | Addresses/coordinates (routing, fuel stations) | Customers | Germany |
| Sentry | Errors, IP, request headers, **10% of sessions recorded, plus every session that has an error** | Both | US/EU [confirm org region] |
| PostHog | Page views and clicks; on-screen text not masked | Both | EU |
| Shopify | Website order customer details (incoming) | Customers | Canada/global |
| Inspectabike | Bike/job details, possibly the customer's name | Customers | UK [confirm] |
| DVLA | Van registrations | Neither (company vans) | UK |
| Customer webhooks | Full sender/receiver details sent to the business client's own URL, signed | Customers | Client's choice |
| AI route planning (Lovable AI / Gemini) and VROOM | [confirm exactly which addresses or coordinates are sent] | Customers | [confirm] |
| Verso | Key exists, use unclear | [confirm] | [confirm] |

## 3. Messages and public links

- Timeslot WhatsApps and emails contain the name, bike, date, time window, tracking link and now the customer's order number.
- **Public tracking page:** opens with the tracking number, order ID or customer order number. Changing dates and viewing photos need the postcode (10 tries per 10 minutes). The basic view has no attempt limit. [confirm exactly what the basic view shows]
- Repair-offer and inspection-approval links use long random IDs that can't be guessed.

## 4. Driver location

The app doesn't record drivers' locations continuously. Live tracking happens inside Shipday. The only location the app reads is a single reading at mechanic clock-in/out.

## 5. Photos

All of the app's own storage buckets are private, and photos are only shown through short-lived links. Location data inside photo files (EXIF) is **not removed**. Proof-of-delivery photos stay on Shipday's servers.

## 6. Cookies and tracking

- PostHog uses cookies and browser storage. Sentry records sessions.
- **No cookie consent banner.** Under UK PECR, analytics and session recording need consent.
- No advertising pixels.

## 7. Security in place

- Individual logins, staff roles kept in a separate table, and access rules on every table that holds personal data.
- Incoming webhooks from Shipday, Resend, SendZen and Shopify are checked with a shared secret. Webhooks sent to clients are signed.
- Private buckets with signed links, and a postcode check before photos or availability changes.
- Rate limiting only on business sign-up (in memory) and the postcode check.
- Earlier security scans found about 150 open warnings. The app is **not** fully hardened.

## 8. Retention: proposed periods vs what the app actually does

| Proposed | What happens now |
|---|---|
| Orders/contacts: 6 years | Kept forever. No deletion |
| Proof of delivery/photos: 12 months | Kept forever (here and at Shipday) |
| Messages: 2 years | Kept forever |
| Analytics: 14 months | Set by PostHog/Sentry account settings [confirm] |
| Business-client data: per contract | No per-client deletion. **This doesn't meet the PedalUK agreement's 30 days** |

## 9. Controller vs processor

- **Our own data (we decide how it's used):** direct and website bookings, business account details, invoicing, claims, customer service, drivers, staff, security logs.
- **Processor (on business clients' behalf):** their customers' names, addresses, phones, notes, proof of delivery and status.
- **Unclear areas:**
  - Business clients' customers get our own WhatsApps/emails and review requests.
  - Their details are saved into our address book.
  - They show up in our analytics.
  - Inspection or repair offers are sent to the receiver.

## 10. What the business-client data agreement needs to cover

Following our instructions, staff confidentiality, security measures (sections 5 and 7), the named list of outside services (section 2), data leaving the UK (US providers), help with data requests and breaches, help with impact assessments, deletion or return at the end of the contract, audits, processing records, and breach notice times. Cycle Courier-specific items to add:
- partner couriers and ferry hand-offs
- printed labels
- photos taken on drivers' phones
- customer webhooks
- customer service message history

## 11. Facts the policy needs

- **Confirmed from the code:** everything in sections 1 to 8 above that isn't marked [confirm].
- **For you to confirm:**
  - the registered office (the PedalUK agreement and our records differ)
  - privacy contact inbox
  - Supabase and Sentry regions
  - SendZen location
  - Verso and AI route-planning data
  - retention periods you want
  - whether you send marketing
  - partner couriers and ferry partner names
- **Recommendations (not done):**
  - add a cookie consent banner
  - mask text in Sentry recordings or switch recording off
  - remove location data from uploaded photos
  - add automatic deletion that matches the policy
  - limit attempts on the basic tracking lookup
- **For a solicitor or data protection adviser:**
  - US transfer safeguards (Data Bridge / International Data Transfer Agreement)
  - lawful basis for the review WhatsApps
  - the controller/processor split for business clients
  - storing drivers' licence images
  - the PedalUK 30-day deletion clause, compared with keeping records 6 years for tax

## Next step after approval

Write the new privacy policy using only the confirmed facts, and leave clearly marked placeholders for each item still to confirm. No other app changes.
