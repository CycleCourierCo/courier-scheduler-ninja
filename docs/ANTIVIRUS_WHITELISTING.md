# Getting the site trusted by antivirus and web filters

Last updated: 10 September 2026

There is no single place that whitelists a website everywhere. Every antivirus
company and every network filter keeps its own list, so a "false positive /
re-categorisation" request must be submitted to each vendor separately. Almost
all of them are free and take 1-3 working days.

Work through the tables below and tick the checklist at the bottom.

---

## 1. Domains to submit

Submit **all** of these, not just the main site. Blocking usually hits the
file/photo links and the email domain first.

| Domain | What it is |
| --- | --- |
| `booking.cyclecourierco.com` | The portal customers log into |
| `cyclecourierco.com` | Main site |
| `www.cyclecourierco.com` | Main site (www) |
| `api.cyclecourierco.com` | File, label and delivery-photo links sent to customers |
| `notification.cyclecourierco.com` | Sending domain for our emails |
| `courier-scheduler-ninja.lovable.app` | Fallback address |

---

## 2. Details every form asks for

Paste these straight into the forms.

- **Business name:** Cycorco Ltd, trading as Cycle Courier Co.
- **Registered office:** 30 Wake Green Road, Birmingham, B13 9PB, United Kingdom
- **Company number:** 16220087
- **VAT number:** GB507727188
- **Contact email:** info@cyclecourierco.com (must be on our own domain)
- **Telephone:** +44 121 798 0767
- **Requested category:** Business / Shipping & Logistics / Transportation
- **Site type:** Customer booking portal, HTTPS only, no downloads, no adverts,
  no user-generated public content
- **Where the warning appeared:** product name and version, operating system,
  browser, date, and a screenshot if the form allows one

### Copy-and-paste message

> Hello,
>
> Our website is being incorrectly flagged/blocked by your product. We would
> like to request a review and correct categorisation.
>
> Domains: booking.cyclecourierco.com, cyclecourierco.com,
> www.cyclecourierco.com, api.cyclecourierco.com,
> notification.cyclecourierco.com
>
> We are Cycorco Ltd (trading as Cycle Courier Co.), a UK-registered bicycle
> courier company (Company No. 16220087, VAT GB507727188), registered at
> 30 Wake Green Road, Birmingham, B13 9PB. The site is our customer booking
> and tracking portal. It is served over HTTPS only, offers no software
> downloads, serves no advertising, and hosts no third-party content.
> Requested category: Business / Shipping & Logistics.
>
> Please could you remove the block and update the classification. Happy to
> provide any further verification.
>
> Kind regards,
> Cycle Courier Co. — info@cyclecourierco.com — +44 121 798 0767

---

## 3. Endpoint antivirus and security suites

| Vendor | Where to submit | Notes |
| --- | --- | --- |
| Microsoft Defender / SmartScreen | https://www.microsoft.com/en-us/wdsi/filesubmission (choose "Website") and https://feedback.smartscreen.microsoft.com | Two separate forms; do both. Covers Edge and Windows Security |
| Google Safe Browsing | https://safebrowsing.google.com/safebrowsing/report_error/ | Drives warnings in Chrome, Firefox and Safari. Also check Search Console → Security Issues |
| Norton (Gen Digital) | https://safeweb.norton.com/ → search domain → "Dispute this rating" | Requires a free Norton account |
| McAfee / Trellix | https://sitelookup.mcafee.com/ | "Check single URL", then submit a categorisation dispute |
| Avast | https://www.avast.com/false-positive-file-form.php | Choose URL/website |
| AVG | https://www.avg.com/en-gb/false-positive-file-form | Same engine as Avast, submit anyway |
| Bitdefender | https://www.bitdefender.com/consumer/support/answer/29358/ | Email route: falsepositive@bitdefender.com |
| ESET | https://support.eset.com/en/kb141 | Email: samples@eset.com with subject "False positive URL" |
| Kaspersky | https://opentip.kaspersky.com/ then https://support.kaspersky.com/general/false | Check first, then dispute |
| Malwarebytes | https://forums.malwarebytes.com/forum/122-false-positives/ | Forum post is the official channel |
| Trend Micro | https://global.sitesafety.trendmicro.com/ | Check rating, then "Give feedback" for reclassification |
| Sophos | https://support.sophos.com/support/s/filesubmission | Choose "Website / URL" |
| Webroot / OpenText | https://www.brightcloud.com/tools/change-request-url-categorization.php | Feeds many other products; high priority |
| F-Secure | https://www.f-secure.com/en/business/support-and-downloads/submit-a-sample | Sample submission form accepts URLs |
| Dr.Web | https://vms.drweb.com/sendvirus/ | Category "False positive" |
| Comodo / Xcitium | https://www.xcitium.com/submit-url/ | Also https://verdict.valkyrie.comodo.com |
| G DATA | https://www.gdata.de/hilfe/false-positive | Email: falsepositive@gdata.de |
| Emsisoft | https://www.emsisoft.com/en/support/submit/ | |
| Quttera | https://quttera.com/website-malware-scanner | Rescan clears their cached verdict |
| Sucuri | https://sitecheck.sucuri.net/ | Rescan; used as a source by other scanners |
| VirusTotal | https://www.virustotal.com/gui/home/url | Scan the domains, then dispute any engine that flags us directly with that vendor |

