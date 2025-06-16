
// Request timeout and logging middleware
function requestLogger(req, res, next) {
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
}

module.exports = requestLogger;
