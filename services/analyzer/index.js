
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(cors());
app.use(express.json());

// Analyze login page endpoint
app.post('/analyze', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: 'URL is required' 
      });
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
    const fields = analyzeHtmlForLoginFields(html);

    // Store results in database
    for (const field of fields) {
      await pool.query(
        'INSERT INTO detected_fields (url, field_type, selector, placeholder, label, required) VALUES ($1, $2, $3, $4, $5, $6)',
        [url, field.type, field.selector, field.placeholder, field.label, field.required]
      );
    }

    const metadata = {
      title: extractTitle(html),
      forms_found: (html.match(/<form/gi) || []).length,
      analyzed_at: new Date().toISOString()
    };

    console.log(`Analysis completed for ${url}:`, { fieldsFound: fields.length, metadata });

    res.json({
      success: true,
      fields,
      metadata
    });

  } catch (error) {
    console.error('Error analyzing login page:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze login page'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'analyzer' });
});

function analyzeHtmlForLoginFields(html) {
  const fields = [];
  
  // Simple regex-based analysis
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

function parseInputField(inputTag) {
  const typeMatch = inputTag.match(/type=['"]([^'"]*)['"]/i);
  const nameMatch = inputTag.match(/name=['"]([^'"]*)['"]/i);
  const idMatch = inputTag.match(/id=['"]([^'"]*)['"]/i);
  const placeholderMatch = inputTag.match(/placeholder=['"]([^'"]*)['"]/i);
  const requiredMatch = inputTag.match(/required/i);
  
  const type = typeMatch?.[1]?.toLowerCase() || 'text';
  const name = nameMatch?.[1]?.toLowerCase() || '';
  const id = idMatch?.[1]?.toLowerCase() || '';
  const placeholder = placeholderMatch?.[1] || '';
  
  let fieldType = 'other';
  
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
    return null;
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

function parseButtonField(buttonTag) {
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

function extractTitle(html) {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return titleMatch?.[1]?.trim() || 'Unknown';
}

app.listen(port, () => {
  console.log(`Analyzer service running on port ${port}`);
});
