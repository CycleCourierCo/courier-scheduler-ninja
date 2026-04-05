
CREATE TABLE public.fuel_station_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  node_id text NOT NULL UNIQUE,
  brand text NOT NULL DEFAULT 'Unknown',
  name text NOT NULL DEFAULT 'Unknown Station',
  address text,
  postcode text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  diesel_price numeric,
  last_updated timestamp with time zone,
  cached_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.fuel_station_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fuel_station_cache_select_authenticated"
  ON public.fuel_station_cache
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "fuel_station_cache_all_service_role"
  ON public.fuel_station_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
