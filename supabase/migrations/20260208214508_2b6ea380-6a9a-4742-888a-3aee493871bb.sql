-- Create saved_routes table
CREATE TABLE saved_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  job_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  start_time TEXT DEFAULT '09:00',
  starting_bikes INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE saved_routes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage all saved routes"
  ON saved_routes FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Users can view their own saved routes"
  ON saved_routes FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create saved routes"
  ON saved_routes FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own saved routes"
  ON saved_routes FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own saved routes"
  ON saved_routes FOR DELETE
  USING (auth.uid() = created_by);

-- Trigger for updated_at
CREATE TRIGGER update_saved_routes_updated_at
  BEFORE UPDATE ON saved_routes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();