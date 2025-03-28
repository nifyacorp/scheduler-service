import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env file if present
dotenv.config();

// Get the directory name using ESM specific approach
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define default config
const defaultConfig = {
  // Server config
  port: 8081,
  environment: 'development',
  logLevel: 'info',
  publicUrl: 'https://scheduler-service-415554190254.us-central1.run.app',
  
  // CORS config
  corsOrigins: ['*'],
  
  // Authentication
  auth: {
    apiKey: process.env.API_KEY || 'development-api-key',
    secret: process.env.JWT_SECRET || 'development-secret',
  },
  
  // Database config
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'nifya',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: process.env.DB_SSL === 'true',
    max: parseInt(process.env.DB_POOL_SIZE || '10', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
  },
  
  // External services
  services: {
    backend: process.env.BACKEND_URL || 'https://backend-415554190254.us-central1.run.app',
    emailService: process.env.EMAIL_SERVICE_URL || 'https://email-notification-415554190254.us-central1.run.app',
    subscriptionWorker: process.env.SUBSCRIPTION_WORKER_URL || 'https://subscription-worker-415554190254.us-central1.run.app',
  },
  
  // PubSub config
  pubsub: {
    projectId: process.env.GOOGLE_CLOUD_PROJECT || 'nifya-development',
    topic: process.env.PUBSUB_TOPIC || 'scheduler-events',
  },
};

// Load environment-specific config
let envConfig = {};
const envConfigPath = path.join(__dirname, `${process.env.NODE_ENV || 'development'}.js`);

if (fs.existsSync(envConfigPath)) {
  try {
    const module = await import(envConfigPath);
    envConfig = module.default;
  } catch (error) {
    console.error(`Error loading environment config from ${envConfigPath}:`, error);
  }
}

// Merge configs with environment variables taking precedence
export const config = {
  ...defaultConfig,
  ...envConfig,
  // Override with environment variables
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : defaultConfig.port,
  environment: process.env.NODE_ENV || defaultConfig.environment,
  logLevel: process.env.LOG_LEVEL || defaultConfig.logLevel,
  publicUrl: process.env.PUBLIC_URL || defaultConfig.publicUrl,
};