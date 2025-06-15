
const express = require('express');
const cors = require('cors');
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

app.use(express.json());

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

    // First analyze the page
    const analyzeResponse = await fetch(`${process.env.ANALYZER_SERVICE_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, use_browser: options.use_browser || false })
    });

    if (!analyzeResponse.ok) {
      throw new Error('Failed to analyze page');
    }

    const analysisResult = await analyzeResponse.json();

    // Then attempt login
    const submitResponse = await fetch(`${process.env.SUBMITTER_SERVICE_URL}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, credentials, options })
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

// Proxy to analyzer service
app.use('/api/analyze', createProxyMiddleware({
  target: process.env.ANALYZER_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api/analyze': '/analyze'
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Service unavailable' });
  }
}));

// Proxy to form service
app.use('/api/forms', createProxyMiddleware({
  target: process.env.FORM_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api/forms': ''
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Service unavailable' });
  }
}));

// Proxy to submitter service
app.use('/api/submit', createProxyMiddleware({
  target: process.env.SUBMITTER_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api/submit': '/submit'
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Service unavailable' });
  }
}));

// Proxy to submitter batch endpoint
app.use('/api/batch', createProxyMiddleware({
  target: process.env.SUBMITTER_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api/batch': '/batch'
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Service unavailable' });
  }
}));

// Catch all for unmatched routes
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`API Gateway running on port ${port} and accessible from all interfaces`);
  console.log(`Health check available at: http://0.0.0.0:${port}/health`);
});
