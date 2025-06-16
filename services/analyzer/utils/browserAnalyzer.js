
const puppeteer = require('puppeteer');
const { analyzeInputElement, analyzeButtonElement } = require('./fieldDetector');
const { detectSecurityFeaturesWithBrowser } = require('./securityDetector');

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

module.exports = {
  analyzePageWithBrowser,
  analyzeFieldsWithBrowser
};
