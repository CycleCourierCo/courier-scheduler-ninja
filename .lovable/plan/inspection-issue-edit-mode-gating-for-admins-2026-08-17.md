# Inspection issue edit-mode gating for admins

## Goal
On the bicycle inspections page, admin users currently see the full set of editable controls for every inspection issue at all times (price inputs, Approve/Decline/Reset overrides, Edit/Remove buttons). This makes the UI noisy and easy to accidentally modify. Switch the admin experience to a read-only default with a single **Edit** toggle per issue that reveals the controls.

## What will change

### Scope
`src/pages/BicycleInspections.tsx` only. No backend, service, or type changes are required.

### Current behavior
- For admin users, each issue card always renders:
  - Parts/Labour price inputs and Save button
  - Approve / Decline / Reset-to-pending override buttons
  - Edit / Remove buttons
- The full inline edit form is already gated by `editingIssueId`, but the price/admin controls above it are not.

### New behavior
1. **Default read-only mode for admins**
   - Each issue card shows the issue description, status badge, cost breakdown, reporter, and any part/customer info.
   - A single **Edit** button appears per issue.
2. **Edit mode for admins**
   - Clicking the issue-level **Edit** button puts that issue into admin edit mode.
   - While in edit mode, the card reveals:
     - Parts / Labour price inputs and Save button
     - Approve / Decline / Reset-to-pending override buttons
     - Edit / Remove buttons (the existing full form can still be opened from the Edit button)
   - A **Cancel** button exits admin edit mode and discards any unsaved price input changes.
3. **Mechanics unchanged**
   - Users with the `mechanic` role (and not `admin`) continue to see the price inputs directly while the inspection is in `awaiting_pricing`, because that is their dedicated workflow stage.
4. **State management**
   - Add a new `adminEditingIssueIds` state (a `Set<string>` or `Record<string, boolean>`) to track which issues are expanded for admin editing.
   - The existing `editingIssueId` and `editIssueDraft` state continues to handle the full inline edit form independently.
   - Existing `priceInputs` state is cleared when admin edit mode is cancelled so stale values do not reappear.

## Implementation notes
- Wrap the current price/admin block (currently rendered for `isAdmin || (canManageInspections && isAwaitingPricing)` and `editingIssueId !== issue.id`) so that for admin users it only renders when `adminEditingIssueIds.has(issue.id)` is true.
- For mechanics, keep the existing condition: `canManageInspections && isAwaitingPricing`.
- The read-only default for admin still shows the price summary text ("Estimated Cost: £...") and the issue badge so admins can scan values without editing.
- Ensure the admin edit toggle does not affect the parts-ordered / parts-arrived checkboxes (which should remain visible where they are today) or the customer response section.
