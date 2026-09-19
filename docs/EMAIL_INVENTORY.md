# Email inventory

Every email this platform sends, what triggers it, who receives it, and what it
contains. Written for wireframing — one entry per email, with the content blocks
a design needs to account for.

All emails now share one design, defined in
`supabase/functions/_shared/emailLayout.ts` (tokens mirrored for the app in
`src/utils/emailBrand.ts`).

## Shared design

- Sender: `CCC - Cycle Courier Co. <Ccc@notification.cyclecourierco.com>`, reply-to `Info@cyclecourierco.com`.
- 600px wide for customer/partner mail, 760px for internal reports.
- Light only. White content card on a pale grey page, 1px border, 6px radius.
- Header: solid motorway-blue bar with the wordmark and an optional eyebrow label.
- Footer: company name, email, phone, website, then the legal block (Cycorco Ltd, registered office, company no., VAT no.).
- Body blocks available to every email: headline, paragraphs, detail panel (label/value rows), one primary button, secondary links, status pill.
- Palette mirrors the portal: primary `#0B61B1`, text `#16191D`, muted `#5C6570`, border `#D8DEE4`, panel `#F2F5F7`, page `#EDF1F4`. Type: Overpass with system fallbacks.

Wireframes only need a handful of shapes:

1. **Action email** — headline, short body, detail panel, one button. (Availability requests, approvals, offers.)
2. **Status email** — headline, one or two lines, detail panel, tracking button. (Collected, delivered, booked, ferry.)
3. **Document email** — headline, short body, attachment note, optional link. (Invoices, reports, timeslips.)
4. **Report email** — wide, headline, one or more dense tables, totals row. (Internal reports.)
5. **Freeform email** — headline from the subject, typed body. (Announcements.)

---

## 1. Customer — order journey

| Email | Trigger | To | Subject | Content |
| --- | --- | --- | --- | --- |
| Order created | Order booked in the portal, API or Shopify | Sender | Your Order Has Been Created | Tracking number, bike, addresses, what happens next, tracking button |
| Delivery notification | Same booking event | Receiver | Your Bicycle Delivery | Who is sending, bike, expected process, tracking button |
| Collection availability request | Order needs sender dates | Sender | We need your collection dates for {bike} | Why dates are needed, date-picker button, postcode-verified link |
| Delivery availability request | Sender dates confirmed, or bike collected | Receiver | We need your delivery dates for {bike} | Same shape, delivery-side wording |
| Sender dates confirmed | Sender submits dates | Sender | Update on {bike} | The chosen dates, what happens next, tracking button |
| Receiver dates confirmed | Receiver submits dates | Receiver | Update on {bike} | Chosen dates, delivery expectations, tracking button |
| Planning your collection | Ops begins scheduling | Sender | We're planning your collection for {bike} | Reassurance, date range, tracking button |
| Collection booked | Timeslot assigned to a route | Sender (copy to receiver) | Your collection is booked for {bike} | Date, time window, address, driver expectations |
| Delivery booked | Delivery timeslot assigned | Receiver (copy to sender) | Your delivery is booked for {bike} | Date, time window, address |
| Collected / safely with us | Driver completes pickup, or ops marks collected | Sender | {bike} is safely with us | Collection confirmation, photos where captured, next step |
| On its way to buyer | Bike leaves for delivery | Sender | {bike} is on its way to {buyer} | Status line, tracking button |
| Delivered (sender) | Driver completes delivery | Sender | Your Bicycle Has Been Delivered | Delivery confirmation, proof of delivery, Trustpilot and Facebook review buttons |
| Delivered (receiver) | Same | Receiver | Your Bicycle Has Been Delivered | Confirmation, review buttons |
| Missed collection | Driver marks failed pickup | Sender | Sorry - we missed your collection for {bike} | Apology, what happens next, contact details |
| Missed delivery | Driver marks failed delivery | Receiver | Sorry - we missed your delivery for {bike} | Apology, rebooking note |
| Generic update | Ops sends a manual update | Sender or receiver | Update on {bike} | Free text plus tracking button |
| Order cancelled | Order cancelled in the portal | Creator, sender, receiver | Order Cancelled - {tracking} | Cancellation notice, reference |

## 2. Customer — Northern Ireland and ferry

| Email | Trigger | To | Content |
| --- | --- | --- | --- |
| Reached the ferry port | Ferry leg pickup completed | Sender/receiver as applicable | Ferry stage explanation, tracking button |
| Crossed the ferry | Ferry crossing recorded | Customer | Stage update, next step on the mainland |
| Inbound NI collection date confirmed | Sender picks one weekday, or staff sets it | Sender | Confirmed date, partner drop-off instructions |
| Inbound NI collection date updated | Staff change the date | Sender | Revised date, prior date noted |

## 3. Customer — Box / Foam My Bike

| Email | Trigger | To | Content |
| --- | --- | --- | --- |
| Bike being boxed | Bike arrives at the depot for boxing | Box buyer | Bike, tracking number, what happens next, tracking button |
| Boxed bike collected | Third-party courier collects | Box buyer | Bike, our reference, courier tracking link |

