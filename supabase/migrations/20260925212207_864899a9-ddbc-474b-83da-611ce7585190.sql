ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS depot_id uuid,
  ADD COLUMN IF NOT EXISTS annual_leave_days numeric NOT NULL DEFAULT 28,
  ADD COLUMN IF NOT EXISTS leave_year_start text NOT NULL DEFAULT '01-01';

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Weekly availability
CREATE TABLE public.driver_weekly_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL,
  weekday smallint NOT NULL,
  is_available boolean NOT NULL DEFAULT true,
  start_time time,
  end_time time,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (driver_id, weekday)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_weekly_availability TO authenticated;
GRANT ALL ON public.driver_weekly_availability TO service_role;
ALTER TABLE public.driver_weekly_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dwa read" ON public.driver_weekly_availability FOR SELECT TO authenticated
  USING (driver_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin') OR public.has_role((SELECT auth.uid()), 'route_planner'));
CREATE POLICY "dwa admin write" ON public.driver_weekly_availability FOR ALL TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin')) WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));
CREATE TRIGGER dwa_touch BEFORE UPDATE ON public.driver_weekly_availability FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Overrides
CREATE TABLE public.driver_availability_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL,
  date date NOT NULL,
  is_available boolean NOT NULL DEFAULT true,
  start_time time,
  end_time time,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (driver_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_availability_overrides TO authenticated;
GRANT ALL ON public.driver_availability_overrides TO service_role;
ALTER TABLE public.driver_availability_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dao read" ON public.driver_availability_overrides FOR SELECT TO authenticated
  USING (driver_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin') OR public.has_role((SELECT auth.uid()), 'route_planner'));
CREATE POLICY "dao admin write" ON public.driver_availability_overrides FOR ALL TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin')) WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));
CREATE TRIGGER dao_touch BEFORE UPDATE ON public.driver_availability_overrides FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Absence requests
CREATE TABLE public.driver_absence_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'holiday',
  start_date date NOT NULL,
  end_date date NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'pending',
  cancel_requested boolean NOT NULL DEFAULT false,
  decided_by uuid,
  decided_at timestamptz,
  decision_reason text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dar_driver_dates ON public.driver_absence_requests (driver_id, start_date, end_date);
CREATE INDEX dar_status ON public.driver_absence_requests (status);
GRANT SELECT, INSERT, UPDATE ON public.driver_absence_requests TO authenticated;
GRANT ALL ON public.driver_absence_requests TO service_role;
ALTER TABLE public.driver_absence_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dar read own or admin" ON public.driver_absence_requests FOR SELECT TO authenticated
  USING (driver_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'));
CREATE POLICY "dar insert own or admin" ON public.driver_absence_requests FOR INSERT TO authenticated
  WITH CHECK (driver_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'));
CREATE POLICY "dar update own or admin" ON public.driver_absence_requests FOR UPDATE TO authenticated
  USING (driver_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (driver_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'));

CREATE OR REPLACE FUNCTION public.guard_driver_absence_request() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_admin boolean := v_uid IS NULL OR public.has_role(v_uid, 'admin');
BEGIN
  IF NEW.type NOT IN ('holiday','sick','unpaid','other') THEN RAISE EXCEPTION 'Invalid absence type'; END IF;
  IF NEW.status NOT IN ('pending','approved','declined','cancelled') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  IF NEW.end_date < NEW.start_date THEN RAISE EXCEPTION 'End date must be on or after start date'; END IF;

  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.driver_id AND COALESCE(is_active, true)) THEN
      RAISE EXCEPTION 'Driver account is not active';
    END IF;
    NEW.created_by := COALESCE(v_uid, NEW.created_by);
    NEW.cancel_requested := false;
    IF NOT v_admin THEN
      IF NEW.type = 'sick' THEN RAISE EXCEPTION 'Sickness is logged by an admin'; END IF;
      NEW.status := 'pending';
      NEW.decided_by := NULL; NEW.decided_at := NULL; NEW.decision_reason := NULL;
    ELSIF NEW.status IN ('approved','declined') THEN
      NEW.decided_by := v_uid; NEW.decided_at := now();
    ELSE
      NEW.decided_by := NULL; NEW.decided_at := NULL;
    END IF;
  ELSE
    NEW.driver_id := OLD.driver_id;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    IF NOT v_admin THEN
      IF NEW.start_date <> OLD.start_date OR NEW.end_date <> OLD.end_date OR NEW.type <> OLD.type
         OR COALESCE(NEW.note,'') <> COALESCE(OLD.note,'') THEN
        RAISE EXCEPTION 'Submitted requests cannot be edited; cancel and resubmit instead';
      END IF;
      NEW.decided_by := OLD.decided_by; NEW.decided_at := OLD.decided_at; NEW.decision_reason := OLD.decision_reason;
      IF NEW.status <> OLD.status THEN
        IF NOT (OLD.status = 'pending' AND NEW.status = 'cancelled') THEN
          RAISE EXCEPTION 'You can only cancel a pending request';
        END IF;
      END IF;
      IF NEW.cancel_requested AND NOT OLD.cancel_requested AND OLD.status <> 'approved' THEN
        RAISE EXCEPTION 'Only approved requests can have a cancellation requested';
      END IF;
      IF OLD.cancel_requested AND NOT NEW.cancel_requested THEN NEW.cancel_requested := true; END IF;
    ELSE
      IF NEW.status <> OLD.status THEN
        NEW.decided_by := v_uid; NEW.decided_at := now();
        IF NEW.status = 'cancelled' THEN NEW.cancel_requested := false; END IF;
      ELSE
        NEW.decided_by := OLD.decided_by; NEW.decided_at := OLD.decided_at;
      END IF;
    END IF;
  END IF;

  IF NEW.status IN ('pending','approved') AND EXISTS (
    SELECT 1 FROM public.driver_absence_requests r
    WHERE r.driver_id = NEW.driver_id AND r.id <> NEW.id
      AND r.status IN ('pending','approved')
      AND r.start_date <= NEW.end_date AND r.end_date >= NEW.start_date
  ) THEN
    RAISE EXCEPTION 'These dates overlap another pending or approved request';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.guard_driver_absence_request() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER dar_guard BEFORE INSERT OR UPDATE ON public.driver_absence_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_driver_absence_request();

-- Rota view without notes (admins + route planners)
CREATE OR REPLACE FUNCTION public.get_rota_absences(p_from date, p_to date)
RETURNS TABLE(id uuid, driver_id uuid, type text, start_date date, end_date date, status text, cancel_requested boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.driver_id, r.type, r.start_date, r.end_date, r.status, r.cancel_requested
  FROM public.driver_absence_requests r
  WHERE (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'route_planner'))
    AND r.status IN ('pending','approved')
    AND r.start_date <= p_to AND r.end_date >= p_from
$$;
REVOKE EXECUTE ON FUNCTION public.get_rota_absences(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_rota_absences(date, date) TO authenticated;

-- Cancel pending requests when a driver is deactivated
CREATE OR REPLACE FUNCTION public.cancel_absences_on_deactivate() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(OLD.is_active, true) AND NEW.is_active = false THEN
    UPDATE public.driver_absence_requests SET status = 'cancelled'
    WHERE driver_id = NEW.id AND status = 'pending';
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.cancel_absences_on_deactivate() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER profiles_cancel_absences AFTER UPDATE OF is_active ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.cancel_absences_on_deactivate();

-- Rota settings
CREATE TABLE public.rota_settings (
  id smallint PRIMARY KEY DEFAULT 1,
  min_drivers_per_day integer NOT NULL DEFAULT 3,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rota_settings_single CHECK (id = 1)
);
GRANT SELECT, INSERT, UPDATE ON public.rota_settings TO authenticated;
GRANT ALL ON public.rota_settings TO service_role;
ALTER TABLE public.rota_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rota settings read" ON public.rota_settings FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin') OR public.has_role((SELECT auth.uid()), 'route_planner') OR public.has_role((SELECT auth.uid()), 'driver'));
CREATE POLICY "rota settings admin write" ON public.rota_settings FOR ALL TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin')) WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));
CREATE TRIGGER rota_settings_touch BEFORE UPDATE ON public.rota_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
INSERT INTO public.rota_settings (id) VALUES (1) ON CONFLICT DO NOTHING;