# Fill Instant responses with real customer queries and replies

The library currently has 7 starter replies (tracking, collection date, delivery date, damage/claim, invoice, quote, holding). They work, but they don't cover most of what customers actually email about, so many tickets get no suggestion.

## What changes

Add around 18 more ready-made replies, each with realistic trigger words taken from how customers actually write, and tighten the trigger words on the existing 7 so suggestions fire more often.

New replies grouped by area:

**Deliveries and tracking**
- Delivery running late / driver didn't arrive
- Nobody will be home — deliver to a neighbour or work address
- Change the delivery address
- What time will the driver come? (timeslot explanation)
- Driver couldn't collect / failed collection — what happens next
- Bike delivered but something is missing (pedals, skewers, accessories)

**Packing and boxing**
- How should I pack the bike / do you box it for me
- Box My Bike — what's included and price
- Do you take the bike away in its box / do I get the box back
- E-bike and battery rules

**Workshop, inspections and repairs**
- Inspection report — what it means and next steps
- Repairs quoted — how to approve or decline
- Repairs declined — bike will ship as it is
- How long will the workshop take

**Northern Ireland and long distance**
- Northern Ireland collections and deliveries — ferry timings
- Scotland and remote postcodes

**Accounts and admin**
- Business account setup / trade pricing
- Invoice copy or statement request
- Cancel or amend an existing booking

**General**
- Out of hours acknowledgement
- Complaint — first response and escalation

Each reply uses the existing placeholders (`{{customer_name}}`, `{{ticket_ref}}`, `{{tracking_number}}`, `{{order_status}}`, `{{my_name}}`) and is written in the tone of the existing replies, signed off as Cycle Courier Co. Every reply stays fully editable in the Instant responses tab afterwards.

## Notes

- Content only: inserted as data rows into `cs_canned_responses`, plus keyword updates on the 7 existing rows. No schema change, no code change, no change to the picker, the suggestion scoring, or sending.
- Trigger words are phrased the way customers write ("where is my bike", "no one will be in", "can I use my own box"), so the suggestion chips match real inbound wording.
- Sort order slots the new replies into their category blocks so the picker list stays grouped and readable.
