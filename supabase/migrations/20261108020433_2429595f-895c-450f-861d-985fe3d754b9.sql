ALTER TABLE public.saved_routes ADD COLUMN IF NOT EXISTS route_date date;
COMMENT ON COLUMN public.saved_routes.route_date IS 'Day the route was planned/saved for in Route Builder; restored when the route is loaded.';
-- Backfill from the earliest Live Map registration where one exists
UPDATE public.saved_routes sr
SET route_date = a.d
FROM (SELECT saved_route_id, min(route_date) AS d FROM public.saved_route_assignments GROUP BY saved_route_id) a
WHERE a.saved_route_id = sr.id AND sr.route_date IS NULL;