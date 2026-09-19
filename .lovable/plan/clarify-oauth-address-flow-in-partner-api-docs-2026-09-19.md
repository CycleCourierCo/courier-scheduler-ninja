# Clarify OAuth address flow in partner API docs

## Goal
Make the partner documentation teach the connected-app (OAuth) booking flow directly, so apps like VeloDealer know from the first read that they only send `customer_side` and never need the customer's address.

## Changes (docs/API_DOCUMENTATION.md only — no code changes)

1. **Create Order request example**: add a second, shorter "OAuth-connected app" example showing the minimal body — `customer_side: "sender"` (or `"receiver"`), `bikes`, and nothing else for the customer's side — with a comment that name/phone/address are filled automatically.

2. **Required Fields section**: add a note that when `customer_side` is present, the corresponding side's name, phone and address fields are NOT required and any supplied values are ignored.

3. **Optional Fields**: keep the existing `customer_side` description as-is (it is already accurate).

4. **Response example**: no change (response already returns the resolved sender/receiver).

## Verification
- Re-read the edited sections to confirm the examples and required-fields note are consistent with `customer_side` behaviour in `supabase/functions/orders/index.ts`.
