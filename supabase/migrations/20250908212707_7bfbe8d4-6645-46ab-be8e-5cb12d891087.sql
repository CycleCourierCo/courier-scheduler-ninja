-- Create table for invoice history
CREATE TABLE public.invoice_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  order_count INTEGER NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  quickbooks_invoice_id TEXT,
  quickbooks_invoice_number TEXT,
  quickbooks_invoice_url TEXT,
  status TEXT NOT NULL DEFAULT 'created',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.invoice_history ENABLE ROW LEVEL SECURITY;

-- Create policies for invoice_history
CREATE POLICY "Users can view their own invoice history" 
ON public.invoice_history 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own invoice history" 
ON public.invoice_history 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own invoice history" 
ON public.invoice_history 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_invoice_history_updated_at
BEFORE UPDATE ON public.invoice_history
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_invoice_history_user_id ON public.invoice_history(user_id);
CREATE INDEX idx_invoice_history_created_at ON public.invoice_history(created_at DESC);