-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create order comments table
CREATE TABLE public.order_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL,
  admin_name TEXT NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_comments ENABLE ROW LEVEL SECURITY;

-- Create policies for order comments
CREATE POLICY "Admins can view all order comments" 
ON public.order_comments 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE id = auth.uid() AND role = 'admin'::user_role
));

CREATE POLICY "Admins can insert order comments" 
ON public.order_comments 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE id = auth.uid() AND role = 'admin'::user_role
));

CREATE POLICY "Admins can update their own comments" 
ON public.order_comments 
FOR UPDATE 
USING (admin_id = auth.uid() AND EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE id = auth.uid() AND role = 'admin'::user_role
));

CREATE POLICY "Admins can delete their own comments" 
ON public.order_comments 
FOR DELETE 
USING (admin_id = auth.uid() AND EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE id = auth.uid() AND role = 'admin'::user_role
));

-- Create updated_at trigger
CREATE TRIGGER update_order_comments_updated_at
BEFORE UPDATE ON public.order_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_order_comments_order_id ON public.order_comments(order_id);
CREATE INDEX idx_order_comments_created_at ON public.order_comments(created_at DESC);