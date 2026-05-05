## Step-aware advance dialogs

Right now the "Advance to: …" button only shows a settlement form, and every other step just bumps status with no context. We'll replace it with a single dialog that renders the form fields for whichever step you're moving into, then advances and writes a system note in one go.

### New component: `src/components/claims/ClaimAdvanceDialog.tsx`
A dialog that adapts its body to `nextStatus`:

- **Info Requested** — checklist of evidence items being requested + optional message-to-customer note.
- **Info Provided** — same evidence checklist (tick what's now received) + optional note.
- **Assessment** — assessor toggle + name, repair quote (£), market value (£), assessment notes.
- **Settlement Proposed** — offer amount (£, required), offer date, settlement notes.
- **Negotiation** — latest amount under discussion + required negotiation note (e.g. "Customer rejected £450, wants £600").
- **Settlement Agreed** — agreed amount, payment reference, title-transferred checkbox, optional note.
- **Closed** — closing remarks (optional).

Per-step validation runs before allowing confirm (e.g. negotiation requires a note, settlement_proposed requires an amount).

### `src/pages/ClaimDetail.tsx`
- Replace the existing settlement-only `Dialog` with `<ClaimAdvanceDialog>`.
- The "Advance to: {next}" button always opens the dialog (no special-case for settlement).
- On confirm:
  1. Save the captured fields via `updateClaim`.
  2. Call `advanceClaim` to move to the next step (which writes the auto system note).
  3. If the user added a manual note in the dialog, append it as a regular note.
  4. Reload claim, notes, and status log.

### Verification
Open a claim → click Advance → see the correct form for that step (e.g. evidence checklist when requesting info, amount field when proposing settlement, free-text note when negotiating) → confirm → claim moves on, fields are saved, and both the system note and any manual note appear in the History timeline.
