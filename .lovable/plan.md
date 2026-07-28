## Problem

The review dialog groups CSV rows into stops with the key `normalized(name) + "|" + normalized(address)`. That requires the full address string to match character-for-character (after stripping punctuation).

Confirmed in the screenshots: the same customer appears twice because the CSV address strings differ.

```text
#3  Louth Cycle Centre — Unit 10-11 Station Estate, Newbridge Hill, Louth, LN11 0JT
#4  Louth Cycle Centre — Unit 10-11 Station Estate, Newbridge Hill, Louth, Lincolnshire LN11 0JT
```

Identical location, but one row includes "Lincolnshire" — so the normalized strings differ and two separate stop cards are produced.

## Fix

In `src/components/scheduling/CSVMatchReviewDialog.tsx`, change the stop grouping key to be tolerant of address-format variation:

1. Extract the UK postcode from the address with a regex (e.g. `[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}`), normalized to uppercase with no spaces.
2. Extract the leading premise identifier (the first number/unit token of the address, e.g. `1011` from "Unit 10-11") so two different units sharing a postcode stay separate.
3. Build the key as `normalized(name) | postcode | premise`.
4. Fall back to the existing `normalized(name) | normalized(address)` key when no postcode can be found, so behaviour is unchanged for malformed addresses.

Everything downstream (sequence badges, merged-row count, candidate dedupe by `orderId|jobType`, default selection) already works off the grouped stop, so no other changes are needed — the two Louth rows will collapse into one card showing `#3 #4` and "2 CSV rows merged into this stop".

## Notes

- Different customers at the same postcode (e.g. PAUL MARTIN and CBT Coalville Ltd on Sapperton) will still remain separate cards, since the customer name stays part of the key. That is intentional and matches the earlier rule that different customers must never be bundled.
- No backend, parser, or route-builder changes; this is presentation-layer grouping only.
