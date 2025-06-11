
# Login Page Detector - Microservices Architecture

A distributed login page analysis tool built with microservices architecture for local hosting.

## Architecture

- **Frontend**: React + TypeScript + Tailwind CSS
- **API Gateway**: Express.js proxy server (Port 3000)
- **Analyzer Service**: Login page analysis microservice (Port 3001)
- **Form Service**: Form storage and retrieval microservice (Port 3002)
- **Database**: PostgreSQL (Port 5432)

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

### Development Setup

1. Install frontend dependencies:
```bash
npm install
```

2. Start the microservices:
```bash
docker-compose up -d postgres analyzer-service form-service api-gateway
```

3. Start the frontend:
```bash
npm run dev
```

### Manual Service Setup (without Docker)

1. Start PostgreSQL and run the database initialization script from `database/init.sql`

2. Start each microservice:
```bash
# Terminal 1 - Analyzer Service
cd services/analyzer
npm install
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/login_detector npm start

# Terminal 2 - Form Service
cd services/forms
npm install
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/login_detector npm start

# Terminal 3 - API Gateway
cd services/gateway
npm install
ANALYZER_SERVICE_URL=http://localhost:3001 FORM_SERVICE_URL=http://localhost:3002 npm start
```

## API Endpoints

### API Gateway (Port 3000)
- `POST /api/analyze` - Analyze login page
- `POST /api/forms/save` - Save generated form
- `GET /api/forms/list` - Get saved forms

### Individual Services
- Analyzer Service: http://localhost:3001
- Form Service: http://localhost:3002

## Environment Variables

### Database
- `DATABASE_URL`: PostgreSQL connection string

### API Gateway
- `ANALYZER_SERVICE_URL`: URL of analyzer service
- `FORM_SERVICE_URL`: URL of form service

## Service Health Checks

Each service provides a health check endpoint:
- `GET /health`

## Database Schema

The application uses PostgreSQL with the following tables:
- `detected_fields`: Stores analyzed login field data
- `generated_forms`: Stores generated form configurations

## Development Notes

- All services are containerized for easy deployment
- CORS is enabled for local development
- Services communicate through the API Gateway
- Database connection pooling is implemented for performance
- Each microservice has its own package.json and dependencies
