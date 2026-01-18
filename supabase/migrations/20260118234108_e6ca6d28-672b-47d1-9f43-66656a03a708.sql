-- Create the contacts table for storing sender and receiver details
CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to the customer who owns this contact
  user_id uuid NOT NULL,
  
  -- Contact type (can be used as both sender and receiver)
  contact_type text CHECK (contact_type IN ('sender', 'receiver', 'both')) DEFAULT 'both',
  
  -- Contact information
  name text NOT NULL,
  email text,
  phone text,
  
  -- Address fields
  street text,
  city text,
  state text,
  postal_code text,
  country text DEFAULT 'United Kingdom',
  
  -- Geocoding
  lat double precision,
  lon double precision,
  
  -- Notes for this contact
  notes text,
  
  -- Metadata
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can manage their own contacts
CREATE POLICY "Users can view their own contacts"
ON public.contacts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own contacts"
ON public.contacts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contacts"
ON public.contacts
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contacts"
ON public.contacts
FOR DELETE
USING (auth.uid() = user_id);

-- Admins can manage all contacts
CREATE POLICY "Admins can manage all contacts"
ON public.contacts
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role));

-- Add updated_at trigger
CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add foreign key columns to orders table for linking contacts
ALTER TABLE public.orders
ADD COLUMN sender_contact_id uuid REFERENCES public.contacts(id),
ADD COLUMN receiver_contact_id uuid REFERENCES public.contacts(id);

-- Create indexes for performance
CREATE INDEX idx_contacts_user_id ON public.contacts(user_id);
CREATE INDEX idx_contacts_contact_type ON public.contacts(contact_type);
CREATE INDEX idx_orders_sender_contact_id ON public.orders(sender_contact_id);
CREATE INDEX idx_orders_receiver_contact_id ON public.orders(receiver_contact_id);