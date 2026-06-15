## Fix "Collecting Today" badge field

The badge in `RouteBuilder.tsx` currently checks `job.orderData.pickup_date` (the customer's availability array). That field is often empty even when the order is actually scheduled — the real route-planned date lives in `scheduled_pickup_date`.

### Change

In both badge locations (grouped-jobs branch ~line 386–415, and single-job branch ~line 503–512):

Replace the condition:

```ts
const isCollectingToday =
  job.type === 'delivery' &&
  job.orderData?.order_collected !== true &&
  Array.isArray(job.orderData?.pickup_date) &&
  job.orderData.pickup_date.includes(format(new Date(), 'yyyy-MM-dd'));
```

with:

```ts
const todayStr = format(new Date(), 'yyyy-MM-dd');
const scheduled = job.orderData?.scheduled_pickup_date;
const scheduledStr = scheduled ? format(new Date(scheduled), 'yyyy-MM-dd') : null;
const isCollectingToday =
  job.type === 'delivery' &&
  job.orderData?.order_collected !== true &&
  scheduledStr === todayStr;
```

Badge appearance (amber pill with `Truck` icon, text "Collecting today") and placement remain unchanged.

### Out of scope

No other filter, query, or styling changes.
