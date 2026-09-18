# Inspection approvals: who gets them, and a copy-link button

## Answer: who approvals go to today

For an inspection attached to a real order (including Shopify orders), the approval request goes to **the booking account** (the seller's account email, or their accounts email if set) unless a staff member changes it.

It only "asks" in a limited way:
- There is a "Who approves?" dropdown on the inspection card — seller (account) or buyer (receiver) — but it is shown only to admins, only once the inspection is in "issues found", and it applies to the "Send approval request" button.
- The first approval email fires automatically at "Release to Customer", before anyone touches that dropdown. So a Shopify inspection released without changing anything emails the store account, not the buyer.

## What to change

1. **Ask at release time.** When releasing an inspection that belongs to an order, ask who should approve (seller account / buyer) instead of silently defaulting. For Shopify orders the buyer is pre-selected; for normal orders the seller account is pre-selected. Walk-in (workshop-only) inspections keep going straight to the walk-in customer with no prompt.
2. **Copy approvals link.** Add a "Copy approval link" button next to "Send approval request" / "Download report" so staff can paste the link into a manual email or WhatsApp. Copies the public approval URL, shows a confirmation toast, and falls back to showing the link in a small dialog if the browser blocks clipboard access (Safari).
3. Keep showing who the last approval request went to, as it does now.

## Technical notes

- `src/services/inspectionService.ts`: `releaseInspectionToCustomer` currently calls `sendInspectionApprovalEmail(inspectionId)` with no recipient, so the edge function falls back to the stored `approval_recipient` or `customer`. Pass the chosen recipient through, and persist it via the existing `setApprovalRecipient` before sending.
- `src/pages/BicycleInspections.tsx`: add the release-time recipient prompt (reusing the existing select options) and the copy-link button; keep the existing admin-only "Send approval request" controls.
- Approval link is the existing public route `/inspection-approval/:id`; build it from the app origin. Receiver-offer flows keep their own link.
- No database or edge-function changes required; `send-inspection-approval` already accepts an explicit `recipient`.
