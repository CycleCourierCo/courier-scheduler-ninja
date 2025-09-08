-- Add accounts_email field to profiles table for QuickBooks invoicing
ALTER TABLE public.profiles ADD COLUMN accounts_email text;