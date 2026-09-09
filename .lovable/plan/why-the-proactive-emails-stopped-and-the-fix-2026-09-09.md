# Why the proactive emails stopped — and the fix

## Why it stopped

The 5 September timeline lines up exactly:

- The last successful pass was 4 September at 08:00 (8 chunks, ~115 emails sent).
- The update job was re-deployed on 5 September at 07:34 — 26 minutes before that morning's 08:00 run.
- From that 08:00 run onwards there is no pass record and no proactive emails, every day since.

The morning trigger itself is healthy: it still runs daily (confirmed today at 08:00) and still queues its calls. But the call it sends carries only the internal shared secret — no Supabase key. The update job is one of the few jobs with no entry in the function settings file, so the re-deploy on 5 September left it requiring a Supabase key on every request. The morning call has been turned away at the door ever since, which is why nothing is logged at all: the job never starts.

Two other things surfaced while checking:

- The scheduled-announcements job has failed every single minute since 3 September ("permission denied"), because it was registered under a restricted database user that isn't allowed to run it. That means scheduled announcements have not gone out either.
- The 4 September pass had a high failure rate (roughly 82 of 197 emails failed), so the sending throttle needs a look once the job runs again.

## Plan

1. **Let the morning call through.** Add the update job to the function settings file so it does not demand a Supabase key, and re-deploy it. Also add the project key to the morning trigger's call so it survives any future re-deploy either way.
2. **Prove it with a harmless call.** Trigger the job for one already-delivered order — that order is due nothing, so no customer email goes out — and confirm it is accepted and starts, rather than being turned away.
3. **Run a real pass and check it.** Trigger the full daily pass the same way 08:00 does, then confirm new pass records appear with a sent count above zero and matching emails logged.
4. **Fix scheduled announcements.** Re-register that minute-by-minute job under the correct database user so it stops failing, and confirm it runs cleanly.
5. **Review the 4 September failures.** Look at why roughly 4 in 10 emails failed that day and adjust the send pacing if it was throttling.
6. **Make silence visible.** Record a row for every pass, including one that is rejected before it starts, and include yesterday's proactive-update count in the daily internal report so a zero day is obvious the next morning.

## Notes

- Nobody gets a flood of backdated mail: the quiet-period rule means each customer receives only their next due update.
- No database structure changes are needed.