---

## 4. Network and DNS filters

These cause the same blocking on office, school and hotel networks.

| Vendor | Where to submit |
| --- | --- |
| Cisco Talos / Umbrella (OpenDNS) | https://talosintelligence.com/reputation_center (dispute) and https://policy-visibility.umbrella.com |
| Fortinet FortiGuard | https://www.fortiguard.com/faq/wfratingsubmit |
| Palo Alto PAN-DB | https://urlfiltering.paloaltonetworks.com/ |
| Zscaler | https://sitereview.zscaler.com/ |
| Symantec / Broadcom WebPulse | https://sitereview.bluecoat.com/ |
| Barracuda | https://www.barracudacentral.org/report |
| SonicWall | https://www.sonicwall.com/customers/support/contact/ (URL rating request) |
| Netcraft | https://report.netcraft.com/report (dispute an incorrect report) |
| Cloudflare Radar | https://radar.cloudflare.com/domains/feedback |

---

## 5. Email reputation

Our sending domain is judged separately, and a poor email reputation drags the
website reputation down with it.

| Service | Where |
| --- | --- |
| Spamhaus | https://check.spamhaus.org/ → removal request |
| Barracuda Reputation | https://www.barracudacentral.org/lookups |
| SORBS | https://www.sorbs.net/delisting/ |
| Microsoft SNDS + JMRP | https://sendersupport.olc.protection.outlook.com/snds/ |
| Google Postmaster Tools | https://postmaster.google.com/ |

Note: our transactional email is sent through Resend on
`notification.cyclecourierco.com`, so listings usually relate to the domain
rather than an IP we control.

---

## 6. Checks worth doing while submissions are pending

These are the things that trigger flags in the first place.

- [ ] HTTPS only, valid certificate, http redirects to https on every domain
- [ ] SPF, DKIM and DMARC records present for `cyclecourierco.com` and
      `notification.cyclecourierco.com`
- [ ] No mixed content (http assets on an https page)
- [ ] No scripts or images loaded from unfamiliar third-party hosts
      (map pins and fonts are now served from our own site)
- [ ] Google Search Console shows no Security Issues
- [ ] Contact page, Terms and Privacy Policy reachable from the footer
- [ ] Domain WHOIS is not fully private and shows a UK business
- [ ] The domain does not redirect through any shortener

---

## 7. Submission checklist

Record the date submitted and the outcome. Re-check after a week.

| Vendor | Submitted | Response | Result |
| --- | --- | --- | --- |
| Microsoft Defender / SmartScreen | | | |
| Google Safe Browsing | | | |
| Norton | | | |
| McAfee / Trellix | | | |
| Avast | | | |
| AVG | | | |
| Bitdefender | | | |
| ESET | | | |
| Kaspersky | | | |
| Malwarebytes | | | |
| Trend Micro | | | |
| Sophos | | | |
| Webroot / BrightCloud | | | |
| F-Secure | | | |
| Dr.Web | | | |
| Comodo / Xcitium | | | |
| G DATA | | | |
| Emsisoft | | | |
| Quttera | | | |
| Sucuri | | | |
| Cisco Talos / Umbrella | | | |
| Fortinet FortiGuard | | | |
| Palo Alto PAN-DB | | | |
| Zscaler | | | |
| Symantec WebPulse | | | |
| Barracuda | | | |
| SonicWall | | | |
| Netcraft | | | |
| Cloudflare Radar | | | |
| Spamhaus | | | |
| Barracuda Reputation | | | |
| SORBS | | | |
| Microsoft SNDS / JMRP | | | |
| Google Postmaster Tools | | | |

---

## 8. Re-checking a block later

Free lookups that show how each vendor currently rates us:

- https://talosintelligence.com/reputation_center
- https://www.fortiguard.com/webfilter
- https://www.brightcloud.com/tools/url-ip-lookup.php
- https://safeweb.norton.com/
- https://global.sitesafety.trendmicro.com/
- https://sitereview.bluecoat.com/
- https://transparencyreport.google.com/safe-browsing/search
- https://www.virustotal.com/gui/home/url

If a customer reports a block, ask for: the security product and version, the
exact wording of the warning, a screenshot, and whether they are on a home or
work network. That tells us which of the two lists above to chase.
