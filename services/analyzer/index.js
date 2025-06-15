const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const fetch = require('node-fetch');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(cors({
  origin: '*',
  credentials: false
}));

// Increase request size limits and add timeout handling
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Request timeout and logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Request started`);
  
  // Set timeout based on endpoint
  const timeout = req.path === '/analyze' ? 120000 : 30000; // 2 min for analyze, 30s for others
  req.setTimeout(timeout);
  res.setTimeout(timeout);
  
  req.on('timeout', () => {
    const duration = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] Request timeout after ${duration}ms on ${req.path}`);
    if (!res.headersSent) {
      res.status(408).json({ 
        success: false, 
        error: 'Request timeout - analysis taking too long. Try with browser mode disabled.' 
      });
    }
  });
  
  req.on('close', () => {
    if (!res.finished) {
      const duration = Date.now() - startTime;
      console.error(`[${new Date().toISOString()}] Request closed by client after ${duration}ms on ${req.path}`);
    }
  });
  
  // Log response completion
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Completed in ${duration}ms`);
    originalSend.call(this, data);
  };
  
  next();
});

// Enhanced analyze login page endpoint
app.post('/analyze', async (req, res) => {
  const startTime = Date.now();
  try {
    const { url, use_browser = false } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: 'URL is required' 
      });
    }

    console.log(`[${new Date().toISOString()}] Analyzing login page: ${url} (browser: ${use_browser})`);

    let fields = [];
    let securityFeatures = [];
    let metadata = {};

    if (use_browser) {
      // Use headless browser for JavaScript-heavy pages with timeout
      const browserResult = await Promise.race([
        analyzePageWithBrowser(url),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Browser analysis timeout')), 100000) // 100 seconds
        )
      ]);
      fields = browserResult.fields;
      securityFeatures = browserResult.securityFeatures;
      metadata = browserResult.metadata;
    } else {
      // Use simple fetch for static analysis with timeout
      const response = await Promise.race([
        fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Fetch timeout')), 30000) // 30 seconds
        )
      ]);

      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      fields = analyzeHtmlForLoginFields(html);
      securityFeatures = analyzeHtmlForSecurityFeatures(html);
      metadata = {
        title: extractTitle(html),
        forms_found: (html.match(/<form/gi) || []).length,
        analyzed_at: new Date().toISOString()
      };
    }

    // Store results in database (with error handling)
    try {
      for (const field of fields) {
        await pool.query(
          'INSERT INTO detected_fields (url, field_type, selector, placeholder, label, required) VALUES ($1, $2, $3, $4, $5, $6)',
          [url, field.type, field.selector, field.placeholder, field.label, field.required]
        );
      }

      // Store security features
      for (const feature of securityFeatures) {
        await pool.query(
          'INSERT INTO security_features (url, feature_type, details) VALUES ($1, $2, $3)',
          [url, feature.type, JSON.stringify(feature.details)]
        );
      }
    } catch (dbError) {
      console.warn('Database storage failed, continuing with analysis:', dbError.message);
    }

    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] Analysis completed for ${url} in ${duration}ms:`, { 
      fieldsFound: fields.length, 
      securityFeatures: securityFeatures.length,
      metadata 
    });

    res.json({
      success: true,
      fields,
      security_features: securityFeatures,
      metadata: {
        ...metadata,
        analysis_duration_ms: duration
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] Error analyzing login page after ${duration}ms:`, error.message);
    
    // Determine appropriate error response
    let errorMessage = 'Failed to analyze login page';
    let statusCode = 500;
    
    if (error.message.includes('timeout')) {
      errorMessage = 'Analysis timeout - the page took too long to load. Try again or disable browser mode.';
      statusCode = 408;
    } else if (error.message.includes('fetch')) {
      errorMessage = 'Unable to access the webpage. Please check the URL.';
      statusCode = 400;
    }
    
    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      debug_error: error.message,
      duration_ms: duration
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'analyzer',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

async function analyzePageWithBrowser(url) {
  let browser;
  try {
    console.log(`[${new Date().toISOString()}] Starting browser analysis for: ${url}`);
    
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    const page = await browser.newPage();
    
    // Set shorter timeouts for individual operations
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);
    
    await page.goto(url, { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });

    // Extract page content after JavaScript execution
    const content = await page.content();
    const title = await page.title();

    console.log(`[${new Date().toISOString()}] Page loaded, analyzing fields for: ${url}`);

    // Analyze fields using browser context
    const fields = await analyzeFieldsWithBrowser(page);
    
    // Detect security features
    const securityFeatures = await detectSecurityFeaturesWithBrowser(page);

    const metadata = {
      title,
      forms_found: (content.match(/<form/gi) || []).length,
      analyzed_at: new Date().toISOString(),
      javascript_enabled: true
    };

    console.log(`[${new Date().toISOString()}] Browser analysis completed for: ${url}`);
    return { fields, securityFeatures, metadata };

  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.warn('Error closing browser:', closeError.message);
      }
    }
  }
}

async function analyzeFieldsWithBrowser(page) {
  return await page.evaluate(() => {
    const fields = [];
    
    // Find all input fields
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
      const field = analyzeInputElement(input);
      if (field) fields.push(field);
    });
    
    // Find all buttons
    const buttons = document.querySelectorAll('button, input[type="submit"]');
    buttons.forEach(button => {
      const field = analyzeButtonElement(button);
      if (field) fields.push(field);
    });
    
    function analyzeInputElement(input) {
      const type = input.type?.toLowerCase() || 'text';
      const name = input.name?.toLowerCase() || '';
      const id = input.id?.toLowerCase() || '';
      const placeholder = input.placeholder || '';
      const className = input.className?.toLowerCase() || '';
      
      let fieldType = 'other';
      
      if (type === 'password') {
        fieldType = 'password';
      } else if (type === 'email' || name.includes('email') || id.includes('email') || 
                 placeholder.toLowerCase().includes('email') || className.includes('email')) {
        fieldType = 'email';
      } else if (name.includes('user') || id.includes('user') || placeholder.toLowerCase().includes('user') ||
                 name.includes('login') || id.includes('login') || placeholder.toLowerCase().includes('login') ||
                 className.includes('user') || className.includes('login')) {
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
        label: placeholder || input.labels?.[0]?.textContent || (fieldType.charAt(0).toUpperCase() + fieldType.slice(1)),
        required: input.required || false
      };
    }
    
    function analyzeButtonElement(button) {
      const type = button.type?.toLowerCase() || 'button';
      const text = button.textContent?.trim().toLowerCase() || '';
      const className = button.className?.toLowerCase() || '';
      
      if (type === 'submit' || text.includes('login') || text.includes('sign in') || 
          text.includes('submit') || className.includes('login') || className.includes('submit')) {
        return {
          type: 'submit',
          selector: button.id ? `#${button.id}` : 'button[type="submit"]',
          label: button.textContent?.trim() || 'Submit',
          required: false
        };
      }
      
      return null;
    }
    
    return fields;
  });
}

