
# Advanced Login Page Detector - Complete Security Testing Platform

A comprehensive login page analysis and testing tool built with microservices architecture for security researchers and developers.

## Features

### Phase 1: Login Detection & Form Generation
- **Smart Field Detection**: Automatically identifies username, email, password, and submit fields
- **Form Code Generation**: Generates clean HTML forms based on detected structure
- **Database Storage**: Persistent storage of detected forms and results

### Phase 2: Advanced Analysis
- **Headless Browser Support**: JavaScript execution for dynamic content analysis
- **Security Feature Detection**: Identifies CAPTCHA, CSRF, MFA, and OAuth integrations
- **Enhanced Field Recognition**: AI-powered pattern recognition for complex forms

### Phase 3: Automated Login Testing
- **Real Login Attempts**: Automated credential submission with success/failure detection
- **Session Management**: Cookie handling and authentication state tracking
- **Response Analysis**: Detailed analysis of login responses and redirects

### Phase 4: Batch Operations
- **Bulk Testing**: Test credentials against multiple sites simultaneously
- **Job Management**: Track progress and results of batch operations
- **Rate Limiting**: Intelligent request throttling and retry mechanisms

### Phase 5: Integration & Export
- **RESTful API**: Complete API for external tool integration
- **Multiple Export Formats**: JSON, CSV, and code templates
- **Real-time Monitoring**: Live dashboards for ongoing operations

## Architecture

- **Frontend**: React + TypeScript + Tailwind CSS
- **API Gateway**: Express.js proxy server (Port 3000)
- **Analyzer Service**: Enhanced login page analysis (Port 3001)
- **Form Service**: Form storage and retrieval (Port 3002)
- **Submitter Service**: Login attempt execution (Port 3003)
- **Database**: PostgreSQL with comprehensive schema (Port 5432)

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for development)

### Running with Docker

1. Start all services:
```bash
docker-compose up -d
```

2. The application will be available at:
- Frontend: http://localhost:5173
- API Gateway: http://localhost:3000
- Database: localhost:5432

### External Access

The services are configured to be accessible from outside localhost:

- API Gateway: http://YOUR_IP:3000
- Analyzer Service: http://YOUR_IP:3001
- Form Service: http://YOUR_IP:3002
- Submitter Service: http://YOUR_IP:3003
- Database: YOUR_IP:5432

To find your IP address:
- **Linux/Mac**: `ip addr show` or `ifconfig`
- **Windows**: `ipconfig`

## API Endpoints

### Unified Interface
- `POST /api/login-attempt` - Complete analysis and login attempt
  ```json
  {
    "url": "https://example.com/login",
    "credentials": {
      "username": "user@example.com",
      "password": "password123"
    },
    "options": {
      "use_browser": true,
      "timeout": 30000,
      "user_agent": "CustomBot/1.0"
    }
  }
  ```

### Individual Services
- `POST /api/analyze` - Analyze login page structure
- `POST /api/submit` - Submit login credentials
- `POST /api/batch` - Start batch testing job
- `GET /api/batch/:jobId` - Get batch job status
- `POST /api/forms/save` - Save generated form
- `GET /api/forms/list` - Get saved forms

## Database Schema

### Core Tables
- `detected_fields`: Login field analysis results
- `generated_forms`: Saved form configurations
- `login_attempts`: Individual login attempt results
- `sessions`: Authentication session data
- `security_features`: Detected security measures
- `batch_jobs`: Bulk operation management

## Usage Examples

### Simple Analysis
```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/login"}'
```

### Login Attempt
```bash
curl -X POST http://localhost:3000/api/login-attempt \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/login",
    "credentials": {
      "username": "test@example.com",
      "password": "password123"
    },
    "options": {
      "use_browser": true
    }
  }'
```

### Batch Testing
```bash
curl -X POST http://localhost:3000/api/batch \
  -H "Content-Type: application/json" \
  -d '{
    "job_name": "Security Test Batch",
    "target_urls": [
      "https://site1.com/login",
      "https://site2.com/signin"
    ],
    "credentials": {
      "username": "test@example.com",
      "password": "password123"
    }
  }'
```

## Security Considerations

### Development vs Production
- **Development**: CORS enabled for all origins
- **Production**: Configure specific allowed origins
- **Authentication**: Implement proper API authentication
- **Rate Limiting**: Configure appropriate request limits

### Responsible Usage
- Only test sites you own or have explicit permission to test
- Respect robots.txt and site terms of service
- Implement proper rate limiting to avoid service disruption
- Use appropriate user agents and identify your testing

## Network Configuration

### Firewall Settings
Open these ports for external access:
- 3000 (API Gateway)
- 3001 (Analyzer Service) 
- 3002 (Form Service)
- 3003 (Submitter Service)
- 5432 (PostgreSQL)

### Environment Variables

```bash
# Database Configuration
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/login_detector

# Service URLs (for API Gateway)
ANALYZER_SERVICE_URL=http://localhost:3001
FORM_SERVICE_URL=http://localhost:3002
SUBMITTER_SERVICE_URL=http://localhost:3003

# Port Configuration
PORT=3000
```

## Development Setup

1. Install frontend dependencies:
```bash
npm install
```

2. Start the microservices:
```bash
docker-compose up -d postgres analyzer-service form-service submitter-service api-gateway
```

3. Start the frontend:
```bash
npm run dev
```

## Service Health Checks

Each service provides a health check endpoint:
- `GET /health`

Monitor service status:
```bash
curl http://localhost:3000/health  # Gateway
curl http://localhost:3001/health  # Analyzer
curl http://localhost:3002/health  # Forms
curl http://localhost:3003/health  # Submitter
```

## Advanced Features

### Browser Automation
- Puppeteer-based headless browser
- JavaScript execution support
- Dynamic content analysis
- Screenshot capabilities

### Security Detection
- CAPTCHA identification
- CSRF token detection
- Multi-factor authentication fields
- OAuth/SSO integration points

### Batch Processing
- Concurrent request handling
- Progress tracking
- Result aggregation
- Export capabilities

## Integration Examples

### JavaScript SDK
```javascript
const LoginDetector = require('login-detector-sdk');

const client = new LoginDetector('http://localhost:3000');

// Analyze a site
const analysis = await client.analyze('https://example.com/login');

// Attempt login
const result = await client.attemptLogin('https://example.com/login', {
  username: 'user@example.com',
  password: 'password123'
});
```

### Python Integration
```python
import requests

# Complete login test
response = requests.post('http://localhost:3000/api/login-attempt', json={
    'url': 'https://example.com/login',
    'credentials': {
        'username': 'user@example.com',
        'password': 'password123'
    },
    'options': {
        'use_browser': True
    }
})

result = response.json()
print(f"Login {'successful' if result['success'] else 'failed'}")
```

## Development Notes

- All services are containerized for easy deployment
- CORS is enabled for external access
- Services communicate through the API Gateway
- Database connection pooling implemented for performance
- Each microservice has its own package.json and dependencies
- Services bind to 0.0.0.0 to accept connections from any interface
- Comprehensive logging for debugging and monitoring

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Disclaimer

This tool is intended for security research and testing of systems you own or have explicit permission to test. Users are responsible for ensuring their use complies with applicable laws and regulations.
