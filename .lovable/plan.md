
# CSV Upload for Bulk Timeslot Sending

## Overview

Add CSV upload capability to the Job Scheduling page that will:
1. Parse an uploaded CSV file containing a pre-optimized route
2. Match CSV rows to existing orders based on contact name and/or address
3. Pre-populate the route builder with matched jobs in the correct sequence
4. Open the timeslot dialog with all jobs ready for sending

---

## CSV Structure Analysis

Your uploaded CSV has the following format:

| Column | Example | Purpose |
|--------|---------|---------|
| sequence | 0, 1, 2... | Stop order in the route |
| name | "Sarah Cowper" | Contact name to match |
| address | "6 Clarence avenue, Great Boughton..." | Address for the stop |

**Note:** Row 0 and the last row are the depot (Lawden Road) - these should be excluded from job matching.

---

## Matching Strategy

Since the CSV doesn't contain order IDs or tracking numbers, jobs will be matched using:

1. **Fuzzy name matching** - Compare CSV name against sender/receiver names in pending orders
2. **Address similarity** - Use address components (postcode, city) as secondary match criteria
3. **Ambiguous matches** - Flag jobs where multiple orders match the same CSV row for manual selection

---

## Implementation Approach

### UI Changes

Add an "Upload Route CSV" button to the RouteBuilder component with:
- File input accepting `.csv` files
- Progress indicator during parsing/matching
- Summary showing matched vs unmatched rows
- Option to proceed with matched jobs or cancel

### New Components

| Component | Purpose |
|-----------|---------|
| `CSVUploadButton` | File input with styling |
| `CSVMatchReviewDialog` | Shows matching results before loading route |

### Matching Logic

```text
For each CSV row (excluding depot rows):
  1. Search pending orders (not yet scheduled)
  2. Find where sender.name OR receiver.name matches CSV name
  3. If multiple matches found, check address similarity
  4. Store match with confidence score (exact, fuzzy, address-only)
```

---

## Workflow After Implementation

```text
┌─────────────────────────────────────────────────────────┐
│  1. User clicks "Upload Route CSV"                      │
│                        ↓                                │
│  2. Select CSV file from computer                       │
│                        ↓                                │
│  3. System parses CSV and matches to pending orders     │
│                        ↓                                │
│  4. Review dialog shows:                                │
│     ✓ 26 of 28 rows matched                             │
│     ⚠ 2 rows unmatched (depot start/end)                │
│                        ↓                                │
│  5. Click "Load Route" to populate jobs                 │
│                        ↓                                │
│  6. Click "Get Timeslots" to calculate times            │
│                        ↓                                │
│  7. Dialog opens with all 26 jobs ready                 │
│                        ↓                                │
│  8. Click "Send All Timeslots" or edit individually     │
└─────────────────────────────────────────────────────────┘
```

---

## Files to Create/Modify

| File | Changes |
|------|---------|
| `src/components/scheduling/CSVUploadButton.tsx` | New component for file upload |
| `src/components/scheduling/CSVMatchReviewDialog.tsx` | New dialog showing match results |
| `src/components/scheduling/RouteBuilder.tsx` | Add upload button and CSV processing logic |
| `src/utils/csvRouteParser.ts` | CSV parsing and order matching utilities |

---

## CSV Parsing Logic

```typescript
interface CSVRow {
  sequence: number;
  name: string;
  address: string;
}

interface MatchResult {
  csvRow: CSVRow;
  matchedOrder: OrderData | null;
  matchType: 'exact' | 'fuzzy' | 'address' | 'none';
  jobType: 'pickup' | 'delivery';
  confidence: number;
}
```

**Matching algorithm:**
1. Skip rows where address contains "Lawden Road" or "b100ad" (depot)
2. Normalize names (lowercase, trim whitespace)
3. Find orders where `sender.name` or `receiver.name` contains the CSV name
4. For duplicate matches, use postcode from address to disambiguate
5. Determine if it's a pickup (matches sender) or delivery (matches receiver)

---

## Edge Cases

| Case | Handling |
|------|----------|
| Same customer has multiple orders | Use address matching to select correct one |
| Name spelling differs | Use Levenshtein distance for fuzzy matching |
| No match found | Flag for manual selection from order list |
| Order already scheduled | Exclude from matching (show warning) |
| Multiple bikes at same address | Group correctly like current system does |

---

## Summary

| Task | Description |
|------|-------------|
| Create CSV parser | Parse route CSV and extract job data |
| Implement name matching | Match CSV names to order sender/receiver names |
| Add upload UI | Button to trigger file selection |
| Add review dialog | Show matches before loading |
| Pre-populate route | Load matched jobs into selectedJobs state |
| Calculate timeslots | Automatically open timeslot dialog |

This approach keeps the existing timeslot dialog and sending logic intact, simply automating the job selection process from a CSV file instead of manual clicking.
