CREATE TABLE public.fleet_snapped_paths (
  registration text NOT NULL,
  path_date date NOT NULL,
  last_point_at timestamptz NOT NULL,
  points jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (registration, path_date)
);
GRANT ALL ON public.fleet_snapped_paths TO service_role;
ALTER TABLE public.fleet_snapped_paths ENABLE ROW LEVEL SECURITY;