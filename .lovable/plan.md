## Issue

The `/dispatch/routes` page can't load Google Maps because the Google Maps Platform connector isn't linked to this project. The page reads `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`, which is only populated once the connector is connected, and the `optimise-route` edge function needs `GOOGLE_MAPS_API_KEY` + `LOVABLE_API_KEY` to call the Routes API gateway.

`list_connections` shows no connections in this workspace, so nothing is linked yet.

## Plan

1. **Connect the Google Maps Platform connector** to this project using the built-in connection picker (`standard_connectors--connect` with `connector_id: google_maps`). This will:
   - Populate `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` + `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID` for the frontend (used by the map loader).
   - Populate `GOOGLE_MAPS_API_KEY` for the edge function gateway calls.

2. **Redeploy `optimise-route`** so it picks up the newly injected `GOOGLE_MAPS_API_KEY`.

3. **Verify** by reloading `/dispatch/routes` — map should render, lasso should work, and Optimise should return distances/durations from the Google Routes API.

## Notes

- Lovable provides a managed Google Maps key out of the box (works on `*.lovable.app` / `*.lovableproject.com` preview domains). No Google Cloud setup is needed for development.
- For the published custom domain `booking.cyclecourierco.com`, the managed key won't work because Google restricts it to Lovable preview domains — at publish time we'd need to swap to a custom Google Cloud key with `booking.cyclecourierco.com` in its HTTP referrer allowlist. We can handle that as a separate step when you're ready to ship.

No code changes needed — only the connector link + redeploy.