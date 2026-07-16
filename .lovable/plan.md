## Add "Get Timeslots" button to top of Route Builder

Mirror the existing bottom button (line 3381 in `src/components/scheduling/RouteBuilder.tsx`) at the top of the Route Builder card, so users don't have to scroll after selecting jobs.

### Change

In `src/components/scheduling/RouteBuilder.tsx`, inside `CardContent` just below the filter section (or directly under the `CardHeader`), add:

```tsx
{selectedJobs.length > 0 && (
  <div className="flex gap-4 mb-4">
    <Button onClick={() => calculateTimeslots()} className="flex items-center gap-2">
      <Clock className="h-4 w-4" />
      Get Timeslots ({selectedJobs.length} jobs)
    </Button>
  </div>
)}
```

- Identical handler (`calculateTimeslots()`), identical label, identical icon — same behavior as the bottom button.
- Only renders when at least one job is selected, matching the bottom button.
- Bottom button stays in place unchanged.

No other files touched.