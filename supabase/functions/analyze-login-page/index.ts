
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DetectedField {
  type: 'username' | 'email' | 'password' | 'submit' | 'other';
  selector: string;
  placeholder?: string;
  label?: string;
  required: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`Analyzing login page: ${url}`);

    // Fetch the webpage
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const fields = analyzeHtmlForLoginFields(html, url);

    // Store results in database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Save detected fields
    for (const field of fields) {
      await supabase.from('detected_fields').insert({
        url,
        field_type: field.type,
        selector: field.selector,
        placeholder: field.placeholder,
        label: field.label,
        required: field.required
      });
    }

    const metadata = {
      title: extractTitle(html),
      forms_found: (html.match(/<form/gi) || []).length,
      analyzed_at: new Date().toISOString()
    };

    console.log(`Analysis completed for ${url}:`, { fieldsFound: fields.length, metadata });

    return new Response(
      JSON.stringify({
        success: true,
        fields,
        metadata
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error analyzing login page:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to analyze login page'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

function analyzeHtmlForLoginFields(html: string, baseUrl: string): DetectedField[] {
  const fields: DetectedField[] = [];
  
  // Simple regex-based analysis (in production, you'd want a proper HTML parser)
  const inputRegex = /<input[^>]*>/gi;
  const buttonRegex = /<button[^>]*>.*?<\/button>/gi;
  
  let match;
  
  // Analyze input fields
  while ((match = inputRegex.exec(html)) !== null) {
    const inputTag = match[0];
    const field = parseInputField(inputTag);
    if (field) {
      fields.push(field);
    }
  }
  
  // Analyze buttons
  while ((match = buttonRegex.exec(html)) !== null) {
    const buttonTag = match[0];
    const field = parseButtonField(buttonTag);
    if (field) {
      fields.push(field);
    }
  }
  
  return fields;
}

function parseInputField(inputTag: string): DetectedField | null {
  const typeMatch = inputTag.match(/type=['"]([^'"]*)['"]/i);
  const nameMatch = inputTag.match(/name=['"]([^'"]*)['"]/i);
  const idMatch = inputTag.match(/id=['"]([^'"]*)['"]/i);
  const placeholderMatch = inputTag.match(/placeholder=['"]([^'"]*)['"]/i);
  const requiredMatch = inputTag.match(/required/i);
  
  const type = typeMatch?.[1]?.toLowerCase() || 'text';
  const name = nameMatch?.[1]?.toLowerCase() || '';
  const id = idMatch?.[1]?.toLowerCase() || '';
  const placeholder = placeholderMatch?.[1] || '';
  
  let fieldType: DetectedField['type'] = 'other';
  
  if (type === 'password') {
    fieldType = 'password';
  } else if (type === 'email' || name.includes('email') || id.includes('email') || placeholder.toLowerCase().includes('email')) {
    fieldType = 'email';
  } else if (name.includes('user') || id.includes('user') || placeholder.toLowerCase().includes('user') || 
             name.includes('login') || id.includes('login') || placeholder.toLowerCase().includes('login')) {
    fieldType = 'username';
  } else if (type === 'submit') {
    fieldType = 'submit';
  }
  
  if (fieldType === 'other' && (type === 'text' || type === 'email')) {
    return null; // Skip generic text fields that don't seem login-related
  }
  
  const selector = id ? `#${id}` : name ? `input[name="${name}"]` : `input[type="${type}"]`;
  
  return {
    type: fieldType,
    selector,
    placeholder: placeholder || undefined,
    label: placeholder || (fieldType.charAt(0).toUpperCase() + fieldType.slice(1)),
    required: !!requiredMatch
  };
}

function parseButtonField(buttonTag: string): DetectedField | null {
  const typeMatch = buttonTag.match(/type=['"]([^'"]*)['"]/i);
  const textMatch = buttonTag.match(/>([^<]*)</);
  
  const type = typeMatch?.[1]?.toLowerCase() || 'button';
  const text = textMatch?.[1]?.trim().toLowerCase() || '';
  
  if (type === 'submit' || text.includes('login') || text.includes('sign in') || text.includes('submit')) {
    return {
      type: 'submit',
      selector: 'button[type="submit"]',
      label: text || 'Submit',
      required: false
    };
  }
  
  return null;
}

function extractTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return titleMatch?.[1]?.trim() || 'Unknown';
}
