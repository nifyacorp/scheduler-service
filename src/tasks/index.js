import { z } from 'zod';
import { subscriptionRunner } from './subscription-runner.js';
import { emailDigestProcessor } from './email-digest-processor.js';
import { cleanupTasks } from './cleanup-tasks.js';
import logger from '../utils/logger.js';

/**
 * Load all task definitions
 * @returns {Object} Map of task types to task definitions
 */
export function loadTasks() {
  logger.info('Loading task definitions');
  
  const tasks = {
    'run-subscriptions': {
      description: 'Process all active subscriptions to check for new matches',
      handler: subscriptionRunner,
      cronSchedule: '0 0 * * *', // Daily at midnight
      parametersSchema: z.object({
        batchSize: z.number().int().positive().default(10),
        subscriptionType: z.string().optional(),
        specificIds: z.array(z.string()).optional()
      }),
      defaultParameters: {
        batchSize: 10
      },
      timeoutMs: 300000, // 5 minutes
      retryPolicy: {
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
        retryableErrors: ['timeout', 'connection', /database/i, /network/i]
      }
    },
    
    'email-digest': {
      description: 'Generate and send email digests for user notifications',
      handler: emailDigestProcessor,
      cronSchedule: '0 6 * * *', // Daily at 6 AM
      parametersSchema: z.object({
        timezone: z.string().default('UTC'),
        batchSize: z.number().int().positive().default(50)
      }),
      defaultParameters: {
        timezone: 'UTC',
        batchSize: 50
      },
      timeoutMs: 600000, // 10 minutes
      retryPolicy: {
        maxRetries: 3,
        baseDelayMs: 5000,
        maxDelayMs: 60000,
        retryableErrors: ['timeout', 'connection', /email service/i]
      }
    },
    
    'cleanup': {
      description: 'Clean up old notifications, logs, and temporary files',
      handler: cleanupTasks,
      cronSchedule: '0 2 * * 0', // Weekly on Sunday at 2 AM
      parametersSchema: z.object({
        notificationRetentionDays: z.number().int().positive().default(90),
        logRetentionDays: z.number().int().positive().default(30),
        tempFileRetentionDays: z.number().int().positive().default(7)
      }),
      defaultParameters: {
        notificationRetentionDays: 90,
        logRetentionDays: 30,
        tempFileRetentionDays: 7
      },
      timeoutMs: 1800000, // 30 minutes
      retryPolicy: {
        maxRetries: 2,
        baseDelayMs: 10000,
        maxDelayMs: 120000,
        retryableErrors: ['database', 'storage']
      }
    }
  };
  
  logger.info(`Loaded ${Object.keys(tasks).length} task definitions`);
  return tasks;
}