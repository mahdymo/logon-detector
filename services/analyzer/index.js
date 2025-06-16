
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const pool = require('./config/database');
const requestLogger = require('./middleware/requestLogger');
const { analyzePageWithBrowser } = require('./utils/browserAnalyzer');
const { analyzeHtmlForLoginFields, extractTitle } = require('./utils/htmlAnalyzer');
const { analyzeHtmlForSecurityFeatures } = require('./utils/securityDetector');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors({
  origin: '*',
  credentials: false
}));

// Increase request size limits and add timeout handling
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Request timeout and logging middleware
app.use(requestLogger);

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
