# Show the buyer's repair offer link on the job

## What's happening
The buyer's link for CCC754955533653MUHAL4 works. It shows the gear cable as already approved, and the two brake cables and the bar tape (£95) for the buyer to decide on. The problem is the job card: the "Offer declined repairs" box has only a Send/Re-send button and no way to copy the link. The "Copy approval link" button sits in a separate part of the card that isn't shown for jobs at this stage.

## Change
- In the "Offer declined repairs" box, once an offer has been sent, add a **Copy buyer link** button next to "Re-send this offer". It copies `/repair-offer/<order>` and shows the link in a pop-up if copying is blocked.
- Show the link text under the box, e.g. "Buyer link: booking.cyclecourierco.com/repair-offer/…", so it's visible without clicking.
- Keep the box visible while the job is Pending receiver approval, even when nothing is left to offer, so the link and "Last offered" date stay on screen until the buyer answers.

For this job right now, the link is:
https://booking.cyclecourierco.com/repair-offer/db9ae879-9f0c-4010-b63b-df882490b6a5

## Technical details
- `src/pages/BicycleInspections.tsx`: change the offer panel so it shows when `offerableIssues.length > 0` or there are offered issues still awaiting a buyer response. Add a copy button that reuses `copyApprovalLink` / `manualApprovalLink`, plus the read-only link text. Links are built with the existing public app URL helper so they point at booking.cyclecourierco.com.
