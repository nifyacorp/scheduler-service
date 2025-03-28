import axios from 'axios';
import { config } from '../config/index.js';

/**
 * Clean up old notifications, logs, and temporary files
 * @param {Object} parameters - Task parameters
 * @param {Object} context - Task execution context
 * @returns {Promise<Object>} Task result
 */
export async function cleanupTasks(parameters, context) {
  const { 
    notificationRetentionDays = 90, 
    logRetentionDays = 30,
    tempFileRetentionDays = 7
  } = parameters;
  
  const { logger, executionId } = context;
  
  logger.info('Starting cleanup task', {
    notificationRetentionDays,
    logRetentionDays,
    tempFileRetentionDays,
    executionId
  });
  
  // Initialize counts
  const counts = {
    notificationsDeleted: 0,
    logsDeleted: 0,
    tempFilesDeleted: 0,
    errors: []
  };
  
  // 1. Clean up old notifications
  try {
    logger.info(`Cleaning up notifications older than ${notificationRetentionDays} days`);
    
    const backendUrl = `${config.services.backend}/api/v1/admin/cleanup/notifications`;
    
    const notificationResponse = await axios.post(backendUrl, {
      retentionDays: notificationRetentionDays
    }, {
      headers: {
        'Authorization': `Bearer ${config.auth.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    counts.notificationsDeleted = notificationResponse.data.deleted || 0;
    
    logger.info(`Deleted ${counts.notificationsDeleted} old notifications`);
  } catch (error) {
    logger.error('Failed to clean up old notifications', {
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    counts.errors.push({
      task: 'notifications',
      error: error.message
    });
  }
  
  // 2. Clean up old logs
  try {
    logger.info(`Cleaning up logs older than ${logRetentionDays} days`);
    
    // If we have a logs cleanup endpoint, call it
    // This is just an example - adjust according to your actual logging system
    if (config.services.loggingService) {
      const logsUrl = `${config.services.loggingService}/api/v1/cleanup`;
      
      const logsResponse = await axios.post(logsUrl, {
        retentionDays: logRetentionDays
      }, {
        headers: {
          'Authorization': `Bearer ${config.auth.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      counts.logsDeleted = logsResponse.data.deleted || 0;
      
      logger.info(`Deleted ${counts.logsDeleted} old logs`);
    } else {
      logger.info('No logging service configured, skipping logs cleanup');
    }
  } catch (error) {
    logger.error('Failed to clean up old logs', {
      error: error.message
    });
    
    counts.errors.push({
      task: 'logs',
      error: error.message
    });
  }
  
  // 3. Clean up temporary files
  try {
    logger.info(`Cleaning up temporary files older than ${tempFileRetentionDays} days`);
    
    // If we have a temp files cleanup endpoint, call it
    // This could be a storage service, backend endpoint, etc.
    if (config.services.storageService) {
      const storageUrl = `${config.services.storageService}/api/v1/cleanup/temp`;
      
      const storageResponse = await axios.post(storageUrl, {
        retentionDays: tempFileRetentionDays
      }, {
        headers: {
          'Authorization': `Bearer ${config.auth.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      counts.tempFilesDeleted = storageResponse.data.deleted || 0;
      
      logger.info(`Deleted ${counts.tempFilesDeleted} temporary files`);
    } else {
      logger.info('No storage service configured, skipping temp file cleanup');
    }
  } catch (error) {
    logger.error('Failed to clean up temporary files', {
      error: error.message
    });
    
    counts.errors.push({
      task: 'tempFiles',
      error: error.message
    });
  }
  
  const success = counts.errors.length === 0;
  
  logger.info('Cleanup task completed', {
    success,
    ...counts
  });
  
  return {
    success,
    ...counts
  };
}