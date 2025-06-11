
-- Create database schema for local PostgreSQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create table for detected login fields
CREATE TABLE public.detected_fields (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
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
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  target_url TEXT NOT NULL,
  fields JSONB NOT NULL,
  html_code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_detected_fields_url ON public.detected_fields(url);
CREATE INDEX idx_generated_forms_target_url ON public.generated_forms(target_url);
CREATE INDEX idx_generated_forms_created_at ON public.generated_forms(created_at DESC);
