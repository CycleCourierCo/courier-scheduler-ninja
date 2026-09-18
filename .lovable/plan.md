# Self-hosted routing with OSRM + VROOM

## What these are and why they fit

- **OSRM** — free, open-source routing engine (OpenStreetMap data). Gives distances, durations, and route polylines. Could replace the Google Routes API calls in the `route-path` edge function.
- **VROOM** — free, open-source route *optimizer* built to sit on top of OSRM. You give it a vehicle (the van) plus a list of collection/delivery jobs with time windows and capacities, and it returns the best stop order. This is exactly what Get Timeslots / Route Builder currently approximates manually.

The catch: both are servers, and the Lovable/Supabase sandbox cannot run persistent servers. They need their own always-on machine. The free public demo servers (project-osrm.org, vroom demo) are rate-limited and explicitly not for production use.

## Hosting options

```text
Browser / Edge Functions
        |
        v
  Your VPS (Docker)
  ├── OSRM container   (GB map data, ~3-4 GB RAM)
  └── VROOM container  (talks to OSRM internally)
```

**Recommended: one small VPS with Docker Compose**

- Provider: Hetzner (~£8–12/mo), DigitalOcean, or OVH — any 4 GB RAM, 2 vCPU box is plenty for Great Britain-only data.
- Data: download the Great Britain extract from Geofabrik, pre-process once with `osrm-extract` (car profile).
- Docker Compose with two services: `osrm/osrm-backend` (port 5000) and `ghcr.io/vroom-project/vroom-docker` (port 3000, pointed at OSRM).
- Nginx or Caddy in front for HTTPS (e.g. `routing.cyclecourierco.com`), plus a shared-secret header so only your edge functions can call it.
- Weekly cron to refresh the map extract (OSM updates).

**Alternative: managed/hosted routing** (no servers to run) — e.g. Valhalla via commercial hosts, or sticking with Google Routes but using Google's Route Optimization API. More cost, less control. Only worth it if nobody wants to maintain a server.

## Integration (once hosted)

1. Add `OSRM_BASE_URL` / `VROOM_BASE_URL` + shared secret as Supabase edge function secrets.
2. New edge function `route-optimize`: accepts the selected jobs for a route day, builds VROOM shipments (collection → delivery pairs), van capacity from bike spaces, and time windows from availability; returns optimized stop order.
3. Point `route-path` (polyline/distance) at OSRM as the primary engine, keeping Google Routes as fallback — OSRM has no live traffic, so Google stays useful for ETA display.
4. Route Builder "Optimize order" button uses `route-optimize` output to sort stops.

## Decision needed

- Do you want to run your own VPS (recommended, ~£10/mo, I supply the full Docker setup + update scripts), or prefer a managed alternative?
- Should the optimizer fully replace the current Google-based flow, or run alongside it first so you can compare results?

## Technical details

- OSRM GB extract: Geofabrik `great-britain-latest.osm.pbf` (~1.5 GB), MLD pipeline, car profile.
- VROOM express mode listens on :3000; set `VROOM_ROUTER=osrm` and OSRM host via env.
- Secrets stored via Supabase secrets; edge functions call the VPS over HTTPS only.
- No database or frontend breaking changes; Google Maps stays for map display/geocoding regardless.
