## Change

In `src/components/scheduling/RouteBuilder.tsx`, the multi-job route card currently renders four action buttons: per-job **Col** and **Del** (regular WhatsApp), **All** (grouped WhatsApp), and **SZ** (grouped SendZen). Simplify to only the **SZ** button.

## Edit

`src/components/scheduling/RouteBuilder.tsx` (~lines 612–668, the `{job.type !== 'break' && (job.lat && job.lon) && (...)}` block):

- When `groupedJobs.length > 1`, do not render the per-job **Col/Del** send buttons.
- Remove the **All** grouped-timeslot button (`onSendGroupedTimeslots`).
- Keep the **SZ** grouped SendZen button (`onSendGroupedTimeslotsSendZen`) as the only action for multi-job groups.
- Single-job cards (`groupedJobs.length === 1`) keep the existing **Send** button — unchanged.
- The `×` remove button stays unchanged.

No changes to handlers, props, or business logic — the `onSendGroupedTimeslots` / `onSendTimeslot` props remain (still used elsewhere / for single jobs), just not rendered inside the multi-job block.