# Getting the site trusted by antivirus and web filters

There is no single place that whitelists a website everywhere. Each security vendor keeps its own list, so a "false positive / re-categorisation" request has to be submitted to each one. Most are free and take 1-3 working days.

This plan produces one reference document in the project, `docs/ANTIVIRUS_WHITELISTING.md`, containing:

1. The exact list of domains to submit (all of them, not just the main site).
2. Every vendor, its submission page, and what each form asks for.
3. A short copy-and-paste message to use in each form.
4. A checklist to tick off and re-check later.

No application code changes.

## Domains to submit

- booking.cyclecourierco.com (the portal customers log into)
- cyclecourierco.com and www.cyclecourierco.com
- api.cyclecourierco.com (file and photo links sent to customers)
- notification.cyclecourierco.com (sending domain for our emails)
- courier-scheduler-ninja.lovable.app (the fallback address)

## Vendors the document will cover

Endpoint antivirus / security suites:
- Microsoft Defender and SmartScreen (Microsoft Security Intelligence submission)
- Google Safe Browsing (covers Chrome, Firefox, Safari warnings)
- Norton / Gen Digital (Norton Safe Web)
- McAfee / Trellix (SiteAdvisor / Customer URL Ticketing)
- Avast and AVG (shared false-positive form)
- Bitdefender
- ESET
- Kaspersky
- Malwarebytes
- Trend Micro (Site Safety Center)
- Sophos
- Webroot / OpenText (BrightCloud)
- F-Secure
- Dr.Web
- Comodo / Xcitium
- G DATA
- Emsisoft
- Quttera and Sucuri (used by other scanners as a source)

Network and DNS filters (these cause the same blocking on business and school networks):
- Cisco Talos / Umbrella (OpenDNS)
- Fortinet FortiGuard
- Palo Alto PAN-DB
- Zscaler
- Symantec / Broadcom WebPulse
- Barracuda
- SonicWall
- Netcraft
- Cloudflare Radar domain category review

Email deliverability lists, since our email domain gets flagged separately:
- Spamhaus
- Barracuda Reputation
- SORBS
- Microsoft SNDS / JMRP
- Google Postmaster Tools

## What each submission needs

The document will state the standard inputs so they can be pasted quickly:
- Full URL, plus the extra domains listed above
- Category we want (Business / Shipping and Logistics)
- Business name, registered address and company number, plus a contact email on the same domain
- Reason: legitimate UK bicycle courier booking portal, no downloads, no adverts, HTTPS only
- Where the warning appeared (product name, version, screenshot if the form allows one)

## Checks the document will also list

Things that commonly trigger flags and are worth confirming while submissions are pending:
- The site is HTTPS-only with a valid certificate and redirects from http
- The domain has SPF, DKIM and DMARC records (email domain reputation feeds site reputation)
- No mixed content or scripts loaded from unfamiliar third-party hosts
- Google Search Console shows no Security Issues
- A visible contact page, terms and privacy policy (filters weigh these)

## Verification

After the vendors respond, re-check each domain in the free lookup tools the document links (Talos, FortiGuard, BrightCloud, Norton Safe Web, Trend Micro, Google Transparency Report) and record the date and result in the checklist.
