
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3003;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(cors({
  origin: '*',
  credentials: false
}));
app.use(express.json());

// Submit login attempt endpoint
app.post('/submit', async (req, res) => {
  try {
    const { url, credentials, options = {} } = req.body;
    
    if (!url || !credentials || !credentials.username || !credentials.password) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields: url, credentials.username, credentials.password' 
      });
    }

    console.log(`Attempting login to: ${url}`);
    const startTime = Date.now();

    const result = await attemptLogin(url, credentials, options);
    const duration = Date.now() - startTime;

    // Store the attempt in database
    await pool.query(
      'INSERT INTO login_attempts (target_url, username, success, response_status, response_headers, response_body, redirect_url, session_cookies, error_message, attempt_duration, user_agent, proxy_used) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
      [
        url,
        credentials.username,
        result.success,
        result.response_status,
        JSON.stringify(result.response_headers || {}),
        result.response_body,
        result.redirect_url,
        JSON.stringify(result.session_cookies || {}),
        result.error_message,
        duration,
        options.user_agent || 'LoginDetector/1.0',
        options.proxy || null
      ]
    );

    console.log(`Login attempt completed: ${result.success ? 'SUCCESS' : 'FAILED'}`);

    res.json({
      success: result.success,
      session_data: result.session_data,
      response_headers: result.response_headers,
      redirect_url: result.redirect_url,
      errors: result.errors,
      security_features: result.security_features,
      duration: duration
    });

  } catch (error) {
    console.error('Error submitting login:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to submit login' 
    });
  }
});

// Batch login attempts endpoint
app.post('/batch', async (req, res) => {
  try {
    const { job_name, target_urls, credentials, options = {} } = req.body;
    
    if (!job_name || !target_urls || !Array.isArray(target_urls) || !credentials) {
      return res.status(400).json({ 
        error: 'Missing required fields: job_name, target_urls (array), credentials' 
      });
    }

    // Create batch job record
    const result = await pool.query(
      'INSERT INTO batch_jobs (job_name, target_urls, credentials, options) VALUES ($1, $2, $3, $4) RETURNING id',
      [job_name, target_urls, JSON.stringify(credentials), JSON.stringify(options)]
    );

    const jobId = result.rows[0].id;

    // Process batch asynchronously
    processBatchJob(jobId, target_urls, credentials, options);

    res.json({ job_id: jobId, status: 'started' });

  } catch (error) {
    console.error('Error starting batch job:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to start batch job' 
    });
  }
});

// Get batch job status
app.get('/batch/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM batch_jobs WHERE id = $1',
      [jobId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Error getting batch job:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to get batch job' 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'submitter' });
});

