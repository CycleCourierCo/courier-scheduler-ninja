# Proactive customer update emails stopped after 4 September

## What the checks show

- The daily 08:00 trigger is still switched on and has fired successfully every morning, including today (9 September).
- The record of each daily pass stops dead on 4 September. Nothing on 5, 6, 7, 8 or 9 September.
- Customer update emails match that: around 125-145 per day up to 4 September, then 0 (only 2 and 4 rows on 7 and 8 September, from manual sends).
- Other emails are unaffected — Resend handled roughly 1,400-2,200 messages yesterday and today, so email sending itself is healthy.
- The update job produced no activity log entries at all in the retained window, while other jobs did. That points to the job either being rejected before it starts or failing the moment it starts, rather than running and deciding there is nothing to send.
- The job's code compiles cleanly and the last change to it (5 September) only reduced how many emails go out at once, so the cause is not yet confirmed. Confirming it is the first step below.

## Plan

1. **Reproduce and read the real error.** Run the job once for a single named order (single-order mode returns its outcome and sends at most that order's emails) and read its live log output. This shows whether the morning call is being turned away, failing on start-up, or erroring part-way.
2. **Fix what that reveals.** Most likely one of: the live copy of the job is out of date or failing to start (redeploy it), the shared secret the morning trigger sends is no longer accepted (realign it), or a query inside the pass is failing (correct it).
3. **Verify end to end.** Trigger a full pass the same way the 08:00 schedule does, then confirm a new daily-pass record appears with a sent count above zero and that the corresponding customer emails are logged as sent.
4. **Make a future silence impossible to miss.** Record a row for every pass, including one that is rejected or fails outright, with the reason. Add the count of yesterday's proactive updates to the existing daily internal report so a zero day is visible the next morning.

## Notes

- Anyone whose update was missed between 5 and 9 September will get their next due update on the following pass; the quiet-period rule means nobody receives a burst of catch-up mail.
- No database schema changes are needed unless step 2 turns up a missing column.
