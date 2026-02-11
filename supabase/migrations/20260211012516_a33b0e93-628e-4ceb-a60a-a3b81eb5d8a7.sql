
-- Create holidays table
CREATE TABLE public.holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  name TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unique constraint on date to prevent duplicate holiday entries
ALTER TABLE public.holidays ADD CONSTRAINT holidays_date_unique UNIQUE (date);

-- Enable RLS
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- SELECT: allow all (public availability pages need to read holidays)
CREATE POLICY "holidays_select_policy"
ON public.holidays
FOR SELECT
USING (true);

-- INSERT: admin only
CREATE POLICY "holidays_insert_policy"
ON public.holidays
FOR INSERT
WITH CHECK (is_admin());

-- DELETE: admin only
CREATE POLICY "holidays_delete_policy"
ON public.holidays
FOR DELETE
USING (is_admin());
