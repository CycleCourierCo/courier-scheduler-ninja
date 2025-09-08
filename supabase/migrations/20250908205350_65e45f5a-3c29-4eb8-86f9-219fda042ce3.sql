-- Create table for OAuth state management
CREATE TABLE public.oauth_states (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  state TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for QuickBooks tokens
CREATE TABLE public.quickbooks_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT NOT NULL DEFAULT 'Bearer',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  company_id TEXT,
  scope TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quickbooks_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies for oauth_states
CREATE POLICY "Users can manage their own OAuth states" 
ON public.oauth_states 
FOR ALL 
USING (auth.uid() = user_id);

-- Create policies for quickbooks_tokens
CREATE POLICY "Users can view their own QuickBooks tokens" 
ON public.quickbooks_tokens 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own QuickBooks tokens" 
ON public.quickbooks_tokens 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own QuickBooks tokens" 
ON public.quickbooks_tokens 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates on quickbooks_tokens
CREATE TRIGGER update_quickbooks_tokens_updated_at
BEFORE UPDATE ON public.quickbooks_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for cleanup of expired states
CREATE INDEX idx_oauth_states_expires_at ON public.oauth_states(expires_at);
CREATE INDEX idx_quickbooks_tokens_user_id ON public.quickbooks_tokens(user_id);