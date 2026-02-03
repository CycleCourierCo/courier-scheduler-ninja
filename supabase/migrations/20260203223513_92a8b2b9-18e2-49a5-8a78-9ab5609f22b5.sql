-- Add needs_inspection flag to orders table
ALTER TABLE public.orders
ADD COLUMN needs_inspection boolean DEFAULT false;

-- Create bicycle_inspections table
CREATE TABLE public.bicycle_inspections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  inspected_at TIMESTAMP WITH TIME ZONE,
  inspected_by_id UUID REFERENCES public.profiles(id),
  inspected_by_name TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create inspection_issues table
CREATE TABLE public.inspection_issues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inspection_id UUID NOT NULL REFERENCES public.bicycle_inspections(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  issue_description TEXT NOT NULL,
  estimated_cost NUMERIC(10, 2),
  requested_by_id UUID NOT NULL REFERENCES public.profiles(id),
  requested_by_name TEXT NOT NULL,
  customer_response TEXT,
  customer_responded_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending',
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by_id UUID REFERENCES public.profiles(id),
  resolved_by_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for bicycle_inspections
CREATE INDEX idx_bicycle_inspections_order_id ON public.bicycle_inspections(order_id);
CREATE INDEX idx_bicycle_inspections_status ON public.bicycle_inspections(status);

-- Indexes for inspection_issues
CREATE INDEX idx_inspection_issues_inspection_id ON public.inspection_issues(inspection_id);
CREATE INDEX idx_inspection_issues_order_id ON public.inspection_issues(order_id);
CREATE INDEX idx_inspection_issues_status ON public.inspection_issues(status);

-- Enable RLS on bicycle_inspections
ALTER TABLE public.bicycle_inspections ENABLE ROW LEVEL SECURITY;

-- RLS policies for bicycle_inspections
CREATE POLICY "Admins can manage all inspections"
ON public.bicycle_inspections FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view inspections for their orders"
ON public.bicycle_inspections FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.orders 
  WHERE orders.id = bicycle_inspections.order_id 
  AND orders.user_id = auth.uid()
));

-- Enable RLS on inspection_issues
ALTER TABLE public.inspection_issues ENABLE ROW LEVEL SECURITY;

-- RLS policies for inspection_issues
CREATE POLICY "Admins can manage all issues"
ON public.inspection_issues FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view issues for their orders"
ON public.inspection_issues FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.orders 
  WHERE orders.id = inspection_issues.order_id 
  AND orders.user_id = auth.uid()
));

CREATE POLICY "Users can respond to issues for their orders"
ON public.inspection_issues FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.orders 
  WHERE orders.id = inspection_issues.order_id 
  AND orders.user_id = auth.uid()
));

-- Updated_at triggers
CREATE TRIGGER update_bicycle_inspections_updated_at
BEFORE UPDATE ON public.bicycle_inspections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inspection_issues_updated_at
BEFORE UPDATE ON public.inspection_issues
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();