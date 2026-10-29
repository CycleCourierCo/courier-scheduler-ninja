# Address book speed + Sami's missing repair codes

## What I found

**Address book limit**
- A customer's address book loads up to 5,000 contacts. The biggest account has 4,225, so nobody is cut off yet, but that account will hit the limit soon.
- Admins load every contact in the system before the list opens: 10,558 today, fetched 1,000 at a time. All of them are then drawn in the dropdown at once, which explains the slowness and lag.

**Sami's inspections**
- Sami logged 32 faults on 28–29 Oct. None of them have a repair code or labour price. Before that, most of his faults had both.
- The database is not removing them: none of its rules clear those fields, and mechanics can still read the repair price list.
- The fault text on these lines doesn't match any repair name, so the repair picker was most likely not used or showed nothing. This still needs to be reproduced as a mechanic before I name the cause.

## Plan

1. **Search-as-you-type address book** (same pattern as the admin account picker)
   - The address book stops loading everything up front. It fetches up to 30 matches by name, email, postcode or street after you type 2+ letters, with a short delay between keystrokes.
   - Before you type, it shows your 30 most recently used contacts.
   - When an admin books for a customer, the search covers that customer's contacts; it covers all contacts only when no customer is chosen.
   - This removes the 5,000 cap, because nothing is loaded in bulk any more.
   - Selecting a contact fills the address exactly as it does today.

2. **Find out why Sami's repair codes are missing**
   - Open the inspection checklist as a test mechanic and pick a repair for one fault, then submit. Check that the repair code and labour price are saved.
   - Also check whether the repair list loads for the bike categories he used (Road, Folding, Electric MTB and others), and whether an error is hidden when it fails.
   - Fix whatever stops the code and price reaching the save. If the picker failed without telling him, show an error message on the fault line.

3. **Sort out the 32 existing faults**
   - List them for you, grouped by bike. For each one, suggest the closest repair code from the price list.
   - You approve the suggestions, or price them yourself on the inspection page. Nothing is changed without your go-ahead.

## Technical details
- `ContactSelector` becomes async: a debounced `.or(name.ilike,email.ilike,postal_code.ilike,street.ilike)` query with `.limit(30)`, scoped by `user_id` (the selected booking account for admins). `useContacts` bulk load and `fetchAllContacts` are removed from the booking flow; other callers (`AnnouncementEmailsPage`) are left alone. Add a `contacts(user_id, name)` index if the query plan needs one.
- Mechanic reproduction: through Playwright with a minted mechanic session, follow `RepairPicker` → `patchChecklistIssue` → `addMultipleIssuesMutation` → `addInspectionIssue` insert payload, and capture the network request to see whether `repair_id`/`labour_cost` are sent.
- Backfill only with explicit approval, via `setIssuePrice`/update with `repair_id`.
