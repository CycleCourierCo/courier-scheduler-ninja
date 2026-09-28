# Stop inspection stages changing back and forth

Both reported jobs are currently **Pending receiver approval**:

- `CCC754927671284LOUCO9`: one approved repair and one declined repair awaiting the buyer.
- `CCC754955533653MUHAL4`: one approved repair and three declined repairs awaiting the buyer.

That is the correct stage for both. The status is unstable because stage decisions are still made in several separate places, while direct inspection-status updates are allowed without one database rule enforcing the buyer-wait condition.

## Fix

- Add one database-level stage guard for inspection updates. For a transport job whose original approval recipient was the account or sender:
  - declined work not yet offered forces **Repairs declined**;
  - declined work offered but unanswered forces **Pending receiver approval**;
  - **Awaiting parts**, **Awaiting repair**, **Repaired**, and **Ship as is** cannot be saved until every declined repair has received the buyer's decision.
- Keep workshop-only jobs and jobs whose original approval went directly to the receiver/walk-in customer outside this onward-buyer rule.
- Update the public buyer-response function to use the same ordering: unresolved buyer decisions first, then parts/repair readiness, then the terminal stage.
- Keep the workshop page reconciler aligned with that rule, but make it reconcile only the affected inspection after an action rather than rewriting unrelated inspections.
- Correct these two records to **Pending receiver approval** in the migration so they start from the intended state.

## Verification

Test both mixed-response cases through the full sequence:

1. Account approves some repairs and declines others → **Repairs declined**.
2. Staff sends the buyer offer → **Pending receiver approval**.
3. Refreshing the workshop page or changing parts flags does not move it forward.
4. Buyer answers every offered repair → move once to **Awaiting parts**, **Awaiting repair**, **Repaired**, or **Ship as is**, based on the resulting work.
5. Confirm workshop-only and direct-to-receiver approvals retain their existing behaviour.