## 4. Customer — workshop, inspections and repairs

| Email | Trigger | To | Content |
| --- | --- | --- | --- |
| On the way to our service centre | Bike routed to the workshop | Customer | Explanation of the inspection step, tracking button |
| Repairs need approval | Inspection released for approval | Seller/account, or receiver for Shopify | Bike, issue list with parts/labour/totals, approval-link button |
| Optional repairs offer | Repairs declined by the seller but offered on | Receiver | Offered work, prices, accept/decline button |
| Repairs confirmed | Receiver approves repairs | Receiver | Confirmed work, totals, invoice note |
| Repairs declined | All work declined | Staff (internal alert) | Job reference, declined items, resulting status |
| Returning to seller | Approver rejects all repairs | Staff (internal alert) | Original job, new return job, bay |
| Walk-in inspection approval | Walk-in inspection released | Walk-in customer | Bike, quoted work, approval link |
| Inspection report | Report generated | Customer | Report summary, PDF attachment or download link |

## 5. Customer — account

| Email | Trigger | To | Content |
| --- | --- | --- | --- |
| Business registration received | Business signup submitted | Applicant | Confirmation, review timescale |
| New registration needs approval | Same event | Office | Company, contact details, approval link |
| Account approved | Staff approve the account | Applicant | Approval, sign-in button |
| Application status | Staff decline or query | Applicant | Outcome and next step |

## 6. Billing

| Email | Trigger | To | Content |
| --- | --- | --- | --- |
| QuickBooks invoice delivery | Invoice raised | Customer/accounts email | Invoice number, amount, PDF |
| Inspection / service invoice | Repairs approved | Approver | Line items, parts and labour, totals |
| Receiver repair invoice | Receiver-approved repairs | Receiver | Same shape |
| Guaranteed delivery, build, Box My Bike invoices | Service added | Customer | Line items, total |
| Invoice created alert | Invoice raised | Office | Customer, invoice number |
| Weekly invoice batch report | Monday batch cron | Office | Wide table of invoices created, failures, totals |

## 7. Partner

| Email | Trigger | To | Content |
| --- | --- | --- | --- |
| City Air ferry booking | Inbound NI collection date confirmed | City Air operations | Customer, address, date, bike, notes, tracking number |
| City Air booking updated | Staff change the date | City Air operations | Same, marked UPDATED |
| NI partner label request | Label required for a partner leg | Partner | Job reference, upload link |

## 8. Internal / staff

| Email | Trigger | To | Content |
| --- | --- | --- | --- |
| Daily ops report | Nightly cron | Office | Collected and delivered counts, exceptions, tables |
| Customer updates digest | Nightly cron | Office | Emails sent, recipients, per-order rows |
| Parts to order | Nightly cron | Office | Jobs awaiting parts, part names, jobs |
| Weekly driver report | Weekly cron | Office | Per-driver stops, hours, mileage |
| Weekly van report | Weekly cron | Office | Per-van usage, tax/MOT flags |
| Weekly workshop report | Weekly cron | Office | Inspections, repairs, revenue |
| Route report | Route saved/sent | Office | Date, stop count, stop-by-stop audit |
| Timeslips | Timeslip generation | Driver and office | Route, stops, times, PDF |
| Loading list | Loading list distribution | Loaders, management | Bays, vans, handovers, bike list |
| Task assigned | Task assigned in project management | Assignee | Task, due date, estimated duration, link |

## 9. Announcements

| Email | Trigger | To | Content |
| --- | --- | --- | --- |
| Ad-hoc announcement | Staff send from the announcements page | Chosen roles, customers or contacts | Subject as headline, typed body, branded shell |
| Scheduled announcement | Scheduled time reached (cron) | Same | Same |

---

## Where these live

- `supabase/functions/send-email` — the hub most customer emails route through.
- `supabase/functions/send-order-updates` — proactive journey emails.
- `supabase/functions/send-inspection-approval`, `send-repair-offer`, `finalise-public-repair-offer`, `notify-repairs-declined`, `reject-repairs-return-to-seller` — workshop.
- `supabase/functions/send-ferry-partner-notification`, `_shared/ferryPartnerEmail.ts`, `ni-partner-label-upload` — partner.
- `supabase/functions/create-*-invoice`, `weekly-invoice-batch` — billing.
- `supabase/functions/send-internal-reports` (+ `reports.ts`), `send-route-report`, `generate-timeslips`, `send-loading-list-whatsapp`, `send-task-assignment-email` — internal.
- `supabase/functions/process-scheduled-announcements`, `src/utils/announcementEmailTemplate.ts` — announcements.
- `src/services/emailService.ts`, `src/lib/sendOrderUpdateEmail.ts` — app-side senders, all delivered via `send-email`.

Every one of these passes through the shared Resend wrapper in
`supabase/functions/_shared/integrationLog.ts`, which applies the design in one
place, so a change to `emailLayout.ts` changes every email above.
