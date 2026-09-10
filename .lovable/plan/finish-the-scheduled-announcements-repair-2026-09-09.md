# Finish the scheduled-announcements repair

The proactive customer emails are fixed and running: a full pass went out at 17:45 today, 374 emails sent, 3 failures across 7 batches, and the daily 08:00 run will now work on its own.

One item is left over. The scheduled-announcements checker has been failing every minute since 3 September because it is registered under a restricted database user that isn't allowed to run it, so scheduled announcements have not been sent. The attempt to re-register it was refused because it had to be removed by its internal number rather than by name.

## Plan

1. Remove the existing announcements checker by its internal job number and register it again under the correct database user, on the same every-minute schedule it has always had (1,440 checks a day — needed so an announcement goes out within a minute of its due time; it uses a small amount of database resource even when there is nothing to send).
2. Confirm the next few minutes of runs complete successfully instead of failing.
3. Check whether any announcements were scheduled to go out between 3 and 9 September and are still waiting, and report what is pending so you can decide whether to send them now.

## Also worth knowing

- The same wrong-database-user problem affects an older duplicate timeslip job. It currently runs without failing, and the newer version of that job also runs, so I will leave it alone unless you want the duplicate removed.
