
## Add Tracking Link to Map Marker Popups

Add a clickable tracking link to the job marker popups on the ClusterMap, showing the tracking number with a link to the tracking page.

---

## Changes Required

### 1. Update `ClusterPoint` Interface

**File:** `src/services/clusteringService.ts`

Add `trackingNumber` field to the interface:

```typescript
export interface ClusterPoint {
  id: string;
  lat: number;
  lon: number;
  type: 'collection' | 'delivery';
  orderId: string;
  bikeQuantity: number;
  trackingNumber: string;  // NEW
}
```

---

### 2. Update `extractClusterPoints` Function

**File:** `src/components/scheduling/ClusterMap.tsx`

Pass the tracking number when creating points (around lines 60-68):

```typescript
if (contact.address.lat && contact.address.lon) {
  points.push({
    id: `${order.id}-${type}`,
    lat: contact.address.lat,
    lon: contact.address.lon,
    type,
    orderId: order.id,
    bikeQuantity: order.bike_quantity || 1,
    trackingNumber: order.tracking_number  // NEW
  });
}
```

---

### 3. Update Popup Content for Clustered Points

**File:** `src/components/scheduling/ClusterMap.tsx`

Update the popup in the clustered points section (lines 296-310):

```tsx
<Popup>
  <div className="p-2">
    <p className="font-semibold">
      {point.type === 'collection' ? '📦 Collection' : '🚚 Delivery'}
    </p>
    <p className="text-xs text-muted-foreground mt-1">
      Bikes: {point.bikeQuantity}
    </p>
    {/* NEW: Tracking link */}
    <a 
      href={`/tracking/${point.trackingNumber}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs text-blue-600 hover:underline block mt-1"
    >
      #{point.trackingNumber}
    </a>
    <p className="text-xs mt-1" style={{ color: cluster.color }}>
      Cluster: {getClusterName(cluster)}
    </p>
  </div>
</Popup>
```

---

### 4. Update Popup Content for Non-Clustered Points

**File:** `src/components/scheduling/ClusterMap.tsx`

Update the popup in the non-clustered points section (lines 320-330):

```tsx
<Popup>
  <div className="p-2">
    <p className="font-semibold">
      {point.type === 'collection' ? '📦 Collection' : '🚚 Delivery'}
    </p>
    <p className="text-xs text-muted-foreground mt-1">
      Bikes: {point.bikeQuantity}
    </p>
    {/* NEW: Tracking link */}
    <a 
      href={`/tracking/${point.trackingNumber}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs text-blue-600 hover:underline block mt-1"
    >
      #{point.trackingNumber}
    </a>
  </div>
</Popup>
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/services/clusteringService.ts` | Add `trackingNumber` to `ClusterPoint` interface |
| `src/components/scheduling/ClusterMap.tsx` | Pass tracking number when extracting points; add tracking link to both clustered and non-clustered popups |

---

## Expected Result

When clicking on a map marker, the popup will now show:
- Job type (Collection or Delivery) with icon
- Number of bikes
- Clickable tracking number (e.g., `#CCC754444395308AARNE7`) that opens the tracking page in a new tab
- Cluster name (for clustered view)
