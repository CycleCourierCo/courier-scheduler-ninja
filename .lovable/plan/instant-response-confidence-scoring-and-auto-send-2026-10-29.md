# Instant response confidence scoring and auto-send

## Goal
Measure how often each instant response is the right answer, give it a confidence score, and let an admin switch on automatic sending for responses that have earned it.

## How confidence is earned
Every time the inbox fills in a suggestion, we record what the staff member did with it:

- **Sent as is** — strong yes
- **Sent with small edits** (most of the wording kept) — partial yes
- **Heavily rewritten** or **swapped for another response** — no
- **Cleared and wrote their own reply** — no

The score for each response:
- Confidence = weighted share of "yes" outcomes over its last 50 uses (sent as is = 1, small edits = 0.5, anything else = 0).
- A response needs **at least 30 uses** before a score is shown as trustworthy; until then it shows "Learning (12/30)".
- Bands: **High 90%+**, **Medium 70–89%**, **Low under 70%**.

The "match strength" (how many trigger words hit) is recorded too, so we learn that a response may be reliable only when the match is strong.

## Where staff see it
- **Inbox reply box:** each suggestion chip shows its confidence badge.
- **Queues → Instant responses:** new columns for uses, sent as is, edited, replaced, confidence and trend. Clicking a response shows recent cases where it was rejected, so trigger words can be tightened.
- **Analytics → Customer Service:** a new "Instant response accuracy" card listing top and worst responses.

## Auto-send (no human in the loop)
- Each response gets an **Auto-send** switch, available only when it is High confidence with 30+ uses. Only admins can turn it on.
- When a customer message arrives and the best match is an auto-send response with a strong match, the system replies immediately (email, or WhatsApp inside the 24-hour window), marked "Auto-sent" in the chat.
- The ticket stays open/pending as normal so staff still see it; a reply from the customer comes back to the team.

## Safety rules
- Never auto-send for damage/claims, complaints, cancellations or invoice disputes, or if the message mentions words like refund, damaged, broken, solicitor or complaint.
- Never auto-send twice in a row on the same ticket, or if staff replied in the last hour.
- Never auto-send when two responses score close together (ambiguous match).
- If its confidence drops below 85% or staff mark an auto-send as wrong ("Wrong auto-reply" button), auto-send switches itself off and admins get an email.
- Paused for out-of-hours if you'd prefer the existing out-of-hours acknowledgement to go instead.

## Rollout
1. Start recording outcomes straight away (no behaviour change).
2. After a few weeks the scores fill in; you choose which responses to switch on.
3. Optional "trial mode": an auto-send candidate is logged as "would have sent" without sending, so you can review accuracy before going live.

## Technical details
- New table `cs_canned_usage` (response_id, conversation_id, inbound_message_id, match_score, runner_up_score, outcome, similarity, staff_id, auto_sent, flagged_wrong, created_at); staff-only RLS, explicit grants.
- `cs_canned_responses` gains `auto_send_enabled`, `auto_send_mode` (off/trial/live), `blocked_from_auto` flag for sensitive categories.
- Composer records the suggested response on fill; the send path compares the sent text with the filled text (word-level similarity: 95%+ = as is, 60–95% = small edit) and writes the outcome.
- Shared pure scoring module in `supabase/functions/_shared/cannedConfidence.ts` (no imports) used by the app and the inbound functions, with Vitest tests for confidence maths, eligibility and safety blocks.
- `cs-inbound-email` and `cs-inbound-whatsapp` call one auto-reply helper after saving the message; it re-checks eligibility server-side, sends via the existing reply path in the background, and logs to `cs_canned_usage`.
- A database view/function computes rolling confidence; a trigger disables auto-send when the threshold is breached.
