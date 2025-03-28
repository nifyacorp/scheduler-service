# NIFYA Scheduler Service

A centralized microservice for managing scheduled tasks across the NIFYA platform.

## Overview

The NIFYA Scheduler Service is responsible for executing all time-based operations across the platform, including:

- Processing active subscriptions
- Generating email digests
- Performing cleanup and maintenance tasks
- Managing user-created templates

## Architecture

The service uses a task-based architecture where each scheduled operation is defined as a "task" with specific parameters, execution logic, and error handling.

```
┌───────────────────┐      ┌─────────────────┐      ┌───────────────────┐
│                   │      │                 │      │                   │
│  Cloud Scheduler  │─────▶│    Scheduler    │─────▶│  Backend/Services │
│                   │      │     Service     │      │                   │
└───────────────────┘      └─────────────────┘      └───────────────────┘
                                    │
                                    │
                                    ▼
                           ┌─────────────────┐
                           │                 │
                           │    Monitoring   │
                           │    & Logging    │
                           │                 │
                           └─────────────────┘
```

## Key Components

1. **Task Definitions**: Code modules that define schedulable operations
2. **Task Executor**: Core component for running tasks with validation and error handling
3. **API Layer**: RESTful endpoints for managing tasks and templates
4. **Template Manager**: System for managing reusable task templates

## Development

### Prerequisites

- Node.js 18+
- npm or yarn
- Access to Google Cloud services (for deployment)
- Access to the NIFYA PostgreSQL database

### Setup

```bash
# Clone the repository
git clone https://github.com/nifyacorp/scheduler-service.git
cd scheduler-service

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev
```

### Database Requirements

This service requires database tables that are managed by the backend service. It does not create its own tables. The required tables are:

- `task_history` - For storing execution records
- `templates` - For managing subscription templates

These tables are defined in the backend's migration file: `backend/supabase/migrations/20250328000000_scheduler_service_tables.sql`

Make sure these tables exist before running this service.

### Configuration

The service is configured via environment variables:

- `PORT`: Server port (default: 8080)
- `NODE_ENV`: Environment (development, production)
- `LOG_LEVEL`: Logging verbosity
- `BACKEND_SERVICE_URL`: URL of the backend service
- `BACKEND_API_KEY`: API key for backend service authentication
- `PUBSUB_TOPIC_NOTIFICATIONS`: Topic for notification events
- `DB_HOST`: PostgreSQL host 
- `DB_PORT`: PostgreSQL port (default: 5432)
- `DB_NAME`: Database name
- `DB_USER`: Database user
- `DB_PASSWORD`: Database password

### Project Structure

```
scheduler-service/
├── src/
│   ├── index.js           # Entry point
│   ├── config.js          # Configuration
│   ├── server.js          # HTTP server setup
│   ├── scheduler.js       # Core scheduling logic
│   ├── utils/             # Utilities
│   ├── models/            # Data models
│   ├── routes/            # API routes
│   └── tasks/             # Task implementations
├── test/                  # Test suite
├── .github/               # GitHub Actions workflows
├── Dockerfile             # Container definition
├── cloudbuild.yaml        # Cloud Build configuration
└── package.json           # Dependencies and scripts
```

## API Endpoints

### Task Management

- `POST /api/v1/tasks/:taskType`: Execute a task
- `GET /api/v1/tasks/:taskType/status`: Get task status
- `GET /api/v1/history`: View task execution history

### Template Management

- `GET /api/v1/templates`: List templates
- `POST /api/v1/templates`: Create a template
- `GET /api/v1/templates/:id`: Get template details
- `PUT /api/v1/templates/:id`: Update a template
- `DELETE /api/v1/templates/:id`: Delete a template

### Service Information

- `GET /health`: Service health check
- `GET /version`: Service version info

## Deployment

The service is designed to run on Google Cloud Run:

1. First ensure database tables are created by running the backend migration
2. Run `setup-gcp.sh` to create the necessary GCP resources
3. Set up GitHub to Cloud Run connection for the repository

## Security

- Service-to-service authentication using API keys
- Role-based access for admin operations
- Secure environment variable handling