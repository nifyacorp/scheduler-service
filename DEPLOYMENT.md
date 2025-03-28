# Scheduler Service Deployment Guide

This document provides step-by-step instructions for deploying the NIFYA Scheduler Service to Google Cloud Run.

## Prerequisites

1. Google Cloud account with permission to:
   - Create and manage Cloud Run services
   - Create and manage Cloud Scheduler jobs
   - Manage Secret Manager secrets
   - Create service accounts and assign IAM permissions
   - Use Cloud Build
   - Connect to Cloud SQL (or Supabase database)

2. GitHub account with access to the nifyacorp organization.

3. Local environment with:
   - Git
   - Google Cloud SDK (gcloud)
   - Node.js (for local testing)

## Deployment Steps

### 1. Set Up the GitHub Repository

```bash
# Clone the repository from GitHub
git clone https://github.com/nifyacorp/scheduler-service.git
cd scheduler-service

# If the repository doesn't exist yet, create it on GitHub first, then:
git init
git add .
git commit -m "Initial commit for scheduler service"
git remote add origin https://github.com/nifyacorp/scheduler-service.git
git push -u origin main
```

### 2. Apply Database Migration

Before deploying the service, make sure the required database tables exist:

```bash
# Connect to your database (or use Supabase UI)
cd ../backend
# Apply the migration
npx supabase migration up
# Or manually run the SQL in backend/supabase/migrations/20250328000000_scheduler_service_tables.sql
```

### 3. Set Up Google Cloud Resources

Use the provided setup script to create necessary cloud resources:

```bash
cd ../scheduler-service
# Make the setup script executable
chmod +x setup-gcp.sh
# Run the setup script
./setup-gcp.sh
```

This script will:
- Create the required service accounts
- Set up IAM permissions
- Create a PubSub topic and subscription
- Create API key secret in Secret Manager

### 4. Configure Environment Variables in Secret Manager

Set up the necessary environment variables in Secret Manager:

```bash
# Create database connection secrets
echo -n "your-db-host" | gcloud secrets create scheduler-db-host --data-file=-
echo -n "your-db-name" | gcloud secrets create scheduler-db-name --data-file=-
echo -n "your-db-user" | gcloud secrets create scheduler-db-user --data-file=-
echo -n "your-db-password" | gcloud secrets create scheduler-db-password --data-file=-

# Create service connection secrets
echo -n "https://backend-service-url" | gcloud secrets create scheduler-backend-url --data-file=-
echo -n "backend-api-key" | gcloud secrets create scheduler-backend-api-key --data-file=-

# Grant access to secrets
gcloud secrets add-iam-policy-binding scheduler-db-host \
  --member="serviceAccount:scheduler-service@delta-entity-447812-p2.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Repeat for all other secrets
```

### 5. Connect GitHub to Cloud Run

Set up continuous deployment from GitHub to Cloud Run:

1. Go to Google Cloud Console > Cloud Run
2. Click "Set up Continuous Deployment"
3. Select GitHub as the source
4. Connect your GitHub account and select the repository (nifyacorp/scheduler-service)
5. Select the branch to deploy (main)
6. Choose "Use existing Dockerfile" as the build configuration
7. Configure additional settings:
   - Service name: scheduler-service
   - Region: us-central1
   - CPU allocation: 1
   - Memory: 512 MiB
   - Maximum instances: 10
   - Minimum instances: 1
   - Ingress: Allow all
   - Authentication: Require authentication
8. Configure environment variables by referencing secrets:
   ```
   DB_HOST: projects/delta-entity-447812-p2/secrets/scheduler-db-host/versions/latest
   DB_NAME: projects/delta-entity-447812-p2/secrets/scheduler-db-name/versions/latest
   DB_USER: projects/delta-entity-447812-p2/secrets/scheduler-db-user/versions/latest
   DB_PASSWORD: projects/delta-entity-447812-p2/secrets/scheduler-db-password/versions/latest
   BACKEND_URL: projects/delta-entity-447812-p2/secrets/scheduler-backend-url/versions/latest
   BACKEND_API_KEY: projects/delta-entity-447812-p2/secrets/scheduler-backend-api-key/versions/latest
   API_KEY: projects/delta-entity-447812-p2/secrets/scheduler-service-api-key/versions/latest
   NODE_ENV: production
   ```
9. Click "Create" to set up the deployment

### 6. Set Up Cloud Scheduler Jobs

Create Cloud Scheduler jobs to trigger scheduled tasks:

1. Go to Google Cloud Console > Cloud Scheduler
2. Click "Create Job"
3. Configure the job:
   - Name: subscription-runner-daily
   - Description: Process all active subscriptions
   - Frequency: 0 0 * * * (daily at midnight)
   - Timezone: UTC
   - Target type: HTTP
   - URL: https://scheduler-service-[hash].run.app/api/v1/tasks/subscription-runner
   - HTTP method: POST
   - Auth header: Add OIDC token
   - Service account: scheduler-service@delta-entity-447812-p2.iam.gserviceaccount.com
   - Body: 
     ```json
     {
       "parameters": {
         "batchSize": 10,
         "limit": 100
       }
     }
     ```
4. Click "Create"
5. Repeat for other scheduled tasks (email-digest, cleanup-tasks)

### 7. Verify Deployment

Once deployed, verify that the service is working correctly:

1. Check the Cloud Run logs for any errors
2. Test the health endpoint:
   ```bash
   curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
     https://scheduler-service-[hash].run.app/health
   ```
3. Test executing a task manually:
   ```bash
   curl -X POST -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
     -H "Content-Type: application/json" \
     -d '{"parameters": {"test": true}}' \
     https://scheduler-service-[hash].run.app/api/v1/tasks/test
   ```

## Security Considerations

1. **Service Account Keys**: Avoid downloading service account keys. Use workload identity where possible.
2. **API Authentication**: Always use authentication for API endpoints.
3. **Secret Management**: Store all credentials in Secret Manager, not in environment variables.
4. **IAM Permissions**: Follow the principle of least privilege for service accounts.

## Troubleshooting

1. **Database Connection Issues**:
   - Check if the database IP is allowlisted for connections
   - Verify the database credentials are correct
   - Check if the required tables exist

2. **Permission Issues**:
   - Verify that the service account has necessary permissions
   - Check IAM bindings for Secret Manager access

3. **Cloud Scheduler Failures**:
   - Verify the URL is correct
   - Check authentication configuration
   - Check the service logs for details

4. **Deployment Failures**:
   - Check Cloud Build logs for build errors
   - Verify Dockerfile is correct
   - Check for environment variable configuration issues