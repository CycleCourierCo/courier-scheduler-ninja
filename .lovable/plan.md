## Step-by-Step Claim Workflow

### 1. Database migration
- Add new values to `claim_status` enum: `opened`, `info_requested`, `info_provided`, `assessment`, `settlement_proposed`, `negotiation`, `settlement_agreed`.
- Add `is_system boolean NOT NULL DEFAULT false` to `claim_notes`.
- Existing values (`open`, `awaiting_info`, `under_review`, `offer_made`, `settled`, `rejected`, `closed`) remain valid; existing claims continue to work and are mapped to the nearest new step in the UI.

### 2. Service layer (`src/services/claimsService.ts`)
- Update `ClaimStatus` types and human labels for the 8-step flow + `rejected`.
- Add `advanceClaim(id, extraData?)`:
  - Determines next step from current status.
  - Validates required data per step (e.g. `settlement_proposed` requires `offer_amount`).
  - Updates the claim status and writes a system note to `claim_notes` (with `is_system=true`) describing the transition (e.g. "Settlement of £450.00 proposed on 5 May 2026 by Jane").
- Keep manual note creation for ad-hoc admin notes.

### 3. UI (`src/pages/ClaimDetail.tsx`)
- Add a horizontal `ClaimStepper` component at the top showing all 8 steps with current/done/upcoming states.
- Replace ad-hoc status buttons with:
  - Primary "Advance to: {Next Step}" button.
  - Secondary "Reject claim" button (terminal).
  - Step-specific dialog when extra data is needed (offer amount, settlement notes, payment reference, etc.).
- Notes timeline: render system notes with a distinct style ("System") vs admin-typed notes.
- Keep the existing free-form note input for manual notes.

### 4. Verification
- Open a claim → starts at "Opened".
- Click Advance → progresses through each step; dialogs appear where data is required.
- Verify a system note is added in the timeline at every transition.
- Confirm legacy claims still load and map to the nearest step.

### Step flow
```text
opened → info_requested → info_provided → assessment →
settlement_proposed → negotiation (optional) →
settlement_agreed → closed
                              ↘ rejected (terminal, available any step)
```
