

## Multi-Route CSV Comparison Feature

Add the ability to upload multiple route CSV files, analyze job viability (collection status AND date availability for BOTH collections and deliveries), compare routes, and load viable jobs into a new scheduling tab.

---

## Viability Logic

### Collection Job is Viable if:
1. `pickup_date` array is empty (any date) OR contains the selected filter date

### Delivery Job is Viable if:
1. `order_collected === true` OR there's a matching pickup in the same route (sequence before delivery)
2. AND: `delivery_date` array is empty (any date) OR contains the selected filter date

---

## New Components to Create

### 1. `src/components/scheduling/MultiCSVUploadButton.tsx`

Button component accepting multiple CSV files:
- File input with `multiple` attribute
- Returns array of `{ fileName: string; content: string }` objects
- Similar styling to existing `CSVUploadButton`

### 2. `src/components/scheduling/RouteComparisonDialog.tsx`

Dialog showing comparison of all uploaded routes:
- Summary stats per route (matched, viable, issues)
- Breakdown by job type
- Issue counts (not collected, wrong date)
- "Load Route" button per row
- Sorted by viability (most viable first)

---

## New Types and Functions

### `src/utils/csvRouteParser.ts` - Add:

```typescript
export interface RouteAnalysis {
  fileName: string;
  totalMatched: number;
  viableJobs: number;
  collections: number;
  viableCollections: number;
  deliveries: number;
  viableDeliveries: number;
  issues: {
    notCollected: number;
    collectionWrongDate: number;
    deliveryWrongDate: number;
  };
  matchResults: MatchResult[];
  viableMatchResults: MatchResult[]; // Only viable jobs for loading
}

export const analyzeRouteViability = (
  matchResults: MatchResult[],
  targetDate: Date | undefined
): RouteAnalysis => {
  // For each matched job:
  // - Collections: check pickup_date array
  // - Deliveries: check order_collected OR pickup exists earlier in route, AND delivery_date array
  // Return analysis with viable counts and filtered viable results
}
```

---

## RouteBuilder Changes

### New State:
```typescript
const [showRouteComparisonDialog, setShowRouteComparisonDialog] = useState(false);
const [routeAnalyses, setRouteAnalyses] = useState<RouteAnalysis[]>([]);
```

### New Handler for Multi-CSV:
```typescript
const handleMultiCsvUpload = (files: { fileName: string; content: string }[]) => {
  const analyses = files.map(file => {
    const csvRows = parseCSV(file.content);
    const matchResults = matchCSVToOrders(csvRows, orders);
    return analyzeRouteViability(matchResults, filterDate);
  });
  
  // Sort by viability (highest first)
  analyses.sort((a, b) => b.viableJobs - a.viableJobs);
  setRouteAnalyses(analyses);
  setShowRouteComparisonDialog(true);
}
```

### New Handler for "Load Route":
```typescript
const handleLoadViableRoute = (analysis: RouteAnalysis) => {
  // Build URL with viable jobs
  const jobParams = analysis.viableMatchResults
    .map(r => `${r.matchedOrder!.id}:${r.jobType}`)
    .join(',');
  
  const dateParam = filterDate ? `&date=${format(filterDate, 'yyyy-MM-dd')}` : '';
  
  // Open in new tab
  window.open(`/scheduling?jobs=${jobParams}${dateParam}`, '_blank');
}
```

### Updated UI (buttons section):
```
[Upload Route CSV]  [Compare Multiple Routes]  [Date Filter]  [Collected Toggle]
```

---

## JobScheduling Page Changes

### Parse URL Parameters:
```typescript
import { useSearchParams } from 'react-router-dom';

const [searchParams] = useSearchParams();
const [initialJobs, setInitialJobs] = useState<{ orderId: string; type: 'pickup' | 'delivery' }[]>([]);

useEffect(() => {
  const jobsParam = searchParams.get('jobs');
  const dateParam = searchParams.get('date');
  
  if (jobsParam) {
    const jobs = jobsParam.split(',').map(j => {
      const [orderId, type] = j.split(':');
      return { orderId, type: type as 'pickup' | 'delivery' };
    });
    setInitialJobs(jobs);
  }
  
  if (dateParam) {
    setFilterDate(new Date(dateParam));
  }
}, [searchParams]);
```

### Pass to RouteBuilder:
```typescript
<RouteBuilder 
  orders={orders || []}
  initialJobs={initialJobs}  // NEW
  filterDate={filterDate}
  ...
/>
```

### RouteBuilder handles initial jobs:
```typescript
useEffect(() => {
  if (initialJobs?.length && orders.length) {
    // Auto-populate selectedJobs from initialJobs
    const jobs = initialJobs.map((ij, idx) => {
      const order = orders.find(o => o.id === ij.orderId);
      if (!order) return null;
      // Build SelectedJob object
      return { ... };
    }).filter(Boolean);
    
    setSelectedJobs(jobs);
  }
}, [initialJobs, orders]);
```

---

## Files to Create

| File | Description |
|------|-------------|
| `src/components/scheduling/MultiCSVUploadButton.tsx` | Multi-file upload button |
| `src/components/scheduling/RouteComparisonDialog.tsx` | Route comparison dialog with viability stats |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/utils/csvRouteParser.ts` | Add `RouteAnalysis` interface and `analyzeRouteViability()` function |
| `src/components/scheduling/RouteBuilder.tsx` | Add multi-CSV state, handlers, button, dialog, and initial jobs handling |
| `src/pages/JobScheduling.tsx` | Add URL parameter parsing and pass initial jobs to RouteBuilder |

---

## Route Comparison Dialog UI

```text
┌──────────────────────────────────────────────────────────────┐
│  Compare Routes                              Selected: Feb 10 │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ birmingham_north.csv                                     │ │
│  │ ─────────────────────────────────────────────────────── │ │
│  │ Matched: 12  │  Viable: 8  │  Issues: 4                  │ │
│  │                                                          │ │
│  │ Collections: 5 (4 viable)  │  Deliveries: 7 (4 viable)   │ │
│  │                                                          │ │
│  │ Issues:                                                  │ │
│  │   - 2 deliveries not collected                           │ │
│  │   - 1 collection wrong date                              │ │
│  │   - 1 delivery wrong date                                │ │
│  │                                                          │ │
│  │                                          [Load 8 Jobs]   │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ birmingham_south.csv                                     │ │
│  │ Matched: 10  │  Viable: 4  │  Issues: 6                  │ │
│  │ ...                                      [Load 4 Jobs]   │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│                                              [Close]          │
└──────────────────────────────────────────────────────────────┘
```

---

## Expected Flow

1. User clicks "Compare Multiple Routes"
2. Selects multiple CSV files
3. System parses and matches each file to orders
4. Analyzes viability using selected date filter
5. Shows comparison dialog sorted by viable job count
6. User clicks "Load X Jobs" on desired route
7. Opens new tab at `/scheduling?jobs=...&date=...`
8. New tab auto-populates RouteBuilder with viable jobs

