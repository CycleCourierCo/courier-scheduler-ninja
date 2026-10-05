# Audit 2: what the business-client data agreement needs to cover (no code changed)

This builds on audit 1. The findings come from the code and the live database. **[CONFIRM]** means the code can't prove it. This is not legal advice.

## A. Controller or processor, by activity

| Activity | Role | Why |
|---|---|---|
| Collection/delivery, route planning, proof of delivery | Processor | The client orders the job; we use their customer's details only to do it |
| Timeslot WhatsApps/emails | Processor (probably) | Part of carrying out the job. Sent in our name with our wording, so put it in the agreement as an instruction |
| SMS | n/a | The app doesn't send SMS. Shipday may text tracking links [CONFIRM] |
| **Review request WhatsApps** | **Independent controller** | Staff send them by hand to the sender or receiver, for our own benefit. No opt-out and no business-client check in the code |
| Customer service (inbound WhatsApp/email) | Mixed | Questions about the job: processor. Complaints about us: controller |
| **Address book saving** | Processor, but needs saying | Every order saves sender and receiver into the *booking account's* own address book (`orders` function, around lines 597-640). This is the client's data, but the agreement should state it |
| **Analytics (PostHog/Sentry)** | **Controller** | Our own product analytics. Customers who open the tracking page are tracked |
| Inspection/repair offers | Mixed or joint | Staff choose who gets the offer: the booking account, the sender or the receiver (default: receiver). Offering paid repairs to the client's customer is our own commercial activity unless the client tells us to |
| Claims | Controller | Our liability and our insurance |
| Customer webhooks | Processor | The client's own data sent to the client's own address |
| Fraud/security (postcode checks, IP logs) | Controller | Our own legitimate interest |
| Retention and backups | Controller in practice | We decide how long data is kept, and it's currently kept forever |

## B. Outside services (sub-processors)

| Provider | Service | Data | Region | Transfer mechanism | Their data agreement | Can we object to their changes? |
|---|---|---|---|---|---|---|
| Supabase Inc. | Database, login, files | Everything | [CONFIRM project region] | [CONFIRM] | Yes, standard terms | Notice only |
| Shipday Inc. | Driver dispatch, proof of delivery | Names, addresses, phones, notes, photos, signatures | US [CONFIRM] | [CONFIRM] | [CONFIRM] | [CONFIRM] |
| SendZen (and Meta WhatsApp) | WhatsApp | Phone, name, bike, times, order number, message text | [CONFIRM] | [CONFIRM] | [CONFIRM] | [CONFIRM] |
| Resend Inc. | Email in and out | Email, name, order details, inbound email text | US | [CONFIRM] | Yes [CONFIRM signed] | Notice only |
| Intuit (QuickBooks) | Invoicing | Billing customer, invoice lines with tracking/order references | US/global | [CONFIRM] | Yes | No |
| Google (Maps, via Lovable connector) | Geocoding, route lines | Addresses / coordinates | US | [CONFIRM] | Yes | No |
| Geoapify | Geocoding/routing, fuel stations | Addresses/coordinates | Germany (EU, UK adequacy) | Adequacy | [CONFIRM] | [CONFIRM] |
| Verso (hosted VROOM) | Route optimisation | Coordinates, time windows [CONFIRM no names] | [CONFIRM] | [CONFIRM] | [CONFIRM] | [CONFIRM] |
| Functional Software (Sentry) | Errors + session recording | IP, headers, user ID + email, screen recordings | [CONFIRM US/EU org] | [CONFIRM] | Yes | Notice only |
| PostHog Inc. | Analytics | Page views, clicks, on-screen text, staff email | EU host | Adequacy | Yes | Notice only |
| Shopify | Incoming website orders | Customer details (incoming) | Global | n/a (we receive) | n/a | n/a |
| Inspectabike | Inspections | Bike/job details, possibly the customer's name [CONFIRM] | UK [CONFIRM] | n/a | [CONFIRM] | [CONFIRM] |
| Lovable (hosting/connector gateway) | App hosting, Maps calls | Coordinates; page traffic | [CONFIRM] | [CONFIRM] | [CONFIRM] | [CONFIRM] |
| Partner couriers / NI ferry partner | Hand-offs | Name, address, phone, bike | UK | n/a | [CONFIRM written contracts] | n/a |

No AI provider (Gemini or similar) receives data. That claim in audit 1 was wrong.

## C. Data leaving the UK

| From | To | Data | Country |
|---|---|---|---|
| Order creation / sync | Shipday | Full job details plus proof of delivery | US [CONFIRM] |
| Emails / support inbox | Resend | Contact details, message text | US |
| Invoicing | QuickBooks | Billing details | US |
| Geocoding / route lines | Google | Addresses/coordinates | US |
| Browser | Sentry | IP, email, screen recordings | [CONFIRM] |
| Browser | PostHog | Usage, on-screen text | EU |
| Geocoding | Geoapify | Addresses | Germany |
| Database | Supabase | Everything | [CONFIRM] |
| WhatsApp | SendZen / Meta | Phone, message | [CONFIRM] / global |

## D. Deletion

| Data | Can it be deleted? |
|---|---|
| Orders | Admins can delete. **Deleting a business account's user also deletes every one of its orders**, along with their inspections, comments, invoice links and webhook logs. This is a data-loss and tax-records risk |
| Contacts | Yes: owner or staff can delete |
| Photos/files | No delete feature in the app. Files can only be removed by hand from storage |
| Proof of delivery | Lives at Shipday. `delete-shipday-order` removes Shipday jobs, but [CONFIRM] whether that removes the photos |
| Messages (customer service) | No delete feature |
| Inspections | Delete permission exists [CONFIRM UI] |
| Claims | No delete permission |
| Webhook logs | Removed only when the order is deleted. They store the full payload, including customer contact details |
| Integration call logs | Automatic nightly clean-up |
| Analytics | Only through the PostHog/Sentry dashboards |
| Backups | Supabase controls these [CONFIRM how long kept] |

