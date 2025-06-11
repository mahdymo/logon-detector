
-- Create table for detected login fields
CREATE TABLE public.detected_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('username', 'email', 'password', 'submit', 'other')),
  selector TEXT NOT NULL,
  placeholder TEXT,
  label TEXT,
  required BOOLEAN NOT NULL DEFAULT false,
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for generated forms
CREATE TABLE public.generated_forms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  target_url TEXT NOT NULL,
  fields JSONB NOT NULL,
  html_code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.detected_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_forms ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since this is a utility tool)
CREATE POLICY "Allow public read access to detected_fields" 
  ON public.detected_fields 
  FOR SELECT 
  USING (true);

CREATE POLICY "Allow public insert access to detected_fields" 
  ON public.detected_fields 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Allow public read access to generated_forms" 
  ON public.generated_forms 
  FOR SELECT 
  USING (true);

CREATE POLICY "Allow public insert access to generated_forms" 
  ON public.generated_forms 
  FOR INSERT 
  WITH CHECK (true);
