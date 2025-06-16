
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Enhanced CORS configuration for external access
app.use(cors({
  origin: '*',
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Increase request size limits and add timeout handling
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Request timeout middleware
app.use((req, res, next) => {
  // Set longer timeout for analysis requests
  if (req.path.includes('/analyze') || req.path.includes('/login-attempt')) {
    req.setTimeout(120000); // 2 minutes for analysis
    res.setTimeout(120000);
  } else {
    req.setTimeout(30000); // 30 seconds for other requests
    res.setTimeout(30000);
  }
  
  req.on('timeout', () => {
    console.error(`Request timeout on ${req.path}`);
    if (!res.headersSent) {
      res.status(408).json({ error: 'Request timeout' });
    }
  });
  
  next();
});

// Serve static files from frontend build
app.use(express.static('/app/frontend-build', {
  maxAge: '1y',
  etag: true,
  lastModified: true
}));

// Health check for gateway
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'gateway' });
});

// Unified login attempt endpoint (Phase 3)
app.post('/api/login-attempt', async (req, res) => {
  try {
    const { url, credentials, options = {} } = req.body;
    
    if (!url || !credentials) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields: url, credentials' 
      });
    }

    console.log(`Processing unified login attempt for: ${url}`);

    // First analyze the page with extended timeout
    const analyzeResponse = await fetch(`${process.env.ANALYZER_SERVICE_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, use_browser: options.use_browser || false }),
      timeout: 120000 // 2 minutes timeout
    });

    if (!analyzeResponse.ok) {
      throw new Error('Failed to analyze page');
    }

    const analysisResult = await analyzeResponse.json();

    // Then attempt login
    const submitResponse = await fetch(`${process.env.SUBMITTER_SERVICE_URL}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, credentials, options }),
      timeout: 60000 // 1 minute timeout
    });

    if (!submitResponse.ok) {
      throw new Error('Failed to submit login');
    }

    const submitResult = await submitResponse.json();

    // Combine results
    res.json({
      success: submitResult.success,
      analysis: {
        fields: analysisResult.fields,
        security_features: analysisResult.security_features,
        metadata: analysisResult.metadata
      },
      submission: {
        session_data: submitResult.session_data,
        response_headers: submitResult.response_headers,
        redirect_url: submitResult.redirect_url,
        duration: submitResult.duration
      },
      errors: submitResult.errors || []
    });

  } catch (error) {
    console.error('Error in unified login attempt:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Enhanced proxy configuration with proper timeouts
const createEnhancedProxy = (target, pathRewrite) => {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite,
    timeout: 120000, // 2 minutes
    proxyTimeout: 120000, // 2 minutes
    headers: {
      'Connection': 'keep-alive',
    },
    onError: (err, req, res) => {
      console.error(`Proxy error for ${req.path}:`, err.message);
      if (!res.headersSent) {
        if (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED') {
          res.status(503).json({ error: 'Service temporarily unavailable' });
        } else if (err.code === 'ETIMEDOUT') {
          res.status(408).json({ error: 'Request timeout - analysis taking too long' });
        } else {
          res.status(500).json({ error: 'Service unavailable' });
        }
      }
    },
    onProxyReq: (proxyReq, req, res) => {
      console.log(`Proxying ${req.method} ${req.path} to ${target}`);
      // Set larger timeout for analysis requests
      if (req.path.includes('/analyze')) {
        proxyReq.setTimeout(120000);
      }
    },
    onProxyRes: (proxyRes, req, res) => {
      console.log(`Received ${proxyRes.statusCode} from ${req.path}`);
    }
  });
};

// API Routes - these must come before the catch-all static file handler

// Proxy to analyzer service with enhanced configuration
app.use('/api/analyze', createEnhancedProxy(
  process.env.ANALYZER_SERVICE_URL,
  { '^/api/analyze': '/analyze' }
));

// Proxy to form service
app.use('/api/forms', createEnhancedProxy(
  process.env.FORM_SERVICE_URL,
  { '^/api/forms': '' }
));

// Proxy to submitter service
app.use('/api/submit', createEnhancedProxy(
  process.env.SUBMITTER_SERVICE_URL,
  { '^/api/submit': '/submit' }
));

// Proxy to submitter batch endpoint
app.use('/api/batch', createEnhancedProxy(
  process.env.SUBMITTER_SERVICE_URL,
  { '^/api/batch': '/batch' }
));

// Catch-all handler for client-side routing (SPA)
app.get('*', (req, res) => {
  // Don't handle API routes that weren't matched above
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  
  // Serve index.html for all non-API routes (client-side routing)
  res.sendFile('/app/frontend-build/index.html');
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`API Gateway with integrated frontend running on port ${port} and accessible from all interfaces`);
  console.log(`Health check available at: http://0.0.0.0:${port}/health`);
  console.log(`Frontend served from: /app/frontend-build`);
});
