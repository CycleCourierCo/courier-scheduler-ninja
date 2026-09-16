# Point all InspectaBike calls at api.inspectabike.com

## What changes

- Update the stored server setting (`INSPECTABIKE_BASE_URL`) to `https://api.inspectabike.com/functions/v1`... actually to `https://api.inspectabike.com` — the code already appends `/functions/v1/<function>` itself, so the base must not include that part or calls would land on the wrong path.
- Every edge-function call to InspectaBike (create-job, push-status, webhooks) reads this one setting, so all of them switch over at once. No code changes needed.

## Also checked

- The separate public "bike history" link shown in the portal uses a different setting (the InspectaBike website address, not the API). That one stays as-is unless you also want it changed — say the word and I'll include it.

## Verify

- Rebind/redeploy the InspectaBike functions if needed, then trigger a harmless call (or check recent function logs) to confirm requests go to the new address and still authenticate.
