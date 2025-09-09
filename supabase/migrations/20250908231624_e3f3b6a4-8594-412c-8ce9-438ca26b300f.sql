-- Add DELETE policy for invoice_history table
CREATE POLICY "Users can delete their own invoice history" 
ON public.invoice_history 
FOR DELETE 
USING (auth.uid() = user_id);