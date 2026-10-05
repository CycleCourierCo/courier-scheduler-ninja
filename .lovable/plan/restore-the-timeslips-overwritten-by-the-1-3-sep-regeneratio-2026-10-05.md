# Restore the timeslips overwritten by the 1–3 Sep regeneration

## What happened
Tonight (00:44) timeslips were regenerated for 31 Aug, 1, 2 and 3 Sep. The generator overwrites any existing timeslip for that driver and day, so 18 timeslips that were approved on 14 Sep were reset to **draft**, and their hours, lunch, rate, mileage, vehicle and extras were replaced with fresh auto-calculated values. Approval date and approver were kept, which tells us exactly which ones were approved.

- 1 Sep: Kamran, Majid, Mohammed Abdullah, Sajid, Surfraz, Umer (6)
- 2 Sep: Kamran, Majid, Mohammed Abdullah, Sajid, Surfraz, Umer (6)
- 3 Sep: Majid, Mohammed Abdullah, Sajid, Surfraz, Umer, Zabar (6)
- One new timeslip was created: Osman Akhtar, 1 Sep (draft, £75) — he had none before.
- 31 Aug: nothing changed.

## The fix
1. Set the 18 timeslips back to **approved** (approval date/approver are still there).
2. Remove the new Osman Akhtar 1 Sep draft, so things are exactly as before tonight (unless you want to keep it).
3. Stop this happening again: the generator will skip any timeslip that is already approved, and only refresh drafts.

## Important limitation
Any manual edits you made before approving (hours, extras, lunch, mileage, vehicle, notes on pay) were overwritten and are not stored anywhere in the app. The pay amounts now shown are the auto-generated figures. Getting the exact old values back needs a database point-in-time restore from your Supabase backups (dashboard, before 00:44 UTC 5 Oct). If those figures matter, check the payroll you already paid for those days against what will show after the fix.

## Technical notes
- Data fix: `UPDATE timeslips SET status='approved' WHERE date BETWEEN '2026-09-01' AND '2026-09-03' AND approved_at IS NOT NULL AND status='draft'`; delete Osman's row created 2026-10-05 00:44.
- `generate-timeslips`: before upsert, fetch existing row for driver/date; if status = 'approved', skip and add a warning.