**Deleting one client's data:** not possible in a safe, controlled way today. The only route is deleting the user, which wipes all their orders and leaves photos, messages and Shipday records behind.

## E. Driver devices

The app has no camera upload for drivers. Collection and delivery photos and signatures are taken in the **Shipday driver app** and stay on Shipday's servers. The app has no way to remove copies on the phone, wipe devices, or stop drivers using photos for themselves. That has to come from policy and Shipday settings.

## F. Special category data (health, disability and so on)

There is **no field designed** to hold health or accessibility details. It could only turn up by chance in free-text fields:
- order notes (`delivery_instructions`, `sender_notes`, `receiver_notes`)
- order comments
- customer service messages
- claims notes
- inspection notes

## G. Webhooks to clients

- **Who sets it up:** the client does it themselves (any signed-in account). The client chooses the destination.
- **What's sent:** order ID, tracking number, customer order number, status, **full sender and receiver details (name, address, phone, email)**, bikes, dates, and Box-My-Bike fields.
- **Signing:** HMAC-SHA256 in `X-Webhook-Signature`, with each client's secret stored in Vault.
- **Retries:** 3 tries (1, 2 and 4 seconds apart), 30-second timeout.
- **Logs:** `webhook_delivery_logs` stores the full payload plus up to 5,000 characters of the response. They are never cleaned up.

## H. Public tracking page

- **Tracking number, order ID or customer order number, no postcode:**
  - Shown: sender and receiver name, city and country; bikes; dates/timeslots; status timeline; notes; inspection summary; business opening hours; whether proof of delivery exists.
  - Not shown: no street address, postcode, phone or email.
- **With the correct postcode:** also shows that side's proof-of-delivery photos and signature, and for the receiver, the foam delivery photos. 10 tries per 10 minutes per order/IP.
- **Risk:** the basic lookup has **no attempt limit**. Customer order numbers are set by the client and may be short or in sequence, and `sender_notes` / `receiver_notes` are shown without the postcode. Names, towns and notes can therefore be found by guessing numbers.

## I. Analytics and session recording

- **PostHog:**
  - runs on every page, including tracking
  - records clicks automatically; element details are masked but **on-screen text is not**, so names and addresses shown on screen can be captured
  - typed form input isn't captured
  - session recording is off
  - signed-in users are identified by ID and **email**
  - uses cookies and browser storage
- **Sentry:**
  - `sendDefaultPii: true`, so IP and headers are sent
  - user ID and **email** are attached
  - 10% of sessions are recorded, plus every session that hits an error
  - no masking settings are set, so it relies on the defaults (mask text, block media) [CONFIRM installed version]
- **No cookie consent banner.**

## J. Items that MUST be resolved before Cycorco signs a DPA with a business client

| # | Rank | Issue | What's needed |
|---|---|---|---|
| 1 | CRITICAL | No way to delete or return one client's data. Deleting the user wipes all their orders and leaves files, messages and Shipday records behind | Technical: a per-client delete/anonymise and export job. Contract: delete/return clause with realistic timings, plus an exception for tax records |
| 2 | CRITICAL | Data kept forever, which conflicts with deletion periods clients ask for (PedalUK wants 30 days) | Technical: automatic retention. Contract: retention schedule in the agreement, keeping invoice data for 6 years |
| 3 | CRITICAL | US transfers (Shipday, Resend, QuickBooks, Google, maybe Sentry/Supabase) without documented safeguards | Contract: transfer clause with Data Bridge / International Data Transfer Agreement / UK Addendum. Admin: collect each provider's data agreement |
| 4 | HIGH | Review WhatsApps and repair offers go to the client's customers for our own benefit | Contract: name them as permitted instructions or exclude them. Technical: a per-client switch |
| 5 | HIGH | Basic tracking lookup can be guessed and shows names, towns and notes | Technical: attempt limit, require the postcode before names/notes show, hide notes |
| 6 | HIGH | Sentry recordings and PostHog on-screen text can capture client customer data, and there's no consent banner | Technical: mask or disable on the tracking and staff pages, plus a consent banner. Contract: list them as sub-processors, or keep client data out of them |
| 7 | HIGH | Sub-processor list, regions and agreements not confirmed | Admin: a confirmed sub-processor schedule. Contract: process for notifying and objecting to new ones |
| 8 | MEDIUM | Webhook logs keep full contact details forever | Technical: clean-up after X days. Contract: covered under deletion |
| 9 | MEDIUM | Proof-of-delivery photos stay on Shipday; deletion and keep-period unknown | Admin: confirm Shipday's retention and deletion. Contract: list Shipday by name |
| 10 | MEDIUM | Free-text notes may contain health information | Contract: special category clause (use only for the job). Technical: staff guidance |
| 11 | MEDIUM | Deleting a business account wipes invoice-linked orders | Technical: block user deletion when orders exist, or anonymise instead |
| 12 | LOW | Address book auto-saves contacts | Contract: describe it as part of the service |
| 13 | LOW | Driver devices are outside the app's control | Contract: device and security measures schedule. Policy: Shipday app settings, phone passcodes |
| 14 | LOW | Earlier security scan warnings still open | Technical: work through the security findings before any audit-rights clause is used |

## Next step after approval

Nothing gets built automatically. Tell me which items above you want fixed in the app, or ask me to draft the agreement or the privacy policy using these facts.
