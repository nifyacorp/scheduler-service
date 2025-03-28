# NIFYA Scheduler Service

A centralized scheduling service for the NIFYA platform, responsible for executing time-based operations across the system.

## Overview

The Scheduler Service provides a unified approach to managing scheduled tasks in the NIFYA platform:

- Executes tasks based on defined cron schedules
- Manages subscription processing, email digests, and cleanup operations
- Provides API endpoints for manual task triggering and monitoring
- Tracks execution history and performance metrics
- Implements robust error handling and retry mechanisms

## Architecture

The service follows a modular design with these key components:

- **Task Definitions**: Declarative task configurations with handlers
- **Task Executor**: Core engine for validating and running tasks
- **API Layer**: RESTful endpoints for task management
- **Scheduler**: Cron-based scheduling of recurring tasks

## Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn
- PostgreSQL database (optional)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/nifya-scheduler-service.git
   cd nifya-scheduler-service
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Configure environment variables:
   ```
   cp .env.example .env
   ```
   Edit the `.env` file with your environment-specific configuration.

4. Start the service:
   ```
   npm run dev
   ```

The service will be available at http://localhost:8081.

## API Endpoints

### Task Management

- `POST /api/v1/tasks/:taskType`: Execute a task immediately
- `GET /api/v1/tasks`: List all available tasks
- `GET /api/v1/tasks/:taskType/status`: Get task status
- `POST /api/v1/tasks/:taskType/schedule`: Schedule a task with a cron expression

### History

- `GET /api/v1/history`: Get task execution history
- `GET /api/v1/history/:executionId`: Get specific execution details

### Template Management

- `GET /api/v1/templates`: List all templates with filtering options
- `GET /api/v1/templates/:id`: Get a specific template by ID
- `POST /api/v1/templates`: Create a new template
- `PUT /api/v1/templates/:id`: Update an existing template
- `DELETE /api/v1/templates/:id`: Delete a template

### Admin

- `GET /api/v1/admin/diagnostics`: Get service diagnostics

### Health Checks

- `GET /health`: Basic health check
- `GET /ready`: Readiness check

## Task Types

### 1. run-subscriptions

Processes all active user subscriptions to find new matches.

Parameters:
- `batchSize`: Number of subscriptions to process (default: 10)
- `subscriptionType`: Optional filter by subscription type
- `specificIds`: Optional array of specific subscription IDs to process

### 2. email-digest

Generates and sends daily email digest notifications.

Parameters:
- `timezone`: Timezone to process (default: UTC)
- `batchSize`: Number of users to process per batch (default: 50)

### 3. cleanup

Performs maintenance cleanup of old data.

Parameters:
- `notificationRetentionDays`: Days to keep notifications (default: 90)
- `logRetentionDays`: Days to keep logs (default: 30)
- `tempFileRetentionDays`: Days to keep temporary files (default: 7)

## Template Management

The service includes a complete template management system that allows users to create, share, and use subscription templates:

### Template Structure

Each template includes:

- **Basic Information**: Name, description, and type (BOE, real estate, etc.)
- **Prompts**: List of search prompts used for subscription processing
- **Configuration**: Frequency, icons, and metadata
- **Access Control**: Public/private status and creator information

### Built-in Templates

The system comes with several built-in templates:

1. **BOE General**: General subscription for the Spanish Official State Gazette
2. **BOE Subvenciones**: Track grants and subsidies in the BOE
3. **Real Estate Rental**: Track rental properties in specific areas

### User-Created Templates

Users can:

- Create custom templates for their specific needs
- Share templates publicly with other users
- Keep templates private for personal use
- See usage statistics for their shared templates

### Template-Based Subscriptions

When creating a subscription, users can:
- Choose from public templates 
- Create a subscription based on a template
- Customize template parameters for their needs

## Configuration

The service can be configured through environment variables:

- `PORT`: HTTP port (default: 8081)
- `NODE_ENV`: Environment mode (development, production)
- `LOG_LEVEL`: Logging level (default: info)
- `API_KEY`: API key for service-to-service authentication
- `DB_HOST`, `DB_PORT`, etc.: Database connection settings
- Service URLs for connecting to other NIFYA components

## Development

### Running Tests

```
npm test
```

### Linting

```
npm run lint
```

### Building for Production

```
npm run build
```

## Deployment

The service is designed to run in containerized environments:

```
docker build -t nifya-scheduler-service .
docker run -p 8081:8081 nifya-scheduler-service
```

### Cloud Run Deployment

```
gcloud builds submit --tag gcr.io/nifya/scheduler-service
gcloud run deploy scheduler-service --image gcr.io/nifya/scheduler-service --platform managed
```

## Monitoring

The service exports structured logs in JSON format compatible with Cloud Logging or other log aggregation systems. Task execution metrics can be accessed through the diagnostics endpoint.