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
      console.log(`[${new Date().toISOString()}] HTML fetched, analyzing fields...`);
      
      fields = analyzeHtmlForLoginFields(html);
      securityFeatures = analyzeHtmlForSecurityFeatures(html);
      metadata = {
        title: extractTitle(html),
        forms_found: (html.match(/<form/gi) || []).length,
        analyzed_at: new Date().toISOString()
      };
      
      console.log(`[${new Date().toISOString()}] Analysis complete: ${fields.length} fields found, ${securityFeatures.length} security features`);
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
    console.log('Starting browser-based field analysis...');
    
    // Find all input fields
    const inputs = document.querySelectorAll('input');
    console.log(`Found ${inputs.length} input elements`);
    
    inputs.forEach((input, index) => {
      console.log(`Analyzing input ${index + 1}:`, {
        type: input.type,
        name: input.name,
        id: input.id,
        placeholder: input.placeholder,
        className: input.className
      });
      
      const field = analyzeInputElement(input);
      if (field) {
        console.log(`Input ${index + 1} classified as:`, field.type);
        fields.push(field);
      } else {
        console.log(`Input ${index + 1} filtered out`);
      }
    });
    
    // Find all buttons
    const buttons = document.querySelectorAll('button, input[type="submit"]');
    console.log(`Found ${buttons.length} button elements`);
    
    buttons.forEach((button, index) => {
      console.log(`Analyzing button ${index + 1}:`, {
        type: button.type,
        textContent: button.textContent,
        className: button.className
      });
      
      const field = analyzeButtonElement(button);
      if (field) {
        console.log(`Button ${index + 1} classified as:`, field.type);
        fields.push(field);
      }
    });
    
    console.log(`Browser analysis complete: ${fields.length} fields detected`);
    return fields;
    
    function analyzeInputElement(input) {
      const type = input.type?.toLowerCase() || 'text';
      const name = input.name?.toLowerCase() || '';
      const id = input.id?.toLowerCase() || '';
      const placeholder = input.placeholder?.toLowerCase() || '';
      const className = input.className?.toLowerCase() || '';
      const ariaLabel = input.getAttribute('aria-label')?.toLowerCase() || '';
      
      let fieldType = 'other';
      
      // Password field detection
      if (type === 'password') {
        fieldType = 'password';
      }
      // Email field detection - expanded patterns
      else if (type === 'email' || 
               name.includes('email') || name.includes('mail') ||
               id.includes('email') || id.includes('mail') ||
               placeholder.includes('email') || placeholder.includes('mail') ||
               className.includes('email') || className.includes('mail') ||
               ariaLabel.includes('email') || ariaLabel.includes('mail')) {
        fieldType = 'email';
      }
      // Username field detection - expanded patterns
      else if (name.includes('user') || name.includes('login') || name.includes('account') || 
               name.includes('signin') || name.includes('username') ||
               id.includes('user') || id.includes('login') || id.includes('account') || 
               id.includes('signin') || id.includes('username') ||
               placeholder.includes('user') || placeholder.includes('login') || 
               placeholder.includes('account') || placeholder.includes('signin') ||
               className.includes('user') || className.includes('login') || 
               className.includes('account') || className.includes('signin') ||
               ariaLabel.includes('user') || ariaLabel.includes('login') || 
               ariaLabel.includes('account') || ariaLabel.includes('signin')) {
        fieldType = 'username';
      }
      // Submit button detection
      else if (type === 'submit') {
        fieldType = 'submit';
      }
      // For text inputs, be more inclusive - check if it might be a login field
      else if (type === 'text' && (
        // If it's in a form with a password field, it's likely a username field
        document.querySelector('input[type="password"]') ||
        // If it has login-related context
        name.includes('name') || id.includes('name') ||
        placeholder.includes('name') || placeholder.includes('enter') ||
        // Common login field patterns
        name === 'login' || id === 'login' || name === 'user' || id === 'user'
      )) {
        fieldType = 'username';
      }
      
      // Don't filter out fields as aggressively - include more borderline cases
      if (fieldType === 'other' && type === 'text') {
        // If there's a password field on the page, include text fields that might be username
        const hasPasswordField = document.querySelector('input[type="password"]');
        if (hasPasswordField && (name || id || placeholder)) {
          fieldType = 'username'; // Assume it's a username field
        }
      }
      
      if (fieldType === 'other') {
        return null; // Only filter out if truly unrelated
      }
      
      const selector = id ? `#${id}` : name ? `input[name="${name}"]` : `input[type="${type}"]`;
      
      return {
        type: fieldType,
        selector,
        placeholder: input.placeholder || undefined,
        label: input.placeholder || input.labels?.[0]?.textContent || ariaLabel || 
               (fieldType.charAt(0).toUpperCase() + fieldType.slice(1)),
        required: input.required || false
      };
    }
    
    function analyzeButtonElement(button) {
      const type = button.type?.toLowerCase() || 'button';
      const text = button.textContent?.trim().toLowerCase() || '';
      const className = button.className?.toLowerCase() || '';
      
      if (type === 'submit' || 
          text.includes('login') || text.includes('sign in') || text.includes('log in') ||
          text.includes('submit') || text.includes('enter') || text.includes('go') ||
          className.includes('login') || className.includes('submit') ||
          className.includes('signin') || className.includes('btn-primary')) {
        return {
          type: 'submit',
          selector: button.id ? `#${button.id}` : 'button[type="submit"]',
          label: button.textContent?.trim() || 'Submit',
          required: false
        };
      }
      
      return null;
    }
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
  console.log('Starting HTML-based field analysis...');
  
  // Enhanced regex patterns for modern HTML
  const inputRegex = /<input[^>]*>/gi;
  const buttonRegex = /<button[^>]*>.*?<\/button>/gi;
  
  let match;
  let inputCount = 0;
  
  // Analyze input fields
  while ((match = inputRegex.exec(html)) !== null) {
    inputCount++;
    const inputTag = match[0];
    console.log(`Analyzing HTML input ${inputCount}:`, inputTag.substring(0, 100));
    
    const field = parseInputField(inputTag);
    if (field) {
      console.log(`HTML input ${inputCount} classified as:`, field.type);
      fields.push(field);
    } else {
      console.log(`HTML input ${inputCount} filtered out`);
    }
  }
  
  let buttonCount = 0;
  // Analyze buttons
  while ((match = buttonRegex.exec(html)) !== null) {
    buttonCount++;
    const buttonTag = match[0];
    console.log(`Analyzing HTML button ${buttonCount}:`, buttonTag.substring(0, 100));
    
    const field = parseButtonField(buttonTag);
    if (field) {
      console.log(`HTML button ${buttonCount} classified as:`, field.type);
      fields.push(field);
    }
  }
  
  console.log(`HTML analysis complete: ${fields.length} fields detected from ${inputCount} inputs and ${buttonCount} buttons`);
  
  // Fallback: if no fields detected but there's a password field, be more inclusive
  if (fields.length === 0 && html.includes('type="password"')) {
    console.log('No fields detected but password field exists, applying fallback detection...');
    const fallbackFields = applyFallbackDetection(html);
    fields.push(...fallbackFields);
  }
  
  return fields;
}