async function attemptLogin(url, credentials, options) {
  let browser;
  try {
    // Launch headless browser
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
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    
    // Set user agent if provided
    if (options.user_agent) {
      await page.setUserAgent(options.user_agent);
    }

    // Navigate to login page
    const response = await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: options.timeout || 30000
    });

    // Detect security features
    const securityFeatures = await detectSecurityFeatures(page);
    
    // Try to find and fill login form
    const loginResult = await performLogin(page, credentials);
    
    // Get final page state
    const finalUrl = page.url();
    const cookies = await page.cookies();
    
    // Analyze response to determine success
    const success = await analyzeLoginSuccess(page, url, finalUrl);
    
    return {
      success,
      session_data: { cookies, final_url: finalUrl },
      response_headers: response.headers(),
      redirect_url: finalUrl !== url ? finalUrl : null,
      session_cookies: cookies,
      security_features,
      response_status: response.status(),
      errors: loginResult.errors || []
    };

  } catch (error) {
    return {
      success: false,
      error_message: error.message,
      errors: [error.message]
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function detectSecurityFeatures(page) {
  const features = [];
  
  try {
    // Check for CAPTCHA
    const captchaSelectors = [
      'img[src*="captcha"]',
      '[class*="captcha"]',
      '[id*="captcha"]',
      '.g-recaptcha',
      '#recaptcha'
    ];
    
    for (const selector of captchaSelectors) {
      const element = await page.$(selector);
      if (element) {
        features.push({ type: 'captcha', selector });
        break;
      }
    }
    
    // Check for CSRF tokens
    const csrfToken = await page.$('input[name*="csrf"], input[name*="token"], meta[name="csrf-token"]');
    if (csrfToken) {
      features.push({ type: 'csrf', detected: true });
    }
    
    // Check for MFA indicators
    const mfaSelectors = [
      '[name*="code"]',
      '[placeholder*="code"]',
      '[class*="mfa"]',
      '[id*="mfa"]'
    ];
    
    for (const selector of mfaSelectors) {
      const element = await page.$(selector);
      if (element) {
        features.push({ type: 'mfa', selector });
        break;
      }
    }

  } catch (error) {
    console.error('Error detecting security features:', error);
  }
  
  return features;
}

async function performLogin(page, credentials) {
  const errors = [];
  
  try {
    // Common username field selectors
    const usernameSelectors = [
      'input[type="email"]',
      'input[name*="email"]',
      'input[name*="username"]',
      'input[name*="user"]',
      'input[name*="login"]',
      'input[id*="email"]',
      'input[id*="username"]',
      'input[id*="user"]',
      'input[id*="login"]'
    ];
    
    // Common password field selectors
    const passwordSelectors = [
      'input[type="password"]',
      'input[name*="password"]',
      'input[name*="pass"]',
      'input[id*="password"]',
      'input[id*="pass"]'
    ];
    
    // Find and fill username field
    let usernameField = null;
    for (const selector of usernameSelectors) {
      usernameField = await page.$(selector);
      if (usernameField) break;
    }
    
    if (!usernameField) {
      errors.push('Username field not found');
      return { errors };
    }
    
    await usernameField.type(credentials.username);
    
    // Find and fill password field
    let passwordField = null;
    for (const selector of passwordSelectors) {
      passwordField = await page.$(selector);
      if (passwordField) break;
    }
    
    if (!passwordField) {
      errors.push('Password field not found');
      return { errors };
    }
    
    await passwordField.type(credentials.password);
    
    // Find and click submit button
    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:contains("Login")',
      'button:contains("Sign in")',
      'button:contains("Submit")',
      '[class*="login"]',
      '[class*="submit"]'
    ];
    
    let submitButton = null;
    for (const selector of submitSelectors) {
      submitButton = await page.$(selector);
      if (submitButton) break;
    }
    
    if (!submitButton) {
      errors.push('Submit button not found');
      return { errors };
    }
    
    // Click submit and wait for navigation
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {}),
      submitButton.click()
    ]);
    
    return { success: true, errors };
    
  } catch (error) {
    errors.push(error.message);
    return { errors };
  }
}

async function analyzeLoginSuccess(page, originalUrl, finalUrl) {
  try {
    // Check if URL changed (usually indicates successful login)
    if (finalUrl !== originalUrl && !finalUrl.includes('login') && !finalUrl.includes('signin')) {
      return true;
    }
    
    // Check for success indicators
    const successIndicators = [
      'welcome',
      'dashboard',
      'profile',
      'account',
      'logout',
      'success'
    ];
    
    const pageContent = await page.content();
    const $ = cheerio.load(pageContent);
    
    for (const indicator of successIndicators) {
      if (pageContent.toLowerCase().includes(indicator)) {
        return true;
      }
    }
    
    // Check for error messages
    const errorIndicators = [
      'invalid',
      'incorrect',
      'failed',
      'error',
      'wrong',
      'denied'
    ];
    
    for (const indicator of errorIndicators) {
      if (pageContent.toLowerCase().includes(indicator)) {
        return false;
      }
    }
    
    // Check for logout button (indicates successful login)
    const logoutButton = await page.$('a[href*="logout"], button:contains("Logout"), a:contains("Sign out")');
    if (logoutButton) {
      return true;
    }
    
    return false;
    
  } catch (error) {
    console.error('Error analyzing login success:', error);
    return false;
  }
}

async function processBatchJob(jobId, targetUrls, credentials, options) {
  try {
    await pool.query('UPDATE batch_jobs SET status = $1 WHERE id = $2', ['running', jobId]);
    
    const results = [];
    let completed = 0;
    
    for (const url of targetUrls) {
      try {
        const result = await attemptLogin(url, credentials, options);
        results.push({ url, ...result });
        completed++;
        
        // Update progress
        const progress = Math.round((completed / targetUrls.length) * 100);
        await pool.query('UPDATE batch_jobs SET progress = $1 WHERE id = $2', [progress, jobId]);
        
      } catch (error) {
        results.push({ url, success: false, error: error.message });
        completed++;
      }
    }
    
    // Mark job as completed
    await pool.query(
      'UPDATE batch_jobs SET status = $1, progress = $2, results = $3, completed_at = $4 WHERE id = $5',
      ['completed', 100, JSON.stringify(results), new Date(), jobId]
    );
    
  } catch (error) {
    console.error('Error processing batch job:', error);
    await pool.query('UPDATE batch_jobs SET status = $1 WHERE id = $2', ['failed', jobId]);
  }
}

app.listen(port, '0.0.0.0', () => {
  console.log(`Submitter service running on port ${port} and accessible from all interfaces`);
});
