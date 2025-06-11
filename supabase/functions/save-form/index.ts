
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { target_url, fields, html_code } = await req.json();
    
    if (!target_url || !fields || !html_code) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: target_url, fields, html_code' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`Saving form for URL: ${target_url}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data, error } = await supabase
      .from('generated_forms')
      .insert({
        target_url,
        fields,
        html_code
      })
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    console.log(`Form saved successfully with ID: ${data.id}`);

    return new Response(
      JSON.stringify({ id: data.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error saving form:', error);
    
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to save form' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
