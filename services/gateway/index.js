
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin: '*', // Allow all origins for external access
  credentials: false
}));
app.use(express.json());

// Health check for gateway
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'gateway' });
});

// Proxy to analyzer service
app.use('/api/analyze', createProxyMiddleware({
  target: process.env.ANALYZER_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api/analyze': '/analyze'
  }
}));

// Proxy to form service
app.use('/api/forms', createProxyMiddleware({
  target: process.env.FORM_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api/forms': ''
  }
}));

// Catch all for unmatched routes
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`API Gateway running on port ${port} and accessible from all interfaces`);
});
