
-- Create database schema for login detector with enhanced capabilities
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

-- Create table for login attempts (Phase 1)
CREATE TABLE public.login_attempts (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  target_url TEXT NOT NULL,
  username TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  response_status INTEGER,
  response_headers JSONB,
  response_body TEXT,
  redirect_url TEXT,
  session_cookies JSONB,
  error_message TEXT,
  attempt_duration INTEGER, -- in milliseconds
  user_agent TEXT,
  proxy_used TEXT,
  attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for session management (Phase 1)
CREATE TABLE public.sessions (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  target_url TEXT NOT NULL,
  session_data JSONB NOT NULL,
  cookies JSONB,
  csrf_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for security features detection (Phase 2)
CREATE TABLE public.security_features (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  url TEXT NOT NULL,
  feature_type TEXT NOT NULL CHECK (feature_type IN ('captcha', 'mfa', 'csrf', 'oauth', 'sso', 'rate_limit')),
  details JSONB,
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for batch jobs (Phase 5)
CREATE TABLE public.batch_jobs (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  job_name TEXT NOT NULL,
  target_urls TEXT[] NOT NULL,
  credentials JSONB NOT NULL,
  options JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  progress INTEGER DEFAULT 0,
  results JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better performance
CREATE INDEX idx_detected_fields_url ON public.detected_fields(url);
CREATE INDEX idx_generated_forms_target_url ON public.generated_forms(target_url);
CREATE INDEX idx_generated_forms_created_at ON public.generated_forms(created_at DESC);
CREATE INDEX idx_login_attempts_url ON public.login_attempts(target_url);
CREATE INDEX idx_login_attempts_attempted_at ON public.login_attempts(attempted_at DESC);
CREATE INDEX idx_sessions_url ON public.sessions(target_url);
CREATE INDEX idx_security_features_url ON public.security_features(url);
CREATE INDEX idx_batch_jobs_status ON public.batch_jobs(status);
