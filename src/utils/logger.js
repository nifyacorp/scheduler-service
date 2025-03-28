import pino from 'pino';
import { config } from '../config/index.js';

// Configure log level based on environment
const level = config.logLevel || 'info';

// Create a pretty printer for development
const prettyPrint = config.environment === 'development' || config.environment === 'local';

// Create the logger instance
const logger = pino({
  level,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  transport: prettyPrint
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  base: {
    service: 'scheduler-service',
    env: config.environment,
  },
});

export default logger;