function applyFallbackDetection(html) {
  console.log('Applying fallback detection for missed login fields...');
  const fields = [];
  
  // Find all input tags and be very inclusive
  const inputRegex = /<input[^>]*>/gi;
  let match;
  
  while ((match = inputRegex.exec(html)) !== null) {
    const inputTag = match[0];
    const typeMatch = inputTag.match(/type=['"]([^'"]*)['"]/i);
    const nameMatch = inputTag.match(/name=['"]([^'"]*)['"]/i);
    const idMatch = inputTag.match(/id=['"]([^'"]*)['"]/i);
    
    const type = typeMatch?.[1]?.toLowerCase() || 'text';
    const name = nameMatch?.[1] || '';
    const id = idMatch?.[1] || '';
    
    if (type === 'password') {
      fields.push({
        type: 'password',
        selector: id ? `#${id}` : name ? `input[name="${name}"]` : 'input[type="password"]',
        label: 'Password',
        required: inputTag.includes('required')
      });
    } else if (type === 'text' || type === 'email') {
      // In fallback mode, include any text/email field
      fields.push({
        type: type === 'email' ? 'email' : 'username',
        selector: id ? `#${id}` : name ? `input[name="${nameMatch?.[1]}"]` : `input[type="${type}"]`,
        label: type === 'email' ? 'Email' : 'Username',
        required: inputTag.includes('required')
      });
    }
  }
  
  console.log(`Fallback detection found ${fields.length} fields`);
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
  const classMatch = inputTag.match(/class=['"]([^'"]*)['"]/i);
  const ariaLabelMatch = inputTag.match(/aria-label=['"]([^'"]*)['"]/i);
  const requiredMatch = inputTag.match(/required/i);
  
  const type = typeMatch?.[1]?.toLowerCase() || 'text';
  const name = nameMatch?.[1]?.toLowerCase() || '';
  const id = idMatch?.[1]?.toLowerCase() || '';
  const placeholder = placeholderMatch?.[1]?.toLowerCase() || '';
  const className = classMatch?.[1]?.toLowerCase() || '';
  const ariaLabel = ariaLabelMatch?.[1]?.toLowerCase() || '';
  
  let fieldType = 'other';
  
  // Enhanced detection patterns
  if (type === 'password') {
    fieldType = 'password';
  } else if (type === 'email' || 
             name.includes('email') || name.includes('mail') ||
             id.includes('email') || id.includes('mail') ||
             placeholder.includes('email') || placeholder.includes('mail') ||
             className.includes('email') || className.includes('mail') ||
             ariaLabel.includes('email') || ariaLabel.includes('mail')) {
    fieldType = 'email';
  } else if (name.includes('user') || name.includes('login') || name.includes('account') || 
             name.includes('signin') || name.includes('username') || name.includes('uname') ||
             id.includes('user') || id.includes('login') || id.includes('account') || 
             id.includes('signin') || id.includes('username') || id.includes('uname') ||
             placeholder.includes('user') || placeholder.includes('login') || 
             placeholder.includes('account') || placeholder.includes('signin') ||
             placeholder.includes('username') || placeholder.includes('name') ||
             className.includes('user') || className.includes('login') || 
             className.includes('account') || className.includes('signin') ||
             ariaLabel.includes('user') || ariaLabel.includes('login') || 
             ariaLabel.includes('account') || ariaLabel.includes('signin')) {
    fieldType = 'username';
  } else if (type === 'submit') {
    fieldType = 'submit';
  }
  // Be more inclusive with text fields
  else if (type === 'text' && (name || id || placeholder)) {
    // If it has any identifying attributes, treat as potential username field
    fieldType = 'username';
  }
  
  // Only filter out if it's truly not relevant
  if (fieldType === 'other' && !name && !id && !placeholder) {
    return null;
  }
  
  if (fieldType === 'other') {
    fieldType = 'username'; // Default to username for unclassified fields with attributes
  }
  
  const selector = id ? `#${id}` : name ? `input[name="${nameMatch?.[1]}"]` : `input[type="${type}"]`;
  
  return {
    type: fieldType,
    selector,
    placeholder: placeholderMatch?.[1] || undefined,
    label: placeholderMatch?.[1] || ariaLabelMatch?.[1] || 
           (fieldType.charAt(0).toUpperCase() + fieldType.slice(1)),
    required: !!requiredMatch
  };
}

function parseButtonField(buttonTag) {
  const typeMatch = buttonTag.match(/type=['"]([^'"]*)['"]/i);
  const textMatch = buttonTag.match(/>([^<]*)</);
  const classMatch = buttonTag.match(/class=['"]([^'"]*)['"]/i);
  
  const type = typeMatch?.[1]?.toLowerCase() || 'button';
  const text = textMatch?.[1]?.trim().toLowerCase() || '';
  const className = classMatch?.[1]?.toLowerCase() || '';
  
  if (type === 'submit' || 
      text.includes('login') || text.includes('sign in') || text.includes('log in') ||
      text.includes('submit') || text.includes('enter') || text.includes('go') ||
      text.includes('continue') || text.includes('next') ||
      className.includes('login') || className.includes('submit') ||
      className.includes('signin') || className.includes('btn-primary') ||
      className.includes('btn-login')) {
    return {
      type: 'submit',
      selector: 'button[type="submit"]',
      label: textMatch?.[1]?.trim() || 'Submit',
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
