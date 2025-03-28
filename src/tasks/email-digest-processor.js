import axios from 'axios';
import { config } from '../config/index.js';

/**
 * Generate and send email digests for user notifications
 * @param {Object} parameters - Task parameters
 * @param {Object} context - Task execution context
 * @returns {Promise<Object>} Task result
 */
export async function emailDigestProcessor(parameters, context) {
  const { timezone = 'UTC', batchSize = 50 } = parameters;
  const { logger, executionId } = context;
  
  logger.info('Starting email digest processor task', {
    timezone,
    batchSize,
    executionId
  });
  
  // Calculate the current time in the specified timezone
  logger.debug(`Processing digest for timezone: ${timezone}`);
  
  try {
    // Trigger the email service to send digests for this timezone
    const emailServiceUrl = `${config.services.emailService}/api/v1/digests/send`;
    
    logger.debug(`Calling email service: ${emailServiceUrl}`);
    
    const response = await axios.post(emailServiceUrl, {
      timezone,
      batchSize
    }, {
      headers: {
        'Authorization': `Bearer ${config.auth.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = response.data;
    
    logger.info('Email digest processing completed', {
      timezone,
      usersProcessed: result.processedUsers || 0,
      emailsSent: result.emailsSent || 0,
      errors: result.errors || 0
    });
    
    return {
      timezone,
      processedUsers: result.processedUsers || 0,
      emailsSent: result.emailsSent || 0,
      errors: result.errors || 0
    };
  } catch (error) {
    logger.error('Failed to process email digests', {
      timezone,
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    throw new Error(`Failed to process email digests for timezone ${timezone}: ${error.message}`);
  }
}