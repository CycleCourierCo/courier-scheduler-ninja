## Problem
The two chart cards are still visually colliding on mobile. The earlier `gap-6` wasn't enough because both cards live inside one grid container with no visual break between them.

## Fix
Split the Overview tab into three clearly separated sections, each in its own `<section>` with a heading and its own card. The browser will render them as fully distinct blocks with generous vertical spacing and a subtle divider.

### `src/pages/AnalyticsPage.tsx`
Replace the single grid containing all three Overview cards with three stacked `<section>` blocks:

```tsx
<TabsContent value="overview" className="space-y-8">
  <section>
    <h3 className="text-base font-semibold mb-3">Order Status</h3>
    <OrderStatusChart data={orderStatusData} />
  </section>

  <Separator />

  <section>
    <h3 className="text-base font-semibold mb-3">Orders Created</h3>
    <OrdersCreatedChart orders={orders} />
  </section>

  <Separator />

  <section>
    <h3 className="text-base font-semibold mb-3">Orders Completed</h3>
    <OrdersCompletedChart orders={orders} />
  </section>
</TabsContent>
```

- Adds `<Separator />` (existing shadcn component) between sections.
- `space-y-8` ensures 32 px gap on all viewports.
- Each chart keeps its existing Card; the wrapping `<section>` plus separator removes any perception of overlap.

## Out of scope
No changes to the charts themselves, the filter component, the service layer, or other tabs.