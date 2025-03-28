#!/bin/bash
set -e

# Configuration variables
PROJECT_ID="delta-entity-447812-p2"
SERVICE_NAME="scheduler-service"
REGION="us-central1"
SERVICE_ACCOUNT="${SERVICE_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
DEPLOYER_SA="${SERVICE_NAME}-deployer@${PROJECT_ID}.iam.gserviceaccount.com"
PUBSUB_TOPIC="${SERVICE_NAME}-notifications"
PUBSUB_SUBSCRIPTION="${SERVICE_NAME}-notifications-sub"

# Print section header
section() {
  echo ""
  echo "==== $1 ===="
  echo ""
}

section "Setting up Google Cloud project"
gcloud config set project $PROJECT_ID

section "Creating service accounts"
# Create service account for the service itself
gcloud iam service-accounts create $SERVICE_NAME \
  --display-name="Scheduler Service" \
  --description="Service account for the NIFYA Scheduler Service" \
  || echo "Service account already exists"

# Create service account for GitHub deployment
gcloud iam service-accounts create "${SERVICE_NAME}-deployer" \
  --display-name="Scheduler Service Deployer" \
  --description="Service account for deploying the NIFYA Scheduler Service" \
  || echo "Deployer service account already exists"

section "Setting up IAM permissions"
# Grant permissions to the service account
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/pubsub.publisher"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/pubsub.subscriber"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor"

# Grant permissions to the deployer service account
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$DEPLOYER_SA" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$DEPLOYER_SA" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$DEPLOYER_SA" \
  --role="roles/cloudbuild.builds.editor"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$DEPLOYER_SA" \
  --role="roles/iam.serviceAccountUser"

section "Setting up Cloud Run"
# Allow service account to invoke Cloud Run service
gcloud run services add-iam-policy-binding $SERVICE_NAME \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/run.invoker" \
  --region=$REGION \
  || echo "Cloud Run service doesn't exist yet, will set permissions after deployment"

section "Setting up Pub/Sub"
# Create Pub/Sub topic
gcloud pubsub topics create $PUBSUB_TOPIC \
  || echo "Topic already exists"

# Create Pub/Sub subscription
gcloud pubsub subscriptions create $PUBSUB_SUBSCRIPTION \
  --topic=$PUBSUB_TOPIC \
  --ack-deadline=60 \
  || echo "Subscription already exists"

section "Creating Secret Manager secrets"
# Create API key secret
echo "Creating API key secret..."
API_KEY=$(openssl rand -base64 32)
echo -n "$API_KEY" | gcloud secrets create ${SERVICE_NAME}-api-key \
  --data-file=- \
  --replication-policy="automatic" \
  || echo "API key secret already exists"

# Grant access to the secret
gcloud secrets add-iam-policy-binding ${SERVICE_NAME}-api-key \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor"

section "Setup complete"
echo "Service account: $SERVICE_ACCOUNT"
echo "Deployer account: $DEPLOYER_SA"
echo "PubSub topic: $PUBSUB_TOPIC"
echo "PubSub subscription: $PUBSUB_SUBSCRIPTION"
echo ""
echo "Next steps:"
echo "1. Upload the code to GitHub: https://github.com/nifyacorp/scheduler-service"
echo "2. Set up GitHub Actions secrets for deployment"
echo "3. Run the first manual deployment or push to main branch"