async function detectSecurityFeaturesWithBrowser(page) {
  return await page.evaluate(() => {
    const features = [];
    
    // Check for CAPTCHA
    const captchaElements = document.querySelectorAll(
      'img[src*="captcha"], [class*="captcha"], [id*="captcha"], .g-recaptcha, #recaptcha, [data-sitekey]'
    );
    if (captchaElements.length > 0) {
      features.push({
        type: 'captcha',
        details: { count: captchaElements.length, types: ['recaptcha', 'image'] }
      });
    }
    
    // Check for CSRF tokens
    const csrfElements = document.querySelectorAll(
      'input[name*="csrf"], input[name*="token"], meta[name="csrf-token"], meta[name="_token"]'
    );
    if (csrfElements.length > 0) {
      features.push({
        type: 'csrf',
        details: { tokens_found: csrfElements.length }
      });
    }
    
    // Check for MFA fields
    const mfaElements = document.querySelectorAll(
      'input[name*="code"], input[placeholder*="code"], [class*="mfa"], [id*="mfa"], [class*="otp"], [id*="otp"]'
    );
    if (mfaElements.length > 0) {
      features.push({
        type: 'mfa',
        details: { fields_found: mfaElements.length }
      });
    }
    
    // Check for OAuth/SSO buttons
    const oauthElements = document.querySelectorAll(
      '[class*="oauth"], [class*="google"], [class*="facebook"], [class*="microsoft"], [class*="sso"]'
    );
    if (oauthElements.length > 0) {
      features.push({
        type: 'oauth',
        details: { providers_found: oauthElements.length }
      });
    }
    
    return features;
  });
}

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

function analyzeHtmlForSecurityFeatures(html) {
  const features = [];
  
  // Check for CAPTCHA
  if (html.includes('captcha') || html.includes('recaptcha') || html.includes('data-sitekey')) {
    features.push({
      type: 'captcha',
      details: { detected_in_html: true }
    });
  }
  
  // Check for CSRF
  if (html.includes('csrf') || html.includes('_token')) {
    features.push({
      type: 'csrf',
      details: { detected_in_html: true }
    });
  }
  
  // Check for OAuth
  if (html.includes('oauth') || html.includes('google') || html.includes('facebook')) {
    features.push({
      type: 'oauth',
      details: { detected_in_html: true }
    });
  }
  
  return features;
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

// Global error handler
app.use((error, req, res, next) => {
  console.error('Analyzer service error:', error);
  if (!res.headersSent) {
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Enhanced analyzer service running on port ${port} and accessible from all interfaces`);
  console.log(`Health check available at: http://0.0.0.0:${port}/health`);
});
