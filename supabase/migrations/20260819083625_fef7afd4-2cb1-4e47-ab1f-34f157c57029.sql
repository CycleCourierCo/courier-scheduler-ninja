-- Fuel invoices
CREATE TABLE public.fuel_invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier text NOT NULL DEFAULT 'WEX Europe Services',
  account_number text,
  invoice_number text NOT NULL UNIQUE,
  invoice_date date,
  due_date date,
  currency text NOT NULL DEFAULT 'GBP',
  net_total numeric NOT NULL DEFAULT 0,
  vat_total numeric NOT NULL DEFAULT 0,
  gross_total numeric NOT NULL DEFAULT 0,
  file_path text,
  parsed_row_count integer NOT NULL DEFAULT 0,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fuel_invoices TO authenticated;
GRANT ALL ON public.fuel_invoices TO service_role;
ALTER TABLE public.fuel_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage fuel invoices" ON public.fuel_invoices FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.fuel_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id uuid NOT NULL REFERENCES public.fuel_invoices(id) ON DELETE CASCADE,
  trx_reference text,
  trx_date date NOT NULL,
  trx_time text,
  site_name text,
  raw_vehicle_id text,
  normalised_reg text,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  card_label text,
  odometer integer,
  product text,
  quantity_litres numeric NOT NULL DEFAULT 0,
  unit_price numeric,
  net_amount numeric NOT NULL DEFAULT 0,
  vat_rate numeric,
  vat_amount numeric NOT NULL DEFAULT 0,
  gross_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fuel_transactions_invoice_idx ON public.fuel_transactions(invoice_id);
CREATE INDEX fuel_transactions_vehicle_date_idx ON public.fuel_transactions(vehicle_id, trx_date);
CREATE INDEX fuel_transactions_reg_idx ON public.fuel_transactions(normalised_reg);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fuel_transactions TO authenticated;
GRANT ALL ON public.fuel_transactions TO service_role;
ALTER TABLE public.fuel_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage fuel transactions" ON public.fuel_transactions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.fuel_vehicle_aliases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  normalised_alias text NOT NULL UNIQUE,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE,
  ignored boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fuel_vehicle_aliases TO authenticated;
GRANT ALL ON public.fuel_vehicle_aliases TO service_role;
ALTER TABLE public.fuel_vehicle_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage fuel vehicle aliases" ON public.fuel_vehicle_aliases FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.fuel_anomaly_dismissals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scope_key text NOT NULL UNIQUE,
  note text,
  dismissed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fuel_anomaly_dismissals TO authenticated;
GRANT ALL ON public.fuel_anomaly_dismissals TO service_role;
ALTER TABLE public.fuel_anomaly_dismissals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage fuel anomaly dismissals" ON public.fuel_anomaly_dismissals FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.fuel_analysis_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expected_mpg_min numeric NOT NULL DEFAULT 15,
  expected_mpg_max numeric NOT NULL DEFAULT 45,
  max_litres_per_fill numeric NOT NULL DEFAULT 95,
  duplicate_fill_window_hours numeric NOT NULL DEFAULT 12,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fuel_analysis_settings TO authenticated;
GRANT ALL ON public.fuel_analysis_settings TO service_role;
ALTER TABLE public.fuel_analysis_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage fuel analysis settings" ON public.fuel_analysis_settